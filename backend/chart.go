// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math"
	"math/big"
	"sort"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

func (backend *Backend) allCoinCodes() []string {
	allCoinCodes := []string{}
	for _, account := range backend.Accounts() {
		if account.Config().Config.Inactive {
			continue
		}
		if account.FatalError() {
			continue
		}
		allCoinCodes = append(allCoinCodes, string(account.Coin().Code()))
	}
	return allCoinCodes
}

// ChartEntry is one data point in the chart timeseries.
type ChartEntry struct {
	Time           int64   `json:"time"`
	Value          float64 `json:"value"`
	FormattedValue string  `json:"formattedValue"`
}

// RatChartEntry exploits composition to extend ChartEntry and save high precision values.
type RatChartEntry struct {
	ChartEntry
	RatValue *big.Rat
}

// ChartPerformance contains portfolio performance metrics for a chart range.
type ChartPerformance struct {
	// MoneyWeightedReturn is the money-weighted return for the range.
	MoneyWeightedReturn *float64 `json:"moneyWeightedReturn"`
}

// ChartPerformanceByDisplay contains portfolio performance metrics for each chart filter.
type ChartPerformanceByDisplay struct {
	Week  ChartPerformance `json:"week"`
	Month ChartPerformance `json:"month"`
	Year  ChartPerformance `json:"year"`
	All   ChartPerformance `json:"all"`
}

// Chart has all data needed to show a time-based chart of their assets to the user.
type Chart struct {
	// If true, we are missing historical exchange rates or block headers needed to compute the
	// chart.
	DataMissing bool `json:"chartDataMissing"`
	// Only valid if DaataMissing is false. Contains the daily points for the chart.
	DataDaily []ChartEntry `json:"chartDataDaily"`
	// Only valid if DaataMissing is false. Contains the hourly points for the chart.
	DataHourly []ChartEntry `json:"chartDataHourly"`
	// Fiat currency of the value in the chart and in the total.
	Fiat string `json:"chartFiat"`
	// Performance metrics for each chart range.
	Performance ChartPerformanceByDisplay `json:"chartPerformance"`
	// Current total value of all assets in the fiat currency. Nil if missing (this is independent
	// of `DataMissing`).
	Total *float64 `json:"chartTotal"`
	// ChartTotal formatted for frontend visualization
	FormattedTotal string `json:"formattedChartTotal"`
	// Only valid if DataMissing is false
	IsUpToDate bool `json:"chartIsUpToDate"`
	// Latest rate timestamp available among all enabled coins.
	LastTimestamp int64 `json:"lastTimestamp"`
}

func (backend *Backend) addChartData(
	coinCode coin.Code,
	fiat string,
	coinDecimals *big.Int,
	timeseries []accounts.TimeseriesEntry,
	chartEntries map[int64]RatChartEntry,
) {
	for _, e := range timeseries {
		price := backend.RatesUpdater().HistoricalPriceAt(
			string(coinCode),
			fiat,
			e.Time)
		timestamp := e.Time.Unix()
		chartEntry := chartEntries[timestamp]

		chartEntry.Time = timestamp
		fiatValue := new(big.Rat).Mul(
			new(big.Rat).SetFrac(
				e.Value.BigInt(),
				coinDecimals,
			),
			new(big.Rat).SetFloat64(price),
		)

		if chartEntry.RatValue == nil {
			chartEntry.RatValue = new(big.Rat).Set(fiatValue)
		} else {
			chartEntry.RatValue.Add(fiatValue, chartEntry.RatValue)
		}
		chartEntries[timestamp] = chartEntry
	}
}

type chartCashFlow struct {
	Time           time.Time
	Value          float64
	ValueAvailable bool
}

type chartWeightedCashFlow struct {
	Value           float64
	RemainingWeight float64
}

func utcRoundedHour(now time.Time) time.Time {
	return now.UTC().Truncate(time.Hour)
}

func hasCashFlowBetween(cashFlows []chartCashFlow, start, end time.Time) bool {
	for _, cashFlow := range cashFlows {
		if cashFlow.Time.After(start) && !cashFlow.Time.After(end) {
			return true
		}
	}
	return false
}

