// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"math/big"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func transactionFilterTestCoin() coinMock.CoinMock {
	return coinMock.CoinMock{
		UnitFunc:     func(bool) string { return "BTC" },
		DecimalsFunc: func(bool) uint { return 8 },
		CodeFunc:     func() coin.Code { return coin.CodeBTC },
		FormatAmountFunc: func(amount coin.Amount, _ bool) string {
			return new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(1e8)).FloatString(8)
		},
		GetFormatUnitFunc: func(bool) string { return "BTC" },
	}
}

func transactionFilterTime(year int, month time.Month, day, hour int) *time.Time {
	value := time.Date(year, month, day, hour, 0, 0, 0, time.UTC)
	return &value
}

func transactionFilter(t *testing.T, params TransactionFilterParams) TransactionFilter {
	t.Helper()
	filter, err := NewTransactionFilter(params, time.UTC)
	require.NoError(t, err)
	return filter
}

func transactionIDs(txs OrderedTransactions) []string {
	result := make([]string, len(txs))
	for index, tx := range txs {
		result[index] = tx.InternalID
	}
	return result
}

func TestNewTransactionFilterRejectsInvalidParams(t *testing.T) {
	testCases := []TransactionFilterParams{
		{FromDate: "2026-02-30"},
		{Type: "stake"},
		{AmountMin: "abc"},
		{AmountMax: "-1"},
		{AmountMin: "1", AmountUnit: "fiat"},
		{AmountUnit: "sats"},
		{SortBy: "status"},
		{SortDir: "sideways"},
	}
	for _, params := range testCases {
		_, err := NewTransactionFilter(params, time.UTC)
		require.Error(t, err, params)
	}
}

func TestTransactionFilterMatchesDateTypeAndCoinAmount(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	txs := OrderedTransactions{
		{
			InternalID:     "matching-send",
			Timestamp:      transactionFilterTime(2026, time.July, 10, 12),
			Type:           TxTypeSend,
			Amount:         coin.NewAmountFromInt64(50_000_000),
			DeductedAmount: coin.NewAmountFromInt64(50_010_000),
		},
		{
			InternalID: "receive",
			Timestamp:  transactionFilterTime(2026, time.July, 10, 12),
			Type:       TxTypeReceive,
			Amount:     coin.NewAmountFromInt64(50_010_000),
		},
		{
			InternalID:     "too-early",
			Timestamp:      transactionFilterTime(2026, time.June, 30, 23),
			Type:           TxTypeSend,
			Amount:         coin.NewAmountFromInt64(50_000_000),
			DeductedAmount: coin.NewAmountFromInt64(50_010_000),
		},
		{
			InternalID:     "too-large",
			Timestamp:      transactionFilterTime(2026, time.July, 31, 23),
			Type:           TxTypeSend,
			Amount:         coin.NewAmountFromInt64(60_000_000),
			DeductedAmount: coin.NewAmountFromInt64(60_010_000),
		},
	}
	filter := transactionFilter(t, TransactionFilterParams{
		FromDate:   "2026-07-01",
		ToDate:     "2026-07-31",
		Type:       "send",
		AmountMin:  "0.5001",
		AmountMax:  "0.6",
		AmountUnit: "coin",
	})

	result := filter.Apply(txs, &testCoin, nil, time.Date(2026, time.July, 15, 12, 0, 0, 0, time.UTC))

	require.Equal(t, []string{"matching-send"}, transactionIDs(result))
}

func TestTransactionFilterTreatsPendingTransactionAsNow(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	txs := OrderedTransactions{{InternalID: "pending", Type: TxTypeReceive, Amount: coin.NewAmountFromInt64(1)}}
	now := time.Date(2026, time.July, 15, 10, 0, 0, 0, time.UTC)

	matching := transactionFilter(t, TransactionFilterParams{FromDate: "2026-07-14", ToDate: "2026-07-15"})
	excluded := transactionFilter(t, TransactionFilterParams{ToDate: "2026-07-10"})

	require.Equal(t, []string{"pending"}, transactionIDs(matching.Apply(txs, &testCoin, nil, now)))
	require.Empty(t, excluded.Apply(txs, &testCoin, nil, now))
}

