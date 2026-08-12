// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestChartCoinCodesIncludesBitcoinForLightning(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.NoError(t, b.lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))

	require.Equal(t, []string{string(coin.CodeBTC)}, b.chartCoinCodes())
}

func TestChartTransactionMarkers(t *testing.T) {
	rateUpdater := rates.MockRateUpdater()
	defer rateUpdater.Stop()

	accountCoin := coinMock.CoinMock{
		CodeFunc: func() coin.Code {
			return coin.CodeBTC
		},
		DecimalsFunc: func(isFee bool) uint {
			return 8
		},
		UnitFunc: func(isFee bool) string {
			return "BTC"
		},
	}
	now := time.Now()
	hourlyFrom := now.AddDate(0, 0, -7).Truncate(24 * time.Hour)

	t.Run("sums before formatting and preserves estimates", func(t *testing.T) {
		historicalTime := time.Unix(1598832062, 0)
		recentTime := now.Add(-time.Hour)
		markers := chartTransactionMarkers([]chartTransactionAccount{{
			accountCoin: &accountCoin,
			rateUpdater: rateUpdater,
			txs: accounts.OrderedTransactions{
				{
					Timestamp: &historicalTime,
					Status:    accounts.TxStatusComplete,
					Type:      accounts.TxTypeReceive,
					Amount:    coin.NewAmountFromInt64(600_000),
				},
				{
					Timestamp: &historicalTime,
					Status:    accounts.TxStatusComplete,
					Type:      accounts.TxTypeReceive,
					Amount:    coin.NewAmountFromInt64(600_000),
				},
				{
					Timestamp:      &recentTime,
					Status:         accounts.TxStatusComplete,
					Type:           accounts.TxTypeSend,
					DeductedAmount: coin.NewAmountFromInt64(100_000_000),
				},
			},
		}}, "USD", hourlyFrom, now)

		require.Len(t, markers.Daily, 2)
		require.Equal(t, ChartTransactionMarkerAmount{
			Count:  2,
			Amount: "0.01",
		}, markers.Daily[0].Receive)
		require.Equal(t, ChartTransactionMarkerAmount{
			Count:     1,
			Amount:    "21.00",
			Estimated: true,
		}, markers.Daily[1].Send)
		require.Len(t, markers.Hourly, 1)
		require.Equal(t, recentTime.Truncate(time.Hour).Unix(), markers.Hourly[0].Time)
	})

	t.Run("uses the requested fiat history", func(t *testing.T) {
		timestamp := now.Add(-time.Hour)
		markers := chartTransactionMarkers([]chartTransactionAccount{{
			accountCoin: &accountCoin,
			rateUpdater: rateUpdater,
			txs: accounts.OrderedTransactions{{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusComplete,
				Type:      accounts.TxTypeReceive,
				Amount:    coin.NewAmountFromInt64(12_345_678),
			}},
		}}, "sat", hourlyFrom, now)

		require.Len(t, markers.Hourly, 1)
		require.Equal(t, ChartTransactionMarkerAmount{
			Count:  1,
			Amount: "12345678",
		}, markers.Hourly[0].Receive)
	})
}
