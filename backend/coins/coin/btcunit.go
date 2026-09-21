// SPDX-License-Identifier: Apache-2.0

package coin

import (
	"math/big"

	"github.com/btcsuite/btcd/btcutil/v2"
)

// BtcUnit defines the denomination for formatting and parsing Bitcoin-related amounts.
type BtcUnit string

const (
	// BtcUnitDefault formats the value in the default unit, e.g. "BTC" for Bitcoin, "TBTC" for
	// Bitcoin testnet.
	BtcUnitDefault BtcUnit = "default"
	// BtcUnitSats formats the value as satoshis. Applies to both Bitcoin mainnet and testnet.
	BtcUnitSats BtcUnit = "sat"
)

// SatoshisPerUnit returns the scale for this denomination. Values other than BtcUnitSats
// use the default unit. The returned integer can be modified by the caller.
func (unit BtcUnit) SatoshisPerUnit() *big.Int {
	if unit == BtcUnitSats {
		return big.NewInt(1)
	}
	return big.NewInt(btcutil.SatoshiPerBitcoin)
}

// FormatAmount formats an atomic amount in this denomination, without reading any preferences.
func (unit BtcUnit) FormatAmount(amount Amount) string {
	if unit == BtcUnitSats {
		return amount.BigInt().String()
	}
	return new(big.Rat).SetFrac(amount.BigInt(), unit.SatoshisPerUnit()).FloatString(8)
}

// ParseAmount parses an amount in this denomination, rounding to the nearest satoshi with ties
// away from zero. For transaction inputs, use SendAmount.Amount with SatoshisPerUnit to reject
// fractional satoshis instead.
func (unit BtcUnit) ParseAmount(amount string) (Amount, error) {
	return ParseAmount(amount, unit.SatoshisPerUnit())
}
