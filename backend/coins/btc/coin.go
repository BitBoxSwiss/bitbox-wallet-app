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
	"math/big"
	"path"
	"strings"
	"sync"

	"github.com/btcsuite/btcd/chaincfg"
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
	initOnce              sync.Once
	code                  string
	unit                  string
	net                   *chaincfg.Params
	dbFolder              string
	servers               []*rpc.ServerInfo
	blockExplorerTxPrefix string

	observable.Implementation

	blockchain blockchain.Interface
	headers    *headers.Headers

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	code string,
	unit string,
	net *chaincfg.Params,
	dbFolder string,
	servers []*rpc.ServerInfo,
	blockExplorerTxPrefix string,
) *Coin {
	coin := &Coin{
		code:                  code,
		unit:                  unit,
		net:                   net,
		dbFolder:              dbFolder,
		servers:               servers,
		blockExplorerTxPrefix: blockExplorerTxPrefix,

		log: logging.Get().WithGroup("coin").WithField("code", code),
	}
	return coin
}

// Initialize initializes the coin - blockchain and headers.
func (coin *Coin) Initialize() {
	coin.initOnce.Do(func() {
		// Init blockchain
		coin.blockchain = electrum.NewElectrumConnection(coin.servers, coin.log)

		// Init Headers
		db, err := headersdb.NewDB(
			path.Join(coin.dbFolder, fmt.Sprintf("headers-%s.db", coin.code)))
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
					Subject: fmt.Sprintf("coins/%s/headers/status", coin.code),
					Action:  action.Replace,
					Object:  status,
				})
			}
		})
	})
}

// Code implements coin.Coin.
func (coin *Coin) Code() string {
	return coin.code
}

// Net returns the coin's network params.
func (coin *Coin) Net() *chaincfg.Params {
	return coin.net
}

// Unit implements coin.Coin.
func (coin *Coin) Unit() string {
	return coin.unit
}

// Denomination implements coin.Coin.
func (coin *Coin) Denomination() *big.Int {
	return big.NewInt(unitSatoshi)
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount coinpkg.Amount) string {
	return strings.TrimRight(
		new(big.Rat).SetFrac(amount.BigInt(), coin.Denomination()).FloatString(8),
		"0.",
	)
}

// AccountBased implements coin.Coin.
func (coin *Coin) AccountBased() bool {
	return false
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
	return coin.code
}

// BlockExplorerTransactionURLPrefix implements coin.Coin.
func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
	return coin.blockExplorerTxPrefix
}
