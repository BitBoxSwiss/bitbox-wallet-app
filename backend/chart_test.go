// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	configpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestCalculateMoneyWeightedReturnNoCashFlows(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)

	result := calculateMoneyWeightedReturn(100, 110, startTime, endTime, nil)

	require.NotNil(t, result)
	require.InDelta(t, 0.1, *result, 1e-12)
}

func TestCalculateMoneyWeightedReturnWithCashFlows(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)
	cashFlows := []chartCashFlow{
		{
			Time:           startTime.Add(12 * time.Hour),
			Value:          50,
			ValueAvailable: true,
		},
	}

	result := calculateMoneyWeightedReturn(100, 300, startTime, endTime, cashFlows)

	require.NotNil(t, result)
	require.InDelta(t, 1.25, *result, 1e-12)
}

func TestChartBalanceForPerformanceUsesLatestConfirmedBalance(t *testing.T) {
	timeAt := func(t time.Time) *time.Time { return &t }
	ordered := accounts.NewOrderedTransactions([]*accounts.TransactionData{
		{
			Timestamp: timeAt(time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)),
			Height:    10,
			Type:      accounts.TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			CreatedTimestamp: timeAt(time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC)),
			Height:           0,
			Type:             accounts.TxTypeReceive,
			Amount:           coin.NewAmountFromInt64(50),
		},
		{
			CreatedTimestamp: timeAt(time.Date(2026, time.January, 3, 0, 0, 0, 0, time.UTC)),
			Height:           0,
			Type:             accounts.TxTypeSend,
			Amount:           coin.NewAmountFromInt64(25),
		},
	})

	balance, err := chartBalanceForPerformance(ordered).Int64()

	require.NoError(t, err)
	require.Equal(t, int64(100), balance)
}

func TestChartDataUsesAvailableBalanceForVisibleTotal(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	backend.ratesUpdater.Stop()
	backend.ratesUpdater = rates.MockRateUpdater()
	defer backend.Close()

	timeAt := func(t time.Time) *time.Time { return &t }
	confirmedAt := time.Unix(1598918700, 0)
	unconfirmedAt := confirmedAt.Add(time.Hour)
	txs := accounts.NewOrderedTransactions([]*accounts.TransactionData{
		{
			Timestamp: timeAt(confirmedAt),
			Height:    10,
			Type:      accounts.TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100000000),
		},
		{
			CreatedTimestamp: timeAt(unconfirmedAt),
			Height:           0,
			Type:             accounts.TxTypeSend,
			Amount:           coin.NewAmountFromInt64(25000000),
			Status:           accounts.TxStatusPending,
		},
	})

	accountConfig := &accounts.AccountConfig{
		Config: &configpkg.Account{
			CoinCode:            coin.CodeBTC,
			HiddenBecauseUnused: true,
		},
	}
	account := &accountsMocks.InterfaceMock{
		BalanceFunc: func() (*accounts.Balance, error) {
			return accounts.NewBalance(coin.NewAmountFromInt64(75000000), coin.NewAmountFromInt64(0)), nil
		},
		CloseFunc: func() {},
		CoinFunc: func() coin.Coin {
			return backend.coins[coin.CodeBTC]
		},
		ConfigFunc: func() *accounts.AccountConfig {
			return accountConfig
		},
		FatalErrorFunc: func() bool {
			return false
		},
		InitializeFunc: func() error {
			return nil
		},
		TransactionsFunc: func() (accounts.OrderedTransactions, error) {
			return txs, nil
		},
	}
	backend.accounts = AccountsList{account}

	chart, err := backend.ChartData()

	require.NoError(t, err)
	require.NotNil(t, chart.Total)
	require.InDelta(t, 15.75, *chart.Total, 1e-12)
}

func TestComputeChartPerformanceDailyRangesUseMidnightBoundary(t *testing.T) {
	now := time.Date(2026, time.January, 31, 15, 30, 0, 0, time.UTC)
	chartTotal := 110.0
	chartDataDaily := []ChartEntry{
		{
			Time:  time.Date(2025, time.January, 31, 0, 0, 0, 0, time.UTC).Unix(),
			Value: 50,
		},
		{
			Time:  time.Date(2025, time.February, 1, 0, 0, 0, 0, time.UTC).Unix(),
			Value: 75,
		},
		{
			Time:  time.Date(2025, time.December, 31, 0, 0, 0, 0, time.UTC).Unix(),
			Value: 100,
		},
		{
			Time:  time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC).Unix(),
			Value: 200,
		},
	}

	performance := computeChartPerformance(now, chartDataDaily, nil, nil, &chartTotal)

	require.NotNil(t, performance.Month.MoneyWeightedReturn)
	require.InDelta(t, 0.1, *performance.Month.MoneyWeightedReturn, 1e-12)
	require.NotNil(t, performance.Year.MoneyWeightedReturn)
	require.InDelta(t, 1.2, *performance.Year.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeUsesFirstPositiveEntry(t *testing.T) {
	now := time.Date(2026, time.January, 4, 12, 0, 0, 0, time.UTC)
	entries := []ChartEntry{
		{Time: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC).Unix(), Value: 0},
		{Time: time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC).Unix(), Value: 0},
		{Time: time.Date(2026, time.January, 3, 0, 0, 0, 0, time.UTC).Unix(), Value: 100},
	}

	performance := chartPerformanceForRange(entries, nil, time.Time{}, now, 110)

	require.NotNil(t, performance.MoneyWeightedReturn)
	require.InDelta(t, 0.1, *performance.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeIncludesInitialCashFlowBeforeFirstPositiveEntry(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)
	entries := []ChartEntry{
		{Time: startTime.Unix(), Value: 0},
		{Time: endTime.Unix(), Value: 110},
	}
	cashFlows := []chartCashFlow{
		{
			Time:           startTime.Add(12 * time.Hour),
			Value:          100,
			ValueAvailable: true,
		},
	}

	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, 110)

	require.NotNil(t, performance.MoneyWeightedReturn)
	require.InDelta(t, 0.21, *performance.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeReturnsNilWhenCashFlowValueUnavailable(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)
	entries := []ChartEntry{
		{Time: startTime.Unix(), Value: 100},
	}
	cashFlows := []chartCashFlow{
		{
			Time:           startTime.Add(12 * time.Hour),
			ValueAvailable: false,
		},
	}

	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, 110)

	require.Nil(t, performance.MoneyWeightedReturn)
}
