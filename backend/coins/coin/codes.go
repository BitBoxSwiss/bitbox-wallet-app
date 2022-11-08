// Copyright 2020 Shift Crypto AG
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

// Code represents a unique coin code. Usually the coin acronym in lowercase. ERC20-Tokens are also coins.
type Code string

const (
	// CodeBTC is Bitcoin.
	CodeBTC Code = "btc"
	// CodeTBTC is Bitcoin Testnet.
	CodeTBTC Code = "tbtc"
	// CodeRBTC is Bitcoin Regtest.
	CodeRBTC Code = "rbtc"
	// CodeLTC is Litecoin.
	CodeLTC Code = "ltc"
	// CodeTLTC is Litecoin Testnet.
	CodeTLTC Code = "tltc"
	// CodeETH is Ethereum.
	CodeETH Code = "eth"
	// CodeGOETH is Ethereum Goerli.
	CodeGOETH Code = "goeth"
	// If you add coins, don't forget to update `testnetCoins` below.
	// There are some more coin codes for the supported erc20 tokens in erc20.go.
)

// BtcUnit defines how BTC values are formatted.
type BtcUnit string

const (
	// BtcUnitDefault formats the value in the default unit, e.g. "BTC" for Bitcoin, "TBTC" for
	// Bitcoin testnet.
	BtcUnitDefault BtcUnit = "default"
	// BtcUnitSats formats the value as satoshis. Applies to both Bitcoin mainnet and testnet.
	BtcUnitSats BtcUnit = "sat"
)

// TestnetCoins is the subset of all coins which are available in testnet mode.
var TestnetCoins = map[Code]struct{}{
	CodeTBTC:  {},
	CodeTLTC:  {},
	CodeGOETH: {},
}
