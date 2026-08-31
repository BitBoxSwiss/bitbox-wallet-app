// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestFormattedLightningBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	b.ratesUpdater = rates.MockRateUpdater()
	defer b.ratesUpdater.Stop()

	btcCoin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)

	balance := b.formattedCoinBalance(
		coinCodeLightning,
		"Lightning",
		btcCoin,
		big.NewInt(1e8),
	)

	require.Equal(t, coinCodeLightning, balance.CoinCode)
	require.Equal(t, "Lightning", balance.CoinName)
	require.Equal(t, "1.00000000", balance.FormattedAmount.Amount)
	require.Equal(t, "BTC", balance.FormattedAmount.Unit)
	require.Equal(t, "21.00", balance.FormattedAmount.Conversions["USD"])
}

func TestLightningFormattedBalanceWithoutAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	balance, err := b.lightningFormattedBalance()

	require.NoError(t, err)
	require.Nil(t, balance)
}

func TestPortfolioDataWithUnavailableLightning(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.NoError(t, b.lightning.SetAccount(&config.LightningAccountConfig{
		Code: "v0-deadbeef-ln-0",
	}))

	summary, err := b.AccountsBalanceSummary()
	require.NoError(t, err)
	require.Empty(t, summary.CoinsTotalBalance)
	require.Equal(t, []coinpkg.Code{coinCodeLightning}, summary.UnavailableCoinCodes)

	chart, err := b.ChartData()
	require.NoError(t, err)
	require.Equal(t, []coinpkg.Code{coinCodeLightning}, chart.UnavailableCoinCodes)
}

func TestInsertLightningFormattedBalance(t *testing.T) {
	lightningBalance := coinFormattedAmount{CoinCode: coinCodeLightning}

	tests := []struct {
		name     string
		balances []coinFormattedAmount
		expected []coinpkg.Code
	}{
		{
			name: "after bitcoin",
			balances: []coinFormattedAmount{
				{CoinCode: coinpkg.CodeBTC},
				{CoinCode: coinpkg.CodeETH},
			},
			expected: []coinpkg.Code{
				coinpkg.CodeBTC,
				coinCodeLightning,
				coinpkg.CodeETH,
			},
		},
		{
			name: "first when bitcoin is missing",
			balances: []coinFormattedAmount{
				{CoinCode: coinpkg.CodeETH},
			},
			expected: []coinpkg.Code{
				coinCodeLightning,
				coinpkg.CodeETH,
			},
		},
		{
			name:     "only row",
			balances: []coinFormattedAmount{},
			expected: []coinpkg.Code{coinCodeLightning},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := insertLightningFormattedBalance(tt.balances, &lightningBalance)
			resultCodes := make([]coinpkg.Code, 0, len(result))
			for _, balance := range result {
				resultCodes = append(resultCodes, balance.CoinCode)
			}
			require.Equal(t, tt.expected, resultCodes)
		})
	}

	require.Equal(t,
		[]coinFormattedAmount{{CoinCode: coinpkg.CodeBTC}},
		insertLightningFormattedBalance([]coinFormattedAmount{{CoinCode: coinpkg.CodeBTC}}, nil),
	)
}
