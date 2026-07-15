// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/banners"
	accountHandlers "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/handlers"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02"
	bitbox02Handlers "github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02/handlers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
)

type queuedEvent struct {
	value           interface{}
	snapshotSubject string
	snapshotResult  chan bool
}

func (handlers *Handlers) registerSnapshots() {
	handlers.registerSnapshot("accounts", func() interface{} {
		return handlers.accounts()
	})
	handlers.registerSnapshot("aopp", func() interface{} {
		return handlers.aopp()
	})
	handlers.registerSnapshot("bluetooth/state", func() interface{} {
		return handlers.backend.Bluetooth().State()
	})
	handlers.registerSnapshot("devices/registered", func() interface{} {
		return handlers.getDevicesRegistered(nil)
	})
	handlers.registerSnapshot("keystores", func() interface{} {
		return handlers.keystores()
	})
	handlers.registerSnapshot("online", func() interface{} {
		return handlers.backend.IsOnline()
	})
	handlers.registerSnapshot("update", func() interface{} {
		return handlers.backend.GetUpdate()
	})
	handlers.registerSnapshot("using-mobile-data", func() interface{} {
		return handlers.backend.Environment().UsingMobileData()
	})
	for _, key := range []banners.MessageKey{
		banners.KeyBitBox01,
		banners.KeyBitBox02,
		banners.KeyBitBox02Nova,
	} {
		handlers.registerSnapshot("banners/"+string(key), func() interface{} {
			return handlers.backend.Banners().GetMessage(key)
		})
	}
}

func (handlers *Handlers) registerSnapshot(subject string, snapshot func() interface{}) {
	handlers.snapshots[subject] = snapshot
}

func (handlers *Handlers) snapshot(subject string) (interface{}, bool) {
	snapshot, ok := handlers.snapshots[subject]
	if ok {
		return snapshot(), true
	}

	parts := strings.Split(subject, "/")
	if len(parts) == 3 && parts[0] == "account" {
		for _, account := range handlers.backend.Accounts() {
			if string(account.Config().Config.Code) != parts[1] {
				continue
			}
			switch parts[2] {
			case "status":
				return accountHandlers.Status(account), true
			case "transactions":
				return accountHandlers.Transactions(account), true
			}
		}
		return nil, false
	}
	if len(parts) == 3 && parts[0] == "coins" && parts[2] == "fiat-prices" {
		return handlers.coinFiatPrices(coinpkg.Code(parts[1])), true
	}
	if len(parts) == 4 && parts[0] == "coins" && parts[2] == "headers" && parts[3] == "status" {
		return handlers.headersStatus(coinpkg.Code(parts[1])), true
	}
	if len(parts) >= 4 && parts[0] == "devices" {
		device, ok := handlers.backend.DevicesRegistered()[parts[2]]
		if !ok {
			return nil, false
		}
		switch parts[1] {
		case bitbox02.PlatformName:
			device, ok := device.(*bitbox02.Device)
			if !ok {
				return nil, false
			}
			switch {
			case len(parts) == 4 && parts[3] == "status":
				return device.Status(), true
			case len(parts) == 4 && parts[3] == "attestationCheckDone":
				return device.Attestation(), true
			case len(parts) == 5 && parts[3] == "backups" && parts[4] == "list":
				return bitbox02Handlers.Backups(device, handlers.log), true
			}
		case bitbox02bootloader.ProductName:
			device, ok := device.(*bitbox02bootloader.Device)
			if ok && len(parts) == 4 && parts[3] == "status" {
				return device.Status(), true
			}
		}
	}
	return nil, false
}

func (handlers *Handlers) pushEvent(value interface{}) {
	handlers.eventQueue <- queuedEvent{value: value}
}

func (handlers *Handlers) pushSnapshot(subject string) bool {
	result := make(chan bool)
	handlers.eventQueue <- queuedEvent{
		snapshotSubject: subject,
		snapshotResult:  result,
	}
	return <-result
}

// processEvents puts initial snapshots and live updates on one ordered stream. Reload snapshots
// are resolved here, after the producer has released any locks held while emitting the event.
func (handlers *Handlers) processEvents() {
	for queued := range handlers.eventQueue {
		if queued.snapshotResult != nil {
			snapshot, ok := handlers.snapshot(queued.snapshotSubject)
			if ok {
				handlers.backendEvents <- observable.Event{
					Subject: queued.snapshotSubject,
					Action:  action.Replace,
					Object:  snapshot,
				}
			}
			queued.snapshotResult <- ok
			continue
		}

		value := queued.value
		event, ok := value.(observable.Event)
		if ok && event.Action == action.Reload {
			snapshot, found := handlers.snapshot(event.Subject)
			if !found {
				handlers.log.WithField("subject", event.Subject).Error("missing event snapshot")
				continue
			}
			event.Action = action.Replace
			event.Object = snapshot
			value = event
		}
		handlers.backendEvents <- value
	}
}

func (handlers *Handlers) postEventsSnapshot(r *http.Request) interface{} {
	var subject string
	if err := json.NewDecoder(r.Body).Decode(&subject); err != nil {
		return struct {
			Success bool `json:"success"`
		}{Success: false}
	}
	return struct {
		Success bool `json:"success"`
	}{Success: handlers.pushSnapshot(subject)}
}
