// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestChartTransactionAmountUsesRequestedFiatHistory(t *testing.T) {
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
			return ""
		},
		GetFormatUnitFunc: func(isFee bool) string {
			return "BTC"
		},
		UnitFunc: func(isFee bool) string {
			return "BTC"
		},
	}

	timestamp := time.Now().Add(-time.Hour)
	amount := chartTransactionAmount(
		coin.NewAmountFromInt64(12345678),
		&accountCoin,
		&timestamp,
		rateUpdater,
		"sat",
	)

	require.False(t, amount.Estimated)
	require.Equal(t, coin.ConversionsMap{
		"sat": "12345678",
	}, amount.Conversions)
}