func TestTransactionFilterMatchesHistoricalFiatAmount(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	rateUpdater := rates.MockRateUpdater()
	defer rateUpdater.Stop()
	timestamp := time.Unix(1598832062, 0)
	txs := OrderedTransactions{{
		InternalID: "half-btc",
		Timestamp:  &timestamp,
		Type:       TxTypeReceive,
		Amount:     coin.NewAmountFromInt64(50_000_000),
	}}

	matching := transactionFilter(t, TransactionFilterParams{
		AmountMin: "0.50", AmountMax: "0.50", AmountUnit: "fiat", Fiat: "USD",
	})
	missingRate := transactionFilter(t, TransactionFilterParams{
		AmountMin: "0.01", AmountUnit: "fiat", Fiat: "JPY",
	})

	require.Equal(t, []string{"half-btc"}, transactionIDs(matching.Apply(txs, &testCoin, rateUpdater, time.Now())))
	require.Empty(t, missingRate.Apply(txs, &testCoin, rateUpdater, time.Now()))
}

func TestTransactionFilterSortsTransactions(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	txs := OrderedTransactions{
		{InternalID: "receive", Timestamp: transactionFilterTime(2026, time.July, 1, 12), Type: TxTypeReceive, Amount: coin.NewAmountFromInt64(50_000_000)},
		{InternalID: "send", Timestamp: transactionFilterTime(2026, time.July, 20, 12), Type: TxTypeSend, DeductedAmount: coin.NewAmountFromInt64(200_000_000)},
		{InternalID: "self", Timestamp: nil, Type: TxTypeSendSelf, DeductedAmount: coin.NewAmountFromInt64(10_000_000)},
	}
	testCases := []struct {
		name     string
		params   TransactionFilterParams
		expected []string
	}{
		{name: "date descending", params: TransactionFilterParams{SortBy: "date", SortDir: "desc"}, expected: []string{"self", "send", "receive"}},
		{name: "date ascending", params: TransactionFilterParams{SortBy: "date", SortDir: "asc"}, expected: []string{"receive", "send", "self"}},
		{name: "amount ascending", params: TransactionFilterParams{SortBy: "amount", SortDir: "asc"}, expected: []string{"self", "receive", "send"}},
		{name: "amount descending", params: TransactionFilterParams{SortBy: "amount", SortDir: "desc"}, expected: []string{"send", "receive", "self"}},
		{name: "type ascending", params: TransactionFilterParams{SortBy: "type", SortDir: "asc"}, expected: []string{"receive", "send", "self"}},
		{name: "type descending", params: TransactionFilterParams{SortBy: "type", SortDir: "desc"}, expected: []string{"self", "send", "receive"}},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			filter := transactionFilter(t, testCase.params)
			result := filter.Apply(txs, &testCoin, nil, time.Now())
			require.Equal(t, testCase.expected, transactionIDs(result))
		})
	}
}

func TestTransactionFilterKeepsInputOrderForSortTies(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	txs := OrderedTransactions{
		{InternalID: "first", Type: TxTypeReceive, Amount: coin.NewAmountFromInt64(1)},
		{InternalID: "second", Type: TxTypeReceive, Amount: coin.NewAmountFromInt64(1)},
	}
	filter := transactionFilter(t, TransactionFilterParams{SortBy: "type", SortDir: "asc"})

	require.Equal(t, []string{"first", "second"}, transactionIDs(filter.Apply(txs, &testCoin, nil, time.Now())))
	require.Equal(t, []*TransactionData{txs[0], txs[1]}, []*TransactionData(txs))
}

func TestTransactionFilterUsesExactCoinAmounts(t *testing.T) {
	testCoin := transactionFilterTestCoin()
	largeAmount := coin.NewAmount(new(big.Int).SetUint64(9_007_199_254_740_993))
	txs := OrderedTransactions{{InternalID: "large", Type: TxTypeReceive, Amount: largeAmount}}
	filter := transactionFilter(t, TransactionFilterParams{
		AmountMin: "90071992.54740993", AmountMax: "90071992.54740993", AmountUnit: "coin",
	})

	require.Equal(t, []string{"large"}, transactionIDs(filter.Apply(txs, &testCoin, nil, time.Now())))
}

func TestTransactionFilterUsesCoinDisplayUnit(t *testing.T) {
	satsCoin := transactionFilterTestCoin()
	satsCoin.FormatAmountFunc = func(amount coin.Amount, _ bool) string {
		return amount.BigInt().String()
	}
	txs := OrderedTransactions{{
		InternalID: "half-btc",
		Type:       TxTypeReceive,
		Amount:     coin.NewAmountFromInt64(50_000_000),
	}}
	filter := transactionFilter(t, TransactionFilterParams{
		AmountMin: "50000000", AmountMax: "50000000", AmountUnit: "coin",
	})

	require.Equal(t, []string{"half-btc"}, transactionIDs(filter.Apply(txs, &satsCoin, nil, time.Now())))
}
