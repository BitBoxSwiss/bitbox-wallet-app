// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"

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

func TestPortfolioDataWithInitializingLightning(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.NoError(t, b.lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))

	balances, err := b.coinsTotalBalance(b.Accounts())
	require.NoError(t, err)
	require.Equal(t, []coinFormattedAmount{{
		CoinCode: coinCodeLightning,
		CoinName: "Lightning",
	}}, balances)

	chart, err := b.ChartData(false)
	require.NoError(t, err)
	require.Nil(t, chart.Total)
	require.Empty(t, chart.FormattedTotal)
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

type lightningHistoryTransport struct {
	at time.Time
}

func (transport lightningHistoryTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if err := request.Context().Err(); err != nil {
		return nil, err
	}
	if !strings.HasSuffix(request.URL.Path, "/coins/bitcoin/market_chart/range") ||
		request.URL.Query().Get("vs_currency") != "usd" {
		return nil, fmt.Errorf("unexpected rates request: %s", request.URL)
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(fmt.Sprintf(
			`{"prices":[[%d,42]]}`, transport.at.UnixMilli()))),
	}, nil
}

// Clearing the cache must restart BTC history for Lightning even without loaded on-chain accounts,
// and Lightning must use the replacement rates updater.
func TestClearCacheRestoresLightningHistory(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	at := time.Now().Add(-time.Hour).Truncate(time.Second)
	b.httpClient = &http.Client{Transport: lightningHistoryTransport{at: at}}
	require.NoError(t, b.config.ModifyAppConfig(func(cfg *config.AppConfig) error {
		cfg.Backend.FiatList = []string{"USD"}
		return nil
	}))
	require.NoError(t, b.lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))
	require.Empty(t, b.Accounts())
	oldRatesUpdater := b.ratesUpdater

	require.NoError(t, b.ClearCache())

	require.Empty(t, b.Accounts())
	require.NotSame(t, oldRatesUpdater, b.ratesUpdater)
	lightningRatesUpdater, _ := b.lightning.TstRuntimeDependencies()
	require.Same(t, b.ratesUpdater, lightningRatesUpdater)
	require.Eventually(t, func() bool {
		return lightningRatesUpdater.HistoricalPriceAt("btc", "USD", at) == 42
	}, 5*time.Second, 10*time.Millisecond, "Lightning BTC history was not restored after clearing cache")
}