func findPerformanceStartEntry(entries []ChartEntry, from time.Time, cashFlows []chartCashFlow) *ChartEntry {
	if len(entries) == 0 {
		return nil
	}

	startIndex := 0
	if !from.IsZero() {
		startIndex = sort.Search(len(entries), func(i int) bool {
			return entries[i].Time >= from.Unix()
		})
	}

	for i := startIndex; i < len(entries); i++ {
		if entries[i].Value > 0 {
			if i > startIndex && entries[i-1].Value == 0 {
				previousEntry := &entries[i-1]
				if hasCashFlowBetween(cashFlows, time.Unix(previousEntry.Time, 0), time.Unix(entries[i].Time, 0)) {
					return previousEntry
				}
			}
			return &entries[i]
		}
	}

	return nil
}

func chartMoneyWeightedReturnValue(
	logReturn float64,
	beginningValue, endingValue float64,
	cashFlows []chartWeightedCashFlow,
) float64 {
	result := beginningValue*math.Exp(logReturn) - endingValue
	for _, cashFlow := range cashFlows {
		result += cashFlow.Value * math.Exp(cashFlow.RemainingWeight*logReturn)
	}
	return result
}

func chartMoneyWeightedReturnScale(
	beginningValue, endingValue float64,
	cashFlows []chartWeightedCashFlow,
) float64 {
	scale := math.Max(math.Abs(beginningValue), math.Abs(endingValue))
	for _, cashFlow := range cashFlows {
		scale = math.Max(scale, math.Abs(cashFlow.Value))
	}
	return scale
}

func chartHasSignChange(a, b float64) bool {
	return (a < 0 && b > 0) || (a > 0 && b < 0)
}

// Solve EV = BV*(1+r) + sum(CF_i*(1+r)^remaining_i) in log-return space.
func solveChartMoneyWeightedReturn(
	beginningValue, endingValue float64,
	cashFlows []chartWeightedCashFlow,
) *float64 {
	const (
		initialLogReturnStep = 0.01
		maxAbsLogReturn      = 50.0
		maxIterations        = 200
	)

	scale := chartMoneyWeightedReturnScale(beginningValue, endingValue, cashFlows)
	tolerance := math.Max(scale*1e-12, 1e-12)

	valueAtZero := chartMoneyWeightedReturnValue(0, beginningValue, endingValue, cashFlows)
	if math.Abs(valueAtZero) <= tolerance {
		result := 0.0
		return &result
	}

	var lowerLogReturn, upperLogReturn float64
	var lowerValue float64
	foundBracket := false

	previousPositiveLogReturn := 0.0
	previousPositiveValue := valueAtZero
	previousNegativeLogReturn := 0.0
	previousNegativeValue := valueAtZero
	for step := initialLogReturnStep; ; step *= 2 {
		currentStep := math.Min(step, maxAbsLogReturn)
		positiveLogReturn := currentStep
		positiveValue := chartMoneyWeightedReturnValue(
			positiveLogReturn,
			beginningValue,
			endingValue,
			cashFlows,
		)
		if math.IsNaN(positiveValue) || math.IsInf(positiveValue, 0) {
			return nil
		}
		if positiveValue == 0 {
			result := math.Expm1(positiveLogReturn)
			return &result
		}
		if chartHasSignChange(previousPositiveValue, positiveValue) {
			lowerLogReturn = previousPositiveLogReturn
			upperLogReturn = positiveLogReturn
			lowerValue = previousPositiveValue
			foundBracket = true
			break
		}
		previousPositiveLogReturn = positiveLogReturn
		previousPositiveValue = positiveValue

		negativeLogReturn := -currentStep
		negativeValue := chartMoneyWeightedReturnValue(
			negativeLogReturn,
			beginningValue,
			endingValue,
			cashFlows,
		)
		if math.IsNaN(negativeValue) || math.IsInf(negativeValue, 0) {
			return nil
		}
		if negativeValue == 0 {
			result := math.Expm1(negativeLogReturn)
			return &result
		}
		if chartHasSignChange(negativeValue, previousNegativeValue) {
			lowerLogReturn = negativeLogReturn
			upperLogReturn = previousNegativeLogReturn
			lowerValue = negativeValue
			foundBracket = true
			break
		}
		previousNegativeLogReturn = negativeLogReturn
		previousNegativeValue = negativeValue

		if currentStep == maxAbsLogReturn {
			break
		}
	}

	if !foundBracket {
		return nil
	}

	for i := 0; i < maxIterations; i++ {
		midLogReturn := (lowerLogReturn + upperLogReturn) / 2
		midValue := chartMoneyWeightedReturnValue(
			midLogReturn,
			beginningValue,
			endingValue,
			cashFlows,
		)
		if math.IsNaN(midValue) || math.IsInf(midValue, 0) {
			return nil
		}
		if midValue == 0 {
			result := math.Expm1(midLogReturn)
			if math.IsNaN(result) || math.IsInf(result, 0) {
				return nil
			}
			return &result
		}
		if chartHasSignChange(lowerValue, midValue) {
			upperLogReturn = midLogReturn
		} else {
			lowerLogReturn = midLogReturn
			lowerValue = midValue
		}
	}

	result := math.Expm1((lowerLogReturn + upperLogReturn) / 2)
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return nil
	}
	return &result
}

