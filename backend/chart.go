// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backend

import (
	"math/big"
	"sort"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

func (backend *Backend) allCoinCodes() []string {
	allCoinCodes := []string{}
	for _, account := range backend.Accounts() {
		if account.FatalError() {
			continue
		}
		allCoinCodes = append(allCoinCodes, string(account.Coin().Code()))
	}
	return allCoinCodes
}

// ChartEntry is one data point in the chart timeseries.
type ChartEntry struct {
	Time  int64   `json:"time"`
	Value float64 `json:"value"`
}

// Chart has all data needed to show a time-based chart of their assets to the user.
type Chart struct {
	DataMissing bool         `json:"chartDataMissing"`
	DataDaily   []ChartEntry `json:"chartDataDaily"`
	DataHourly  []ChartEntry `json:"chartDataHourly"`
	Fiat        string       `json:"chartFiat"`
	Total       *float64     `json:"chartTotal"`
	// only valid is DataMissing is false
	IsUpToDate bool `json:"chartIsUpToDate"`
}

func (backend *Backend) addChartData(
	coinCode coin.Code,
	fiat string,
	coinDecimals *big.Int,
	timeseries []accounts.TimeseriesEntry,
	chartEntries map[int64]ChartEntry,
) {
	for _, e := range timeseries {
		price := backend.RatesUpdater().PriceAt(
			string(coinCode),
			fiat,
			e.Time)
		timestamp := e.Time.Unix()
		ChartEntry := chartEntries[timestamp]

		ChartEntry.Time = timestamp
		fiatValue, _ := new(big.Rat).Mul(
			new(big.Rat).SetFrac(
				e.Value.BigInt(),
				coinDecimals,
			),
			new(big.Rat).SetFloat64(price),
		).Float64()
		ChartEntry.Value += fiatValue
		chartEntries[timestamp] = ChartEntry
	}
}

// ChartData assembles chart data for all active accounts.
func (backend *Backend) ChartData() (*Chart, error) {
	// If true, we are missing headers or historical conversion rates necessary to compute the chart
	// data,
	chartDataMissing := false

	// key: unix timestamp.
	chartEntriesDaily := map[int64]ChartEntry{}
	chartEntriesHourly := map[int64]ChartEntry{}

	fiat := backend.Config().AppConfig().Backend.MainFiat
	// Chart data until this point in time.
	until := backend.RatesUpdater().HistoryLatestTimestampAll(backend.allCoinCodes(), fiat)
	if until.IsZero() {
		chartDataMissing = true
		backend.log.Info("ChartDataMissing, until is zero")
	}
	isUpToDate := time.Since(until) < 2*time.Hour
	backend.log.Infof("Chart/isUptodate: %v", isUpToDate)

	currentTotal := new(big.Rat)
	currentTotalMissing := false
	// Total number of transactions across all active accounts.
	totalNumberOfTransactions := 0
	for _, account := range backend.Accounts() {
		if account.FatalError() {
			continue
		}
		err := account.Initialize()
		if err != nil {
			return nil, err
		}
		balance, err := account.Balance()
		if err != nil {
			return nil, err
		}
		txs, err := account.Transactions()
		if err != nil {
			return nil, err
		}
		totalNumberOfTransactions += len(txs)

		// e.g. 1e8 for Bitcoin/Litecoin, 1e18 for Ethereum, etc. Used to convert from the smallest
		// unit to the standard unit (BTC, LTC; ETH, etc.).
		coinDecimals := new(big.Int).Exp(
			big.NewInt(10),
			big.NewInt(int64(account.Coin().Decimals(false))),
			nil,
		)

		// HACK: We still use the latest prices from CryptoCompare for the account fiat balances
		// above (displayed in the summary table). Those might deviate from the latest historical
		// prices from coingecko, which results in different total balances in the chart and the
		// summary table.
		//
		// As a temporary workaround, until we use only one source for all prices, we manually
		// compute the total based on the latest rates from CryptoCompare.
		price, err := backend.RatesUpdater().LastForPair(string(account.Coin().Code()), fiat)
		if err != nil {
			currentTotalMissing = true
			backend.log.
				WithField("coin", account.Coin().Code()).WithError(err).Info("currentTotalMissing")
		}
		fiatValue := new(big.Rat).Mul(
			new(big.Rat).SetFrac(
				balance.Available().BigInt(),
				coinDecimals,
			),
			new(big.Rat).SetFloat64(price),
		)
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

		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesDaily, chartEntriesDaily)
		backend.addChartData(account.Coin().Code(), fiat, coinDecimals, timeseriesHourly, chartEntriesHourly)

	}

	toSortedSlice := func(s map[int64]ChartEntry) []ChartEntry {
		result := make([]ChartEntry, len(s))
		i := 0
		for _, entry := range s {
			result[i] = entry
			i++
		}
		sort.Slice(result, func(i, j int) bool { return result[i].Time < result[j].Time })

		// Manually add the last point with the current total, to make the last point match.
		// The last point might not match the account total otherwise because:
		// 1) unconfirmed tx are not in the timeseries
		// 2) coingecko might not have rates yet up until after all transactions, so they'd also be
		// missing form the timeseries (`until` is up to 2h in the past).
		if isUpToDate && !currentTotalMissing {
			total, _ := currentTotal.Float64()
			result = append(result, ChartEntry{
				Time:  time.Now().Unix(),
				Value: total,
			})
		}

		// Truncate leading zeroes.
		for i, e := range result {
			if e.Value > 0 {
				return result[i:]
			}
		}
		// Everything was zeroes.
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
	if !currentTotalMissing {
		tot, _ := currentTotal.Float64()
		chartTotal = &tot
	}
	return &Chart{
		DataMissing: chartDataMissing,
		DataDaily:   toSortedSlice(chartEntriesDaily),
		DataHourly:  toSortedSlice(chartEntriesHourly),
		Fiat:        fiat,
		Total:       chartTotal,
		IsUpToDate:  isUpToDate,
	}, nil
}
