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
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/safello"
)

// SafelloBuySupported implements accounts.Interface.
func (account *Account) SafelloBuySupported() bool {
	switch account.coin.Net().Net {
	case chaincfg.MainNetParams.Net, chaincfg.TestNet3Params.Net:
		return false // Safello suspended services, maybe temporarily, so we keep this around for a bit.
	}
	return false
}

// SafelloBuy implements accounts.Interface.
func (account *Account) SafelloBuy() *safello.Buy {
	switch account.coin.Net().Net {
	case chaincfg.MainNetParams.Net:
		address := account.GetUnusedReceiveAddresses()[0]
		return safello.NewBuy(false, address.ID(), address.EncodeForHumans())
	case chaincfg.TestNet3Params.Net:
		address := account.GetUnusedReceiveAddresses()[0]
		return safello.NewBuy(true, address.ID(), address.EncodeForHumans())
	default:
		panic("SafelloBuy is not supported by this account")
	}
}
