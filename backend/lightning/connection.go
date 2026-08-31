// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
)

// ConnectionState describes the Lightning SDK connection lifecycle.
type ConnectionState string

const (
	// ConnectionInactive means that no Lightning account is configured.
	ConnectionInactive ConnectionState = "inactive"
	// ConnectionConnecting means that the SDK connection is being initialized.
	ConnectionConnecting ConnectionState = "connecting"
	// ConnectionReady means that the SDK connection is ready for requests.
	ConnectionReady ConnectionState = "ready"
	// ConnectionFailed means that SDK connection initialization failed.
	ConnectionFailed ConnectionState = "failed"
)

// ConnectionErrorInitializationFailed is returned when the Lightning SDK could not initialize.
const ConnectionErrorInitializationFailed = "initializationFailed"

// ConnectionStatus is the current Lightning SDK connection status.
type ConnectionStatus struct {
	State     ConnectionState `json:"state"`
	ErrorCode string          `json:"errorCode,omitempty"`
}

// Status returns the current Lightning SDK connection status.
func (lightning *Lightning) Status() ConnectionStatus {
	lightning.connectionStatusLock.RLock()
	defer lightning.connectionStatusLock.RUnlock()
	return lightning.connectionStatus
}

func (lightning *Lightning) setConnectionStatus(state ConnectionState, errorCode string) {
	status := ConnectionStatus{
		State:     state,
		ErrorCode: errorCode,
	}

	lightning.connectionStatusLock.Lock()
	if lightning.connectionStatus == status {
		lightning.connectionStatusLock.Unlock()
		return
	}
	lightning.connectionStatus = status
	lightning.connectionStatusLock.Unlock()

	lightning.Notify(observable.Event{
		Subject: "lightning/status",
		Action:  action.Replace,
		Object:  status,
	})
}

// Reconnect retries Lightning SDK connection initialization in the background.
func (lightning *Lightning) Reconnect() error {
	if lightning.Account() == nil {
		return errp.New("Lightning account not configured")
	}
	if lightning.Ready() || lightning.Status().State == ConnectionConnecting {
		return nil
	}

	lightning.setConnectionStatus(ConnectionConnecting, "")
	go lightning.Connect()
	return nil
}
