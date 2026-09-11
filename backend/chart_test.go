// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	configpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestChartCoinCodesIncludesBitcoinForLightning(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.NoError(t, b.lightning.SetAccount(&configpkg.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))

	require.Equal(t, []string{string(coin.CodeBTC)}, b.chartCoinCodes())
}

func TestCalculateMoneyWeightedReturnNoCashFlows(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)
	// One of the bracket search's doubled step sizes, to exercise roots found
	// exactly at a sampled point.
	const exactSearchLogReturn = 0.16

	for _, test := range []struct {
		name        string
		endingValue float64
		expected    float64
	}{
		{name: "zero return", endingValue: 100, expected: 0},
		{name: "positive return", endingValue: 110, expected: 0.1},
		{name: "negative return", endingValue: 75, expected: -0.25},
		{
			name:        "exact positive search point",
			endingValue: 100 * math.Exp(exactSearchLogReturn),
			expected:    math.Expm1(exactSearchLogReturn),
		},
		{
			name:        "exact negative search point",
			endingValue: 100 * math.Exp(-exactSearchLogReturn),
			expected:    math.Expm1(-exactSearchLogReturn),
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			result := calculateMoneyWeightedReturn(100, test.endingValue, startTime, endTime, nil)

			require.NotNil(t, result)
			require.InDelta(t, test.expected, *result, 1e-12)
		})
	}
}

func TestSolveChartMoneyWeightedReturnExpandsSearchInBothDirections(t *testing.T) {
	// In terms of y = exp(logReturn/3), this equation has roots at 0.9, 1.5,
	// and 2. The negative-return root at y=0.9 is bracketed before either
	// positive-return root when the search expands in both directions.
	result := solveChartMoneyWeightedReturn(
		1,
		2.7,
		[]chartWeightedCashFlow{
			{Value: -4.4, RemainingWeight: 2.0 / 3.0},
			{Value: 6.15, RemainingWeight: 1.0 / 3.0},
		},
	)

	require.NotNil(t, result)
	require.InDelta(t, -0.271, *result, 1e-12)
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

func TestComputeChartPerformanceDailyRangesUseCurrentUTCHourBoundary(t *testing.T) {
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

	require.NotNil(t, performance.Month.StartTimestamp)
	require.Equal(t, time.Date(2025, time.December, 31, 15, 0, 0, 0, time.UTC).Unix(), *performance.Month.StartTimestamp)
	require.NotNil(t, performance.Month.MoneyWeightedReturn)
	require.InDelta(t, -0.45, *performance.Month.MoneyWeightedReturn, 1e-12)
	require.NotNil(t, performance.Year.StartTimestamp)
	require.Equal(t, time.Date(2025, time.January, 31, 15, 0, 0, 0, time.UTC).Unix(), *performance.Year.StartTimestamp)
	require.NotNil(t, performance.Year.MoneyWeightedReturn)
	require.InDelta(t, 110.0/75.0-1, *performance.Year.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeUsesFirstPositiveEntry(t *testing.T) {
	now := time.Date(2026, time.January, 4, 12, 0, 0, 0, time.UTC)
	entries := []ChartEntry{
		{Time: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC).Unix(), Value: 0},
		{Time: time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC).Unix(), Value: 0},
		{Time: time.Date(2026, time.January, 3, 0, 0, 0, 0, time.UTC).Unix(), Value: 100},
	}

	endingValue := 110.0
	performance := chartPerformanceForRange(entries, nil, time.Time{}, now, &endingValue)

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

	endingValue := 110.0
	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, &endingValue)

	require.NotNil(t, performance.MoneyWeightedReturn)
	require.InDelta(t, 0.21, *performance.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeIncludesCashFlowOnlyInvestmentPeriod(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(24 * time.Hour)
	entries := []ChartEntry{
		{Time: startTime.Unix(), Value: 0},
		{Time: endTime.Unix(), Value: 0},
	}
	cashFlows := []chartCashFlow{
		{
			Time:           startTime.Add(6 * time.Hour),
			Value:          100,
			ValueAvailable: true,
		},
		{
			Time:           startTime.Add(18 * time.Hour),
			Value:          -110,
			ValueAvailable: true,
		},
	}
	endingValue := 0.0

	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, &endingValue)

	require.NotNil(t, performance.MoneyWeightedReturn)
	require.InDelta(t, 0.21, *performance.MoneyWeightedReturn, 1e-12)
}

func TestChartPerformanceForRangeIncludesEarlierClosedInvestmentPeriod(t *testing.T) {
	startTime := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.Add(4 * 24 * time.Hour)
	entries := []ChartEntry{
		{Time: startTime.Unix(), Value: 0},
		{Time: startTime.Add(24 * time.Hour).Unix(), Value: 0},
		{Time: startTime.Add(2 * 24 * time.Hour).Unix(), Value: 0},
		{Time: startTime.Add(3 * 24 * time.Hour).Unix(), Value: 100},
	}
	const expectedReturn = 0.1
	growthFactor := 1 + expectedReturn
	cashFlows := []chartCashFlow{
		{
			Time:           startTime.Add(6 * time.Hour),
			Value:          100,
			ValueAvailable: true,
		},
		{
			Time:           startTime.Add(18 * time.Hour),
			Value:          -100 * math.Pow(growthFactor, 0.125),
			ValueAvailable: true,
		},
		{
			Time:           startTime.Add(60 * time.Hour),
			Value:          100,
			ValueAvailable: true,
		},
	}
	endingValue := 100 * math.Pow(growthFactor, 0.375)

	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, &endingValue)

	require.NotNil(t, performance.MoneyWeightedReturn)
	require.InDelta(t, expectedReturn, *performance.MoneyWeightedReturn, 1e-12)
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

	endingValue := 110.0
	performance := chartPerformanceForRange(entries, cashFlows, time.Time{}, endTime, &endingValue)

	require.Nil(t, performance.MoneyWeightedReturn)
}
