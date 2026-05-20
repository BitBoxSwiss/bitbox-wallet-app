// SPDX-License-Identifier: Apache-2.0

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
	// CodeSEPETH is Ethereum Sepolia.
	CodeSEPETH Code = "sepeth"
	// If you add coins, don't forget to update `testnetCoins` below.
	// There are some more coin codes for the supported erc20 tokens in erc20.go.
)

var bip44CoinTypes = map[Code]uint32{
	CodeBTC:    0,
	CodeTBTC:   1,
	CodeRBTC:   1,
	CodeLTC:    2,
	CodeTLTC:   1,
	CodeETH:    60,
	CodeSEPETH: 1,
}

// BIP44CoinType returns the unhardened BIP44 coin type for a coin code.
func BIP44CoinType(code Code) (uint32, bool) {
	coinType, ok := bip44CoinTypes[code]
	return coinType, ok
}

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
	CodeTBTC:   {},
	CodeTLTC:   {},
	CodeSEPETH: {},
	CodeRBTC:   {},
}

// IsBitcoinOnly returns true for Bitcoin mainnet, testnet, or regtest coin codes.
func IsBitcoinOnly(code Code) bool {
	switch code {
	case CodeBTC, CodeTBTC, CodeRBTC:
		return true
	default:
		return false
	}
}
