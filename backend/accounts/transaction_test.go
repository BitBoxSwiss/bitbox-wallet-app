// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"math/big"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

type testRatesProvider struct {
	prices map[time.Time]float64
}

func (provider testRatesProvider) LatestPrice() map[string]map[string]float64 {
	return nil
}

func (provider testRatesProvider) HistoricalPriceAt(_ string, _ string, timestamp time.Time) float64 {
	return provider.prices[timestamp]
}

func TestOrderedTransactions(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	fee := coin.NewAmountFromInt64(1)
	txs := []*TransactionData{
		{
			Timestamp: tt(time.Date(2020, 9, 15, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 10, 12, 0, 0, 0, time.UTC)),
			Height:    10,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(200),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 20, 12, 0, 0, 0, time.UTC)),
			Height:    20,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(300),
		},
		{
			Timestamp:        nil,
			CreatedTimestamp: tt(time.Date(2020, 9, 23, 13, 0, 0, 0, time.UTC)),
			Height:           0,
			Type:             TxTypeSend,
			Amount:           coin.NewAmountFromInt64(10),
		},
		{
			Timestamp:        nil,
			CreatedTimestamp: tt(time.Date(2020, 9, 23, 14, 0, 0, 0, time.UTC)),
			Height:           0,
			Type:             TxTypeSend,
			Amount:           coin.NewAmountFromInt64(5),
		},
		{
			Timestamp:        nil,
			CreatedTimestamp: tt(time.Date(2020, 9, 23, 12, 0, 0, 0, time.UTC)),
			Height:           -1, // unconfirmed parent
			Type:             TxTypeSend,
			Amount:           coin.NewAmountFromInt64(15),
		},
		{
			Timestamp:        nil,
			CreatedTimestamp: tt(time.Date(2020, 9, 23, 11, 0, 0, 0, time.UTC)),
			Height:           -1, // unconfirmed parent
			Type:             TxTypeSend,
			Amount:           coin.NewAmountFromInt64(20),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 11, 12, 0, 0, 0, time.UTC)),
			Height:    11,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(10),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 21, 12, 0, 0, 0, time.UTC)),
			Height:    21,
			Type:      TxTypeSendSelf,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
		},
		{
			Timestamp:          tt(time.Date(2020, 9, 22, 12, 0, 0, 0, time.UTC)),
			Height:             220,
			Type:               TxTypeSend,
			Amount:             coin.NewAmountFromInt64(5),
			Fee:                &fee,
			FeeIsDifferentUnit: true,
		},
	}
	ordered := NewOrderedTransactions(txs)
	require.Equal(t, coin.NewAmountFromInt64(534), ordered[0].Balance)
	require.Equal(t, coin.NewAmountFromInt64(539), ordered[1].Balance)
	require.Equal(t, coin.NewAmountFromInt64(549), ordered[2].Balance)
	require.Equal(t, coin.NewAmountFromInt64(564), ordered[3].Balance)
	require.Equal(t, coin.NewAmountFromInt64(584), ordered[4].Balance)
	require.Equal(t, coin.NewAmountFromInt64(589), ordered[5].Balance)
	require.Equal(t, coin.NewAmountFromInt64(590), ordered[6].Balance)
	require.Equal(t, coin.NewAmountFromInt64(290), ordered[7].Balance)
	require.Equal(t, coin.NewAmountFromInt64(190), ordered[8].Balance)
	require.Equal(t, coin.NewAmountFromInt64(200), ordered[9].Balance)

	timeseries, err := ordered.Timeseries(
		time.Date(2020, 9, 9, 13, 0, 0, 0, time.UTC),
		time.Date(2020, 9, 21, 13, 0, 0, 0, time.UTC),
		24*time.Hour,
	)
	require.NoError(t, err)
	require.Equal(t, []TimeseriesEntry{
		{
			Time:  time.Date(2020, 9, 9, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(0),
		},
		{
			Time:  time.Date(2020, 9, 10, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(200),
		},
		{
			Time:  time.Date(2020, 9, 11, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 12, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 13, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 14, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 15, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 16, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 17, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 18, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 19, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 20, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(590),
		},
		{
			Time:  time.Date(2020, 9, 21, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(589),
		},
	}, timeseries)
}

func TestMarketPerformanceTimeseriesCashflows(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	date := func(day int) time.Time {
		return time.Date(2020, 9, day, 12, 0, 0, 0, time.UTC)
	}
	fee := coin.NewAmountFromInt64(10)
	txs := []*TransactionData{
		{
			Timestamp: tt(date(10)),
			Height:    10,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(date(11)),
			Height:    11,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(date(12)),
			Height:    12,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(50),
		},
		{
			Timestamp: tt(date(13)),
			Height:    13,
			Type:      TxTypeSendSelf,
			Amount:    coin.NewAmountFromInt64(20),
			Fee:       &fee,
		},
		{
			Timestamp: tt(date(14)),
			Height:    14,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
			Status:    TxStatusFailed,
		},
	}

	ordered := NewOrderedTransactions(txs)
	timeseries, err := ordered.MarketPerformanceTimeseries(
		time.Date(2020, 9, 10, 13, 0, 0, 0, time.UTC),
		time.Date(2020, 9, 14, 13, 0, 0, 0, time.UTC),
		24*time.Hour,
		testRatesProvider{prices: map[time.Time]float64{
			date(10): 1,
			date(11): 2,
			date(12): 3,
			date(13): 4,
			date(14): 5,
		}},
		"btc",
		"USD",
		big.NewInt(100),
	)
	require.NoError(t, err)
	require.Len(t, timeseries, 5)
	requireRatEqual(t, "1", timeseries[0].NetInvestmentValue)
	requireRatEqual(t, "3", timeseries[1].NetInvestmentValue)
	requireRatEqual(t, "3/2", timeseries[2].NetInvestmentValue)
	requireRatEqual(t, "3/2", timeseries[3].NetInvestmentValue)
	requireRatEqual(t, "3/2", timeseries[4].NetInvestmentValue)
}

func requireRatEqual(t *testing.T, expected string, actual *big.Rat) {
	t.Helper()
	expectedRat, ok := new(big.Rat).SetString(expected)
	require.True(t, ok)
	require.Equal(t, expectedRat, actual)
}

// TestOrderedTransactionsWithFailedTransactions tests that the cumulative balance takes into
// account failed transactions.  Ethereum transactions can be mined and fail anyway due to a too low
// gas limit, in which case the amount is not transferred, but the fees are still paid.
func TestOrderedTransactionsWithFailedTransactions(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	fee := coin.NewAmountFromInt64(1)
	txs := []*TransactionData{
		{
			Timestamp: tt(time.Date(2020, 9, 15, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 10, 12, 0, 0, 0, time.UTC)),
			Height:    10,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(200),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 20, 12, 0, 0, 0, time.UTC)),
			Height:    20,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(300),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 21, 12, 0, 0, 0, time.UTC)),
			Height:    21,
			Type:      TxTypeSendSelf,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
		},
		{
			Timestamp: tt(time.Date(2020, 9, 22, 12, 0, 0, 0, time.UTC)),
			Height:    22,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
			Status:    TxStatusFailed,
		},
		{
			Timestamp: tt(time.Date(2020, 9, 23, 12, 0, 0, 0, time.UTC)),
			Height:    23,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(1000),
			Fee:       &fee,
			Status:    TxStatusFailed,
		},
	}

	ordered := NewOrderedTransactions(txs)
	expectedBalances := []int64{
		598, // failed receive tx, nothing changes
		598, // failed send tx, only fee deducted
		599,
		600,
		300,
		200,
	}
	for i := range ordered {
		require.Equal(t, coin.NewAmountFromInt64(expectedBalances[i]), ordered[i].Balance, i)
	}
}

