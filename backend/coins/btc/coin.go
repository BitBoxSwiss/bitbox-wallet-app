// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package btc

import (
	"fmt"
	"path"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/headers"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/db/headersdb"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox-wallet-app/util/rpc"
)

// Coin models a Bitcoin-related coin.
type Coin struct {
	name                  string
	unit                  string
	net                   *chaincfg.Params
	dbFolder              string
	servers               []*rpc.ServerInfo
	blockExplorerTxPrefix string

	ratesUpdater coinpkg.RatesUpdater
	observable.Implementation

	blockchain blockchain.Interface
	headers    *headers.Headers

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	name string,
	unit string,
	net *chaincfg.Params,
	dbFolder string,
	servers []*rpc.ServerInfo,
	blockExplorerTxPrefix string,
	ratesUpdater coinpkg.RatesUpdater,
) *Coin {
	coin := &Coin{
		name:                  name,
		unit:                  unit,
		net:                   net,
		dbFolder:              dbFolder,
		servers:               servers,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
		ratesUpdater:          ratesUpdater,

		log: logging.Get().WithGroup("coin").WithField("name", name),
	}
	return coin
}

// Init initializes the coin - blockchain and headers.
func (coin *Coin) Init() {
	// Init blockchain
	coin.blockchain = electrum.NewElectrumConnection(coin.servers, coin.log)

	// Init Headers
	db, err := headersdb.NewDB(
		path.Join(coin.dbFolder, fmt.Sprintf("headers-%s.db", coin.name)))
	if err != nil {
		coin.log.WithError(err).Panic("Could not open headers DB")
	}
	coin.headers = headers.NewHeaders(
		coin.net,
		db,
		coin.blockchain,
		coin.log)
	coin.headers.Init()
	coin.headers.SubscribeEvent(func(event headers.Event) {
		if event == headers.EventSyncing || event == headers.EventSynced {
			status, err := coin.headers.Status()
			if err != nil {
				coin.log.Error("Could not get headers status")
			}
			coin.Notify(observable.Event{
				Subject: fmt.Sprintf("coins/%s/headers/status", coin.name),
				Action:  action.Replace,
				Object:  status,
			})
		}
	})

	if coin.ratesUpdater != nil {
		coin.ratesUpdater.Observe(coin.Notify)
	}
}

// Name returns the coin's name.
func (coin *Coin) Name() string {
	return coin.name
}

// Net returns the coin's network params.
func (coin *Coin) Net() *chaincfg.Params {
	return coin.net
}

// Unit implements coin.Coin.
func (coin *Coin) Unit() string {
	return coin.unit
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount int64) string {
	return strconv.FormatFloat(btcutil.Amount(amount).ToUnit(btcutil.AmountBTC), 'f',
		-int(btcutil.AmountBTC+8), 64) + " " + coin.Unit()
}

func formatAsCurrency(amount float64) string {
	formatted := strconv.FormatFloat(amount, 'f', 2, 64)
	position := strings.Index(formatted, ".") - 3
	for position > 0 {
		formatted = formatted[:position] + "'" + formatted[position:]
		position = position - 3
	}
	return formatted
}

// FormatAmountAsJSON implements coin.Coin.
func (coin *Coin) FormatAmountAsJSON(amount int64) coinpkg.FormattedAmount {
	float := btcutil.Amount(amount).ToUnit(btcutil.AmountBTC)
	var conversions map[string]string
	if coin.ratesUpdater != nil {
		rates := coin.ratesUpdater.Last()
		if rates != nil {
			unit := coin.unit
			if len(unit) == 4 && strings.HasPrefix(unit, "T") {
				unit = unit[1:]
			}
			conversions = map[string]string{}
			for key, value := range rates[unit] {
				conversions[key] = formatAsCurrency(float * value)
			}
		}
	}
	return coinpkg.FormattedAmount{
		Amount:      strconv.FormatFloat(float, 'f', -int(btcutil.AmountBTC+8), 64),
		Unit:        coin.Unit(),
		Conversions: conversions,
	}
}

// RatesUpdater returns current exchange rates.
func (coin *Coin) RatesUpdater() coinpkg.RatesUpdater {
	return coin.ratesUpdater
}

// Blockchain connects to a blockchain backend.
func (coin *Coin) Blockchain() blockchain.Interface {
	return coin.blockchain
}

// Headers returns the coin headers.
func (coin *Coin) Headers() *headers.Headers {
	return coin.headers
}

func (coin *Coin) String() string {
	return coin.name
}
