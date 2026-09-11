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

type chartLogReturnPoint struct {
	logReturn float64
	residual  float64
}

type chartLogReturnBracket struct {
	lower chartLogReturnPoint
	upper chartLogReturnPoint
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

func chartMoneyWeightedReturnResidual(
	logReturn float64,
	beginningValue, endingValue float64,
	cashFlows []chartWeightedCashFlow,
) float64 {
	residual := beginningValue*math.Exp(logReturn) - endingValue
	for _, cashFlow := range cashFlows {
		residual += cashFlow.Value * math.Exp(cashFlow.RemainingWeight*logReturn)
	}
	return residual
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

func chartIsFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func orderedChartLogReturnBracket(
	first, second chartLogReturnPoint,
) chartLogReturnBracket {
	if first.logReturn > second.logReturn {
		first, second = second, first
	}
	return chartLogReturnBracket{lower: first, upper: second}
}

// findChartMoneyWeightedReturnBracket searches for an exact root or two points
// whose residuals have opposite signs. The search expands from zero in both
// directions because the return may be positive or negative.
func findChartMoneyWeightedReturnBracket(
	residualAt func(logReturn float64) float64,
	residualAtZero float64,
) (chartLogReturnBracket, bool) {
	const (
		initialLogReturnStep = 0.01
		maxAbsLogReturn      = 50.0
	)

	// Check positive first at each distance so equations with multiple roots have
	// a deterministic preference when both directions find a bracket together.
	directions := [...]float64{1, -1}
	zeroPoint := chartLogReturnPoint{residual: residualAtZero}
	previousPoints := [...]chartLogReturnPoint{
		zeroPoint,
		zeroPoint,
	}

	for step := initialLogReturnStep; ; step *= 2 {
		currentStep := math.Min(step, maxAbsLogReturn)
		for directionIndex, direction := range directions {
			currentPoint := chartLogReturnPoint{
				logReturn: direction * currentStep,
			}
			currentPoint.residual = residualAt(currentPoint.logReturn)
			if !chartIsFinite(currentPoint.residual) {
				return chartLogReturnBracket{}, false
			}

			if currentPoint.residual == 0 {
				return orderedChartLogReturnBracket(currentPoint, currentPoint), true
			}

			previousPoint := previousPoints[directionIndex]
			if chartHasSignChange(previousPoint.residual, currentPoint.residual) {
				return orderedChartLogReturnBracket(previousPoint, currentPoint), true
			}

			previousPoints[directionIndex] = currentPoint
		}

		if currentStep == maxAbsLogReturn {
			return chartLogReturnBracket{}, false
		}
	}
}

// bisectChartMoneyWeightedReturn returns an exactly sampled root from a
// degenerate bracket, or narrows a sign-changing bracket to a root.
func bisectChartMoneyWeightedReturn(
	residualAt func(logReturn float64) float64,
	bracket chartLogReturnBracket,
) (float64, bool) {
	const maxIterations = 200

	lower := bracket.lower
	upper := bracket.upper
	if lower.logReturn == upper.logReturn {
		return lower.logReturn, true
	}

	for i := 0; i < maxIterations; i++ {
		midpoint := chartLogReturnPoint{
			logReturn: (lower.logReturn + upper.logReturn) / 2,
		}
		midpoint.residual = residualAt(midpoint.logReturn)
		if !chartIsFinite(midpoint.residual) {
			return 0, false
		}
		if midpoint.residual == 0 {
			return midpoint.logReturn, true
		}

		if chartHasSignChange(lower.residual, midpoint.residual) {
			upper = midpoint
		} else {
			lower = midpoint
		}
	}

	return (lower.logReturn + upper.logReturn) / 2, true
}

// solveChartMoneyWeightedReturn solves
//
//	EV = BV*(1+r) + sum(CF_i*(1+r)^remaining_i)
//
// by substituting exp(x) for 1+r. This maps every valid return (r > -1) to a
// real log-return x. The solver first brackets a root by searching
// outwards from zero, then converges on it using bisection. It returns nil when
// no finite solution can be bracketed within the search range.
func solveChartMoneyWeightedReturn(
	beginningValue, endingValue float64,
	cashFlows []chartWeightedCashFlow,
) *float64 {
	scale := chartMoneyWeightedReturnScale(beginningValue, endingValue, cashFlows)
	tolerance := math.Max(scale*1e-12, 1e-12)
	residualAt := func(logReturn float64) float64 {
		return chartMoneyWeightedReturnResidual(logReturn, beginningValue, endingValue, cashFlows)
	}

	residualAtZero := residualAt(0)
	if math.Abs(residualAtZero) <= tolerance {
		result := 0.0
		return &result
	}

	bracket, ok := findChartMoneyWeightedReturnBracket(residualAt, residualAtZero)
	if !ok {
		return nil
	}

	logReturn, ok := bisectChartMoneyWeightedReturn(residualAt, bracket)
	if !ok {
		return nil
	}

	result := math.Expm1(logReturn)
	if !chartIsFinite(result) {
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
	asset coin.Coin,
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

		value, ok := backend.fiatValueAt(asset, tx.Amount, fiat, *tx.Timestamp)
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