func calculateMoneyWeightedReturn(
	beginningValue, endingValue float64,
	startTime, endTime time.Time,
	cashFlows []chartCashFlow,
) *float64 {
	if beginningValue < 0 || endingValue < 0 || !endTime.After(startTime) {
		return nil
	}

	periodSeconds := endTime.Sub(startTime).Seconds()
	if periodSeconds <= 0 {
		return nil
	}

	hasCapitalAtRisk := beginningValue > 0
	weightedCashFlows := []chartWeightedCashFlow{}
	for _, cashFlow := range cashFlows {
		if !cashFlow.Time.After(startTime) || cashFlow.Time.After(endTime) {
			continue
		}
		if !cashFlow.ValueAvailable {
			return nil
		}

		remainingWeight := endTime.Sub(cashFlow.Time).Seconds() / periodSeconds
		if cashFlow.Value > 0 && remainingWeight > 0 {
			hasCapitalAtRisk = true
		}
		weightedCashFlows = append(weightedCashFlows, chartWeightedCashFlow{
			Value:           cashFlow.Value,
			RemainingWeight: remainingWeight,
		})
	}

	if !hasCapitalAtRisk {
		return nil
	}

	return solveChartMoneyWeightedReturn(beginningValue, endingValue, weightedCashFlows)
}

func (backend *Backend) historicalOrLatestPriceAt(asset coin.Coin, fiat string, at time.Time) (float64, bool) {
	price := backend.RatesUpdater().HistoricalPriceAt(string(asset.Code()), fiat, at)
	if price != 0 {
		return price, true
	}

	latestRatesTime := backend.RatesUpdater().HistoryLatestTimestampCoin(string(asset.Code()))
	if (latestRatesTime.IsZero() || latestRatesTime.Before(at)) && time.Since(at) < 2*time.Hour {
		latestPrice, err := backend.RatesUpdater().LatestPriceForPair(asset.Unit(false), fiat)
		if err == nil && latestPrice != 0 {
			return latestPrice, true
		}
	}

	return 0, false
}

func (backend *Backend) fiatValueAt(asset coin.Coin, amount coin.Amount, fiat string, at time.Time) (float64, bool) {
	price, ok := backend.historicalOrLatestPriceAt(asset, fiat, at)
	if !ok {
		return 0, false
	}

	valueRat := new(big.Rat).Mul(
		new(big.Rat).SetFrac(amount.BigInt(), coin.DecimalsExp(asset, false)),
		new(big.Rat).SetFloat64(price),
	)
	value, _ := valueRat.Float64()
	return value, true
}

func (backend *Backend) appendChartCashFlows(
	account accounts.Interface,
	fiat string,
	txs accounts.OrderedTransactions,
	flows []chartCashFlow,
) []chartCashFlow {
	for _, tx := range txs {
		if tx.Timestamp == nil || tx.Height <= 0 || tx.Status == accounts.TxStatusFailed {
			continue
		}

		var multiplier float64
		switch tx.Type {
		case accounts.TxTypeReceive:
			multiplier = 1
		case accounts.TxTypeSend:
			multiplier = -1
		default:
			continue
		}

		value, ok := backend.fiatValueAt(account.Coin(), tx.Amount, fiat, *tx.Timestamp)
		if !ok {
			flows = append(flows, chartCashFlow{
				Time:           *tx.Timestamp,
				ValueAvailable: false,
			})
			continue
		}

		flows = append(flows, chartCashFlow{
			Time:           *tx.Timestamp,
			Value:          multiplier * value,
			ValueAvailable: true,
		})
	}
	return flows
}

func chartBalanceForPerformance(txs accounts.OrderedTransactions) coin.Amount {
	for _, tx := range txs {
		if tx.Height > 0 {
			return tx.Balance
		}
	}
	return coin.NewAmountFromInt64(0)
}

