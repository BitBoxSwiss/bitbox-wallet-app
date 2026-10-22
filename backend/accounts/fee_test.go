// SPDX-License-Identifier: Apache-2.0

package accounts_test

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/stretchr/testify/require"
)

func TestHighFeePercentage(t *testing.T) {
	for _, test := range []struct {
		name     string
		amount   string
		fee      string
		unit     string
		feeUnit  string
		expected string
	}{
		{"zero fee", "10000", "0", "BTC", "BTC", ""},
		{"below threshold before rounding", "10000", "999", "BTC", "BTC", ""},
		{"at threshold", "10000", "1000", "BTC", "BTC", "10.0"},
		{"round down", "10000", "1814", "BTC", "BTC", "18.1"},
		{"round up", "10000", "1815", "BTC", "BTC", "18.2"},
		{"fee exceeds send amount", "100", "10400", "BTC", "BTC", "10400.0"},
		{"zero amount", "0", "1000", "ETH", "ETH", ""},
		{"token with different decimals", "1000000", "21000000000000", "USDC", "ETH", ""},
		{"token with same decimals", "10000", "1000", "DAI", "ETH", ""},
		{"litecoin", "10000", "1000", "LTC", "LTC", "10.0"},
		{"beyond int64", "100000000000000000000", "10000000000000000000", "ETH", "ETH", "10.0"},
	} {
		t.Run(test.name, func(t *testing.T) {
			accountCoin := &mocks.CoinMock{
				UnitFunc: func(isFee bool) string {
					if isFee {
						return test.feeUnit
					}
					return test.unit
				},
			}
			amount, err := coin.NewAmountFromString(test.amount, big.NewInt(1))
			require.NoError(t, err)
			fee, err := coin.NewAmountFromString(test.fee, big.NewInt(1))
			require.NoError(t, err)
			require.Equal(t, test.expected, accounts.HighFeePercentage(accountCoin, amount, fee))
		})
	}
}
