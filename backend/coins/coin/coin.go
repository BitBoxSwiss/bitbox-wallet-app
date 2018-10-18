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

package coin

import (
	"math/big"

	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
)

// Coin models the currency of a blockchain.
type Coin interface {
	observable.Interface

	// Code returns the code used to identify the coin (the acronym of the coin in lowercase).
	Code() string

	// Type returns the coin type according to BIP44:
	// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
	// Type() uint32

	// Unit is the unit code of the string for formatting amounts.
	Unit() string

	// Denomination returns the factor with which the common unit has to be multiplied to get the
	// smallest, canonical amount.
	Denomination() *big.Int

	// FormatAmount formats the given amount as a string in but without the coin unit.
	FormatAmount(Amount) string

	// FeeLevels() returns the fee levels supported by the coin.
	// FeeLevels() []fee.Level

	// Returns whether the coin is account-based (instead of UTXO).
	// Account-based transactions can have only one output and need no change address.
	AccountBased() bool

	// BlockExplorerTransactionURLPrefix returns the URL prefix of the block explorer.
	BlockExplorerTransactionURLPrefix() string

	// Initialize initializes the coin by connecting to a full node, downloading the headers, etc.
	Initialize()
}