func chartPerformanceForRange(
	entries []ChartEntry,
	cashFlows []chartCashFlow,
	rangeStart, endTime time.Time,
	endingValue float64,
) ChartPerformance {
	startEntry := findPerformanceStartEntry(entries, rangeStart, cashFlows)
	if startEntry == nil {
		return ChartPerformance{}
	}

	return ChartPerformance{
		MoneyWeightedReturn: calculateMoneyWeightedReturn(
			startEntry.Value,
			endingValue,
			time.Unix(startEntry.Time, 0),
			endTime,
			cashFlows,
		),
	}
}

func computeChartPerformance(
	now time.Time,
	chartDataDaily, chartDataHourly []ChartEntry,
	cashFlows []chartCashFlow,
	chartTotal *float64,
) ChartPerformanceByDisplay {
	if chartTotal == nil {
		return ChartPerformanceByDisplay{}
	}

	roundedHour := utcRoundedHour(now)
	roundedDay := roundedHour.Truncate(24 * time.Hour)

	return ChartPerformanceByDisplay{
		Week: chartPerformanceForRange(
			chartDataHourly,
			cashFlows,
			roundedHour.AddDate(0, 0, -7),
			now,
			*chartTotal,
		),
		Month: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			roundedDay.AddDate(0, -1, 0),
			now,
			*chartTotal,
		),
		Year: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			roundedDay.AddDate(-1, 0, 0),
			now,
			*chartTotal,
		),
		All: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			time.Time{},
			now,
			*chartTotal,
		),
	}
}