func requireAmountIsEqualTo(t *testing.T, amount coin.Amount, total int64) {
	t.Helper()
	value, err := amount.Int64()
	require.NoError(t, err)
	require.Equal(t, total, value)
}

func TestOrderedTransactionsDeductedAmount(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	amount := coin.NewAmountFromInt64(100)
	fee := coin.NewAmountFromInt64(10)
	txs := []*TransactionData{
		{
			// Send tx, deductedAmount is amount+fee
			Timestamp: tt(time.Date(2020, 9, 15, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeSend,
			Amount:    amount,
			Fee:       &fee,
		},
		{
			// SendToSelf tx, deductedAmount is equal to just the fee.
			Timestamp: tt(time.Date(2020, 9, 16, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeSendSelf,
			Amount:    amount,
			Fee:       &fee,
		},
		{
			// Recv tx, deductedAmount is empty
			Timestamp: tt(time.Date(2020, 9, 17, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeReceive,
			Amount:    amount,
			Fee:       &fee,
		},
		{
			// Fee is in different unit (e.g. erc20 tx), deductedAmount is the amount but not the fee.
			Timestamp:          tt(time.Date(2020, 9, 17, 12, 0, 0, 0, time.UTC)),
			Height:             15,
			Type:               TxTypeSend,
			FeeIsDifferentUnit: true,
			Amount:             amount,
			Fee:                &fee,
		},
		{
			// timestamp is nil, deductedAmount is still set
			Timestamp: nil,
			Height:    15,
			Type:      TxTypeSend,
			Amount:    amount,
			Fee:       &fee,
		},
	}

	orderedTxs := NewOrderedTransactions(txs)

	requireAmountIsEqualTo(t, orderedTxs[0].DeductedAmount, 110)
	requireAmountIsEqualTo(t, orderedTxs[1].DeductedAmount, 10)
	requireAmountIsEqualTo(t, orderedTxs[2].DeductedAmount, 0)
	requireAmountIsEqualTo(t, orderedTxs[3].DeductedAmount, 100)
	requireAmountIsEqualTo(t, orderedTxs[4].DeductedAmount, 110)
}
