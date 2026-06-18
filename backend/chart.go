// SPDX-License-Identifier: Apache-2.0

package backend

import (
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
	Time               int64   `json:"time"`
	Value              float64 `json:"value"`
	FormattedValue     string  `json:"formattedValue"`
	Performance        float64 `json:"performance"`
	NetInvestmentValue float64 `json:"netInvestmentValue"`
}

// RatChartEntry exploits composition to extend ChartEntry and save high precision values.
type RatChartEntry struct {
	ChartEntry
	RatValue         *big.Rat
	NetInvestmentRat *big.Rat
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

func chartPerformance(value, netInvestmentValue float64) float64 {
	if netInvestmentValue <= 0 {
		return 0
	}
	return (value / netInvestmentValue) - 1
}

func currentTotalChartEntry(now time.Time, currentTotal *big.Rat, fiat string, previous []ChartEntry) ChartEntry {
	total, _ := currentTotal.Float64()
	var netInvestmentValue float64
	var performance float64
	if len(previous) > 0 {
		lastEntry := previous[len(previous)-1]
		netInvestmentValue = lastEntry.NetInvestmentValue
		performance = lastEntry.Performance
	}
	return ChartEntry{
		Time:               now.Unix(),
		Value:              total,
		FormattedValue:     coin.FormatAsCurrency(currentTotal, fiat),
		Performance:        performance,
		NetInvestmentValue: netInvestmentValue,
	}
}

func (backend *Backend) addChartData(
	coinCode coin.Code,
	fiat string,
	coinDecimals *big.Int,
	timeseries []accounts.TimeseriesEntry,
	performanceTimeseries []accounts.MarketPerformanceEntry,
	chartEntries map[int64]RatChartEntry,
) {
	netInvestmentByTime := map[int64]*big.Rat{}
	for _, e := range performanceTimeseries {
		netInvestmentByTime[e.Time.Unix()] = e.NetInvestmentValue
	}
	for _, e := range timeseries {
		timestamp := e.Time.Unix()
		chartEntry := chartEntries[timestamp]

		chartEntry.Time = timestamp

		coinAmount := new(big.Rat).SetFrac(e.Value.BigInt(), coinDecimals)
		price := backend.RatesUpdater().HistoricalPriceAt(string(coinCode), fiat, e.Time)
		fiatValue := new(big.Rat).Mul(coinAmount, new(big.Rat).SetFloat64(price))
		netInvestmentValue := new(big.Rat)
		if value, ok := netInvestmentByTime[timestamp]; ok && value != nil {
			netInvestmentValue.Set(value)
		}

		if chartEntry.RatValue == nil {
			chartEntry.RatValue = new(big.Rat).Set(fiatValue)
			chartEntry.NetInvestmentRat = new(big.Rat).Set(netInvestmentValue)
		} else {
			chartEntry.RatValue.Add(chartEntry.RatValue, fiatValue)
			if chartEntry.NetInvestmentRat == nil {
				chartEntry.NetInvestmentRat = new(big.Rat).Set(netInvestmentValue)
			} else {
				chartEntry.NetInvestmentRat.Add(chartEntry.NetInvestmentRat, netInvestmentValue)
			}
		}
		chartEntries[timestamp] = chartEntry
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

	// Chart data until this point in time.
	until := backend.RatesUpdater().HistoryLatestTimestampFiat(backend.allCoinCodes(), fiat)
	if until.IsZero() {
		chartDataMissing = true
		backend.log.Info("ChartDataMissing, until is zero")
	}
	isUpToDate := time.Since(until) < 2*time.Hour
	lastTimestamp := until.UnixMilli()

	currentTotal := new(big.Rat)
	currentTotalMissing := false
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

		coinDecimals := coin.DecimalsExp(account.Coin(), false)

		// HACK: The latest prices might deviate from the latest historical prices (which can lag
		// behind by many minutes), which results in different total balances in the chart and the
		// summary table.
		//
		// As a workaround, we calls accountFiatBalance, which computes the total based on the latest rates.
		fiatValue, err := backend.accountFiatBalance(account, fiat)
		if err != nil {
			currentTotalMissing = true
			return nil, err
		}
		currentTotal.Add(currentTotal, fiatValue)

		// Below here, only chart data is being computed.
		if chartDataMissing {
			continue
		}

		// Time from which the chart turns from daily points to hourly points.
		hourlyFrom := time.Now().AddDate(0, 0, -7).Truncate(24 * time.Hour)

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

		performanceTimeseriesDaily, err := txs.MarketPerformanceTimeseries(
			earliestTxTime.Truncate(24*time.Hour),
			until,
			24*time.Hour,
			backend.RatesUpdater(),
			string(account.Coin().Code()),
			fiat,
			coinDecimals,
		)
		if errp.Cause(err) == errors.ErrNotAvailable {
			backend.log.WithField("coin", account.Coin().Code()).Info("ChartDataMissing")
			chartDataMissing = true
			continue
		}
		if err != nil {
			return nil, err
		}
		performanceTimeseriesHourly, err := txs.MarketPerformanceTimeseries(
			hourlyFrom,
			until,
			time.Hour,
			backend.RatesUpdater(),
			string(account.Coin().Code()),
			fiat,
			coinDecimals,
		)
		if errp.Cause(err) == errors.ErrNotAvailable {
			backend.log.WithField("coin", account.Coin().Code()).Info("ChartDataMissing")
			chartDataMissing = true
			continue
		}
		if err != nil {
			return nil, err
		}

		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesDaily, performanceTimeseriesDaily, chartEntriesDaily)
		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesHourly, performanceTimeseriesHourly, chartEntriesHourly)

	}

	toSortedSlice := func(s map[int64]RatChartEntry, fiat string) []ChartEntry {
		result := make([]ChartEntry, len(s))
		i := 0
		for _, entry := range s {
			floatValue, _ := entry.RatValue.Float64()
			var netInvestmentValue float64
			if entry.NetInvestmentRat != nil {
				netInvestmentValue, _ = entry.NetInvestmentRat.Float64()
			}
			performance := chartPerformance(floatValue, netInvestmentValue)

			result[i] = ChartEntry{
				Time:               entry.Time,
				Value:              floatValue,
				FormattedValue:     coin.FormatAsCurrency(entry.RatValue, fiat),
				Performance:        performance,
				NetInvestmentValue: netInvestmentValue,
			}
			i++
		}
		sort.Slice(result, func(i, j int) bool { return result[i].Time < result[j].Time })

		// Manually add the last point with the current total, to make the last point match.
		if isUpToDate && !currentTotalMissing {
			result = append(result, currentTotalChartEntry(time.Now(), currentTotal, fiat, result))
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
	var formattedChartTotal string
	if !currentTotalMissing {
		tot, _ := currentTotal.Float64()
		chartTotal = &tot
		formattedChartTotal = coin.FormatAsCurrency(currentTotal, fiat)
	}
	return &Chart{
		DataMissing:    chartDataMissing,
		DataDaily:      toSortedSlice(chartEntriesDaily, fiat),
		DataHourly:     toSortedSlice(chartEntriesHourly, fiat),
		Fiat:           fiat,
		Total:          chartTotal,
		FormattedTotal: formattedChartTotal,
		IsUpToDate:     isUpToDate,
		LastTimestamp:  lastTimestamp,
	}, nil
}