// ChartData assembles chart data for all active accounts.
func (backend *Backend) ChartData() (*Chart, error) {
	// If true, we are missing headers or historical conversion rates necessary to compute the chart
	// data,
	chartDataMissing := false

	// key: unix timestamp.
	chartEntriesDaily := map[int64]RatChartEntry{}
	chartEntriesHourly := map[int64]RatChartEntry{}

	fiat := backend.Config().AppConfig().Backend.MainFiat
	now := time.Now()

	// Chart data until this point in time.
	until := backend.RatesUpdater().HistoryLatestTimestampFiat(backend.allCoinCodes(), fiat)
	if until.IsZero() {
		chartDataMissing = true
		backend.log.Info("ChartDataMissing, until is zero")
	}
	isUpToDate := time.Since(until) < 2*time.Hour
	lastTimestamp := until.UnixMilli()

	currentTotal := new(big.Rat)
	performanceTotal := new(big.Rat)
	currentTotalMissing := false
	chartCashFlows := []chartCashFlow{}
	// Total number of transactions across all active accounts.
	totalNumberOfTransactions := 0
	for _, account := range backend.Accounts() {
		if account.Config().Config.Inactive {
			continue
		}
		if account.FatalError() {
			continue
		}
		err := account.Initialize()
		if err != nil {
			return nil, err
		}
		txs, err := account.Transactions()
		if err != nil {
			return nil, err
		}
		totalNumberOfTransactions += len(txs)
		chartCashFlows = backend.appendChartCashFlows(account, fiat, txs, chartCashFlows)

		coinDecimals := coin.DecimalsExp(account.Coin(), false)

		// HACK: The latest prices might deviate from the latest historical prices (which can lag
		// behind by many minutes), which results in different total balances in the chart and the
		// summary table.
		//
		// As a workaround, we call accountFiatBalance, which computes the total based on the latest rates.
		fiatValue, err := backend.accountFiatBalance(account, fiat)
		if err != nil {
			currentTotalMissing = true
			return nil, err
		}
		currentTotal.Add(currentTotal, fiatValue)

		performanceFiatValue, err := backend.convertToFiat(account.Coin(), chartBalanceForPerformance(txs), fiat)
		if err != nil {
			currentTotalMissing = true
			return nil, err
		}
		performanceTotal.Add(performanceTotal, performanceFiatValue)

		// Below here, only chart data is being computed.
		if chartDataMissing {
			continue
		}

		// Time from which the chart turns from daily points to hourly points.
		hourlyFrom := now.AddDate(0, 0, -7).Truncate(24 * time.Hour)

		earliestPriceAvailable := backend.RatesUpdater().HistoryEarliestTimestamp(
			string(account.Coin().Code()),
			fiat)

		earliestTxTime, err := txs.EarliestTime()
		if errp.Cause(err) == errors.ErrNotAvailable {
			backend.log.WithField("coin", account.Coin().Code()).Info("ChartDataMissing/earliestTxtime")
			chartDataMissing = true
			continue
		}
		if err != nil {
			return nil, err
		}

		if earliestTxTime.IsZero() {
			// Ignore the chart for this account, there is no timed transaction.
			continue
		}
		if earliestPriceAvailable.IsZero() || earliestTxTime.Before(earliestPriceAvailable) {
			chartDataMissing = true
			backend.log.
				WithField("coin", account.Coin().Code()).
				WithField("earliestTxTime", earliestTxTime).
				WithField("earliestPriceAvailable", earliestPriceAvailable).
				Info("ChartDataMissing")
			continue
		}

		timeseriesDaily, err := txs.Timeseries(
			earliestTxTime.Truncate(24*time.Hour),
			until,
			24*time.Hour,
		)
		if errp.Cause(err) == errors.ErrNotAvailable {
			backend.log.WithField("coin", account.Coin().Code()).Info("ChartDataMissing")
			chartDataMissing = true
			continue
		}
		if err != nil {
			return nil, err
		}
		timeseriesHourly, err := txs.Timeseries(
			hourlyFrom,
			until,
			time.Hour,
		)
		if errp.Cause(err) == errors.ErrNotAvailable {
			backend.log.WithField("coin", account.Coin().Code()).Info("ChartDataMissing")
			chartDataMissing = true
			continue
		}
		if err != nil {
			return nil, err
		}

		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesDaily, chartEntriesDaily)
		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesHourly, chartEntriesHourly)

	}

	toSortedSlice := func(s map[int64]RatChartEntry, fiat string) []ChartEntry {
		result := make([]ChartEntry, len(s))
		i := 0
		// Discard the RatValue, which is not used anymore
		for _, entry := range s {
			floatValue, _ := entry.RatValue.Float64()
			result[i] = ChartEntry{
				Time:           entry.Time,
				Value:          floatValue,
				FormattedValue: coin.FormatAsCurrency(entry.RatValue, fiat),
			}
			i++
		}
		sort.Slice(result, func(i, j int) bool { return result[i].Time < result[j].Time })

		// Manually add the last point with the current total, to make the last point match.
		// The last point might not match the account total otherwise because:
		// 1) unconfirmed tx are not in the timeseries
		// 2) coingecko might not have rates yet up until after all transactions, so they'd also be
		// missing from the timeseries (`until` is up to 2h in the past).
		if isUpToDate && !currentTotalMissing {
			total, _ := currentTotal.Float64()
			result = append(result, ChartEntry{
				Time:           now.Unix(),
				Value:          total,
				FormattedValue: coin.FormatAsCurrency(currentTotal, fiat),
			})
		}
		// Truncate leading zeroes, if there are any keep the first one to start the chart with 0
		for i, e := range result {
			if e.Value > 0 {
				if i == 0 {
					return result
				}
				return result[i-1:]
			}
		}
		// Everything was zeroes.
		// Keep historical zero-only series so wallets with transactions
		// still render a chart instead of looking empty.
		if len(s) > 0 {
			return result
		}
		return []ChartEntry{}
	}

	// Even if we are still gathering data (exchange rates, block headers), we know the result
	// already if there are no transactions. This avoids showing the user a message that we are
	// gathering data, only to show nothing in the end.
	if chartDataMissing && totalNumberOfTransactions == 0 {
		backend.log.Info("ChartDataMissing forced to false")
		chartDataMissing = false
	}

	var chartTotal *float64
	var chartPerformanceTotal *float64
	var formattedChartTotal string
	if !currentTotalMissing {
		tot, _ := currentTotal.Float64()
		chartTotal = &tot
		formattedChartTotal = coin.FormatAsCurrency(currentTotal, fiat)
		performanceTot, _ := performanceTotal.Float64()
		chartPerformanceTotal = &performanceTot
	}

	chartDataDaily := toSortedSlice(chartEntriesDaily, fiat)
	chartDataHourly := toSortedSlice(chartEntriesHourly, fiat)
	sort.Slice(chartCashFlows, func(i, j int) bool {
		return chartCashFlows[i].Time.Before(chartCashFlows[j].Time)
	})

	chartPerformance := ChartPerformanceByDisplay{}
	if !chartDataMissing {
		chartPerformance = computeChartPerformance(
			now,
			chartDataDaily,
			chartDataHourly,
			chartCashFlows,
			chartPerformanceTotal,
		)
	}

	return &Chart{
		DataMissing:    chartDataMissing,
		DataDaily:      chartDataDaily,
		DataHourly:     chartDataHourly,
		Fiat:           fiat,
		Performance:    chartPerformance,
		Total:          chartTotal,
		FormattedTotal: formattedChartTotal,
		IsUpToDate:     isUpToDate,
		LastTimestamp:  lastTimestamp,
	}, nil
}
