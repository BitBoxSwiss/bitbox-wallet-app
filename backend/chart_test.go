// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestIncludeChartTransaction(t *testing.T) {
	timestamp := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		tx       *accounts.TransactionData
		expected bool
	}{
		{
			name: "receive",
			tx: &accounts.TransactionData{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusComplete,
				Type:      accounts.TxTypeReceive,
			},
			expected: true,
		},
		{
			name: "send",
			tx: &accounts.TransactionData{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusComplete,
				Type:      accounts.TxTypeSend,
			},
			expected: true,
		},
		{
			name: "failed receive",
			tx: &accounts.TransactionData{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusFailed,
				Type:      accounts.TxTypeReceive,
			},
			expected: false,
		},
		{
			name: "failed send",
			tx: &accounts.TransactionData{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusFailed,
				Type:      accounts.TxTypeSend,
			},
			expected: false,
		},
		{
			name: "send self",
			tx: &accounts.TransactionData{
				Timestamp: &timestamp,
				Status:    accounts.TxStatusComplete,
				Type:      accounts.TxTypeSendSelf,
			},
			expected: false,
		},
		{
			name: "missing timestamp",
			tx: &accounts.TransactionData{
				Status: accounts.TxStatusComplete,
				Type:   accounts.TxTypeReceive,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, includeChartTransaction(tt.tx))
		})
	}
}

func TestChartTransactionAmountOnlyIncludesChartFiat(t *testing.T) {
	rateUpdater := rates.MockRateUpdater()
	defer rateUpdater.Stop()

	accountCoin := coinMock.CoinMock{
		CodeFunc: func() coin.Code {
			return coin.CodeBTC
		},
		DecimalsFunc: func(isFee bool) uint {
			return 8
		},
		FormatAmountFunc: func(amount coin.Amount, isFee bool) string {
			return new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(1e8)).FloatString(8)
		},
		GetFormatUnitFunc: func(isFee bool) string {
			return "BTC"
		},
		UnitFunc: func(isFee bool) string {
			return "BTC"
		},
	}

	timestamp := time.Unix(1598832062, 0)
	amount := chartTransactionAmount(
		coin.NewAmountFromInt64(12345678),
		&accountCoin,
		&timestamp,
		rateUpdater,
		"USD",
	)

	require.Equal(t, "0.12345678", amount.Amount)
	require.Equal(t, "BTC", amount.Unit)
	require.False(t, amount.Estimated)
	require.Equal(t, coin.ConversionsMap{
		"USD": "0.12",
	}, amount.Conversions)
}
