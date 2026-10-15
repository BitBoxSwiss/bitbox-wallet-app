// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestBTCSatAmount(t *testing.T) {
	b := newBackend(t, true, false)
	defer b.Close()

	btcCoin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)
	b.ratesUpdater.LatestPrice()["BTC"] = map[string]float64{
		"BTC": 1,
		"sat": 100000000,
		"USD": 25000,
	}

	for _, unit := range []coinpkg.BtcUnit{coinpkg.BtcUnitDefault, coinpkg.BtcUnitSats} {
		btcCoin.(*btc.Coin).SetFormatUnit(unit)

		for _, tt := range []struct {
			name        string
			source      string
			amount      string
			rate        float64
			rateMissing bool
			errContains string
		}{
			{
				name:   "sat",
				source: "sat",
				amount: "200",
				rate:   25000,
			},
			{
				name:   "fiat",
				source: "fiat",
				amount: "0.05",
				rate:   25000,
			},
			{
				name:        "invalid source",
				source:      "invalid",
				amount:      "200",
				rate:        25000,
				errContains: "invalid source",
			},
			{
				name:        "invalid sat amount",
				source:      "sat",
				amount:      "invalid",
				rate:        25000,
				errContains: "invalid amount",
			},
			{
				name:        "negative sat amount",
				source:      "sat",
				amount:      "-1",
				rate:        25000,
				errContains: "amount must be non-negative",
			},
			{
				name:        "invalid fiat amount",
				source:      "fiat",
				amount:      "invalid",
				rate:        25000,
				errContains: "invalid amount",
			},
			{
				name:        "negative fiat amount",
				source:      "fiat",
				amount:      "-0.05",
				rate:        25000,
				errContains: "amount must be non-negative",
			},
			{
				name:        "missing exchange rate",
				source:      "fiat",
				amount:      "0.05",
				rateMissing: true,
				errContains: "exchange rate not available",
			},
			{
				name:        "zero exchange rate",
				source:      "fiat",
				amount:      "0.05",
				rate:        0,
				errContains: "exchange rate not available",
			},
		} {
			t.Run(string(unit)+"/"+tt.name, func(t *testing.T) {
				if tt.rateMissing {
					delete(b.ratesUpdater.LatestPrice()["BTC"], "USD")
				} else {
					b.ratesUpdater.LatestPrice()["BTC"]["USD"] = tt.rate
				}

				amount, err := b.BTCSatAmount(tt.source, tt.amount)
				if tt.errContains != "" {
					require.ErrorContains(t, err, tt.errContains)
					require.Nil(t, amount)
					return
				}

				require.NoError(t, err)
				require.Equal(t, "200", amount.Amount)
				require.Equal(t, "sat", amount.Unit)
				require.Equal(t, "0.05", amount.UnformattedConversions["USD"])
			})
		}
	}
}
