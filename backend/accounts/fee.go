// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

// HighFeePercentage returns the fee as a percentage of the send amount, with one decimal place,
// when it reaches the BitBox02 firmware's 10% warning threshold. Fees paid in a different asset
// and zero send amounts cannot be compared and return an empty string.
func HighFeePercentage(accountCoin coin.Coin, amount, fee coin.Amount) string {
	if accountCoin.Unit(false) != accountCoin.Unit(true) || amount.BigInt().Sign() <= 0 {
		return ""
	}
	percentage := new(big.Rat).SetFrac(fee.BigInt(), amount.BigInt())
	percentage.Mul(percentage, big.NewRat(100, 1))
	if percentage.Cmp(big.NewRat(10, 1)) < 0 {
		return ""
	}
	return percentage.FloatString(1)
}
