// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math"
	"math/big"
	"sort"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

// ChartPerformance contains portfolio performance metrics for a chart range.
type ChartPerformance struct {
	// MoneyWeightedReturn is the money-weighted return for the range.
	MoneyWeightedReturn *float64 `json:"moneyWeightedReturn"`
	// StartTimestamp is the canonical start of the chart range. It is nil for the all-time range.
	StartTimestamp *int64 `json:"startTimestamp"`
}

// ChartPerformanceByDisplay contains portfolio performance metrics for each chart filter.
type ChartPerformanceByDisplay struct {
	Week  ChartPerformance `json:"week"`
	Month ChartPerformance `json:"month"`
	Year  ChartPerformance `json:"year"`
	All   ChartPerformance `json:"all"`
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
	if startIndex == len(entries) {
		return nil
	}

	periodStartEntry := &entries[startIndex]
	periodStart := time.Unix(periodStartEntry.Time, 0)
	for i := startIndex; i < len(entries); i++ {
		if entries[i].Value <= 0 {
			continue
		}
		if hasCashFlowBetween(cashFlows, periodStart, time.Unix(entries[i].Time, 0)) {
			return periodStartEntry
		}
		return &entries[i]
	}

	for _, cashFlow := range cashFlows {
		if cashFlow.Time.After(periodStart) {
			return periodStartEntry
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

func timestampPointer(at time.Time) *int64 {
	if at.IsZero() {
		return nil
	}
	timestamp := at.Unix()
	return &timestamp
}

func chartPerformanceForRange(
	entries []ChartEntry,
	cashFlows []chartCashFlow,
	rangeStart, endTime time.Time,
	endingValue *float64,
) ChartPerformance {
	performance := ChartPerformance{
		StartTimestamp: timestampPointer(rangeStart),
	}
	startEntry := findPerformanceStartEntry(entries, rangeStart, cashFlows)
	if startEntry == nil || endingValue == nil {
		return performance
	}

	performance.MoneyWeightedReturn = calculateMoneyWeightedReturn(
		startEntry.Value,
		*endingValue,
		time.Unix(startEntry.Time, 0),
		endTime,
		cashFlows,
	)
	return performance
}

func computeChartPerformance(
	now time.Time,
	chartDataDaily, chartDataHourly []ChartEntry,
	cashFlows []chartCashFlow,
	chartTotal *float64,
) ChartPerformanceByDisplay {
	roundedHour := utcRoundedHour(now)

	return ChartPerformanceByDisplay{
		Week: chartPerformanceForRange(
			chartDataHourly,
			cashFlows,
			roundedHour.AddDate(0, 0, -7),
			now,
			chartTotal,
		),
		Month: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			roundedHour.AddDate(0, -1, 0),
			now,
			chartTotal,
		),
		Year: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			roundedHour.AddDate(-1, 0, 0),
			now,
			chartTotal,
		),
		All: chartPerformanceForRange(
			chartDataDaily,
			cashFlows,
			time.Time{},
			now,
			chartTotal,
		),
	}
}
