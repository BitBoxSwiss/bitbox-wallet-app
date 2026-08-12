// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"
	"slices"
	"sort"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
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

// chartCoinCodes returns the coin codes needed to load chart rate history.
func (backend *Backend) chartCoinCodes() []string {
	coinCodes := backend.allCoinCodes()
	if !backend.hasLightningAccount() || slices.Contains(coinCodes, string(coin.CodeBTC)) {
		return coinCodes
	}
	// Lightning transactions require BTC coin code
	return append(coinCodes, string(coin.CodeBTC))
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

// ChartTransactionMarkerAmount summarizes one transaction direction in a chart bucket.
type ChartTransactionMarkerAmount struct {
	Count     int    `json:"count"`
	Amount    string `json:"amount"`
	Estimated bool   `json:"estimated"`
}

// ChartTransactionMarker summarizes transactions in one chart bucket.
type ChartTransactionMarker struct {
	Time      int64                        `json:"time"`
	Receive   ChartTransactionMarkerAmount `json:"receive"`
	Send      ChartTransactionMarkerAmount `json:"send"`
	Lightning bool                         `json:"lightning"`
}

// ChartTransactionMarkers contains marker buckets for both chart resolutions.
type ChartTransactionMarkers struct {
	Daily  []ChartTransactionMarker `json:"daily"`
	Hourly []ChartTransactionMarker `json:"hourly"`
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
	// Transactions aggregated into markers for the daily and hourly charts. Omitted unless
	// explicitly requested and chart data is available.
	TransactionMarkers *ChartTransactionMarkers `json:"chartTransactionMarkers,omitempty"`
}

func includeChartTransaction(tx *accounts.TransactionData) bool {
	if tx.Timestamp == nil {
		return false
	}
	if tx.Status == accounts.TxStatusFailed {
		return false
	}
	return tx.Type == accounts.TxTypeSend || tx.Type == accounts.TxTypeReceive
}

type chartTransactionAccount struct {
	accountCoin coin.Coin
	lightning   bool
	rateUpdater *rates.RateUpdater
	txs         accounts.OrderedTransactions
}

type chartTransactionMarkerTotal struct {
	amount        *big.Rat
	amountMissing bool
	count         int
	estimated     bool
}

type chartTransactionMarkerBucket struct {
	receive   chartTransactionMarkerTotal
	send      chartTransactionMarkerTotal
	lightning bool
}

func (total *chartTransactionMarkerTotal) add(amount *big.Rat, estimated bool) {
	total.count++
	total.estimated = total.estimated || estimated
	if amount == nil {
		total.amountMissing = true
		return
	}
	if total.amount == nil {
		total.amount = new(big.Rat).Set(amount)
		return
	}
	total.amount.Add(total.amount, amount)
}

func (total *chartTransactionMarkerTotal) formatted(fiat string) ChartTransactionMarkerAmount {
	formatted := ChartTransactionMarkerAmount{
		Count:     total.count,
		Estimated: total.estimated,
	}
	if !total.amountMissing && total.amount != nil {
		formatted.Amount = coin.FormatAsCurrency(total.amount, fiat)
	}
	return formatted
}

func addChartTransactionMarker(
	buckets map[int64]*chartTransactionMarkerBucket,
	bucketTime int64,
	txType accounts.TxType,
	amount *big.Rat,
	estimated bool,
	lightning bool,
) {
	bucket := buckets[bucketTime]
	if bucket == nil {
		bucket = &chartTransactionMarkerBucket{}
		buckets[bucketTime] = bucket
	}
	if lightning {
		bucket.lightning = true
	}
	if txType == accounts.TxTypeReceive {
		bucket.receive.add(amount, estimated)
	} else {
		bucket.send.add(amount, estimated)
	}
}

func formatChartTransactionMarkers(
	buckets map[int64]*chartTransactionMarkerBucket,
	fiat string,
) []ChartTransactionMarker {
	markers := make([]ChartTransactionMarker, 0, len(buckets))
	for bucketTime, bucket := range buckets {
		markers = append(markers, ChartTransactionMarker{
			Time:      bucketTime,
			Receive:   bucket.receive.formatted(fiat),
			Send:      bucket.send.formatted(fiat),
			Lightning: bucket.lightning,
		})
	}
	sort.Slice(markers, func(i, j int) bool { return markers[i].Time < markers[j].Time })
	return markers
}

func chartTransactionMarkers(
	chartAccounts []chartTransactionAccount,
	fiat string,
	hourlyFrom time.Time,
	now time.Time,
) *ChartTransactionMarkers {
	daily := map[int64]*chartTransactionMarkerBucket{}
	hourly := map[int64]*chartTransactionMarkerBucket{}

	for _, chartAccount := range chartAccounts {
		latestHistoryTime := chartAccount.rateUpdater.HistoryLatestTimestamp(
			string(chartAccount.accountCoin.Code()),
			fiat,
		)
		latestRates := chartAccount.rateUpdater.LatestPrice()
		for _, tx := range chartAccount.txs {
			if !includeChartTransaction(tx) {
				continue
			}

			amount := tx.Amount
			if tx.Type == accounts.TxTypeSend {
				amount = tx.DeductedAmount
			}
			historicalRateMissing := latestHistoryTime.IsZero() || latestHistoryTime.Before(*tx.Timestamp)
			estimated := historicalRateMissing && now.Sub(*tx.Timestamp) < 2*time.Hour

			var rate float64
			var rateAvailable bool
			if estimated {
				if latestRates != nil {
					rate, rateAvailable = latestRates[chartAccount.accountCoin.Unit(false)][fiat]
				}
			} else {
				rate = chartAccount.rateUpdater.HistoricalPriceAt(
					string(chartAccount.accountCoin.Code()),
					fiat,
					*tx.Timestamp,
				)
				rateAvailable = rate != 0
			}

			var fiatAmount *big.Rat
			if rateAvailable {
				fiatAmount = new(big.Rat).Mul(
					coin.ToUnitRat(amount, chartAccount.accountCoin, false),
					new(big.Rat).SetFloat64(rate),
				)
			}

			dailyTime := tx.Timestamp.Truncate(24 * time.Hour).Unix()
			addChartTransactionMarker(
				daily, dailyTime, tx.Type, fiatAmount, estimated, chartAccount.lightning)
			if !tx.Timestamp.Before(hourlyFrom) {
				hourlyTime := tx.Timestamp.Truncate(time.Hour).Unix()
				addChartTransactionMarker(
					hourly, hourlyTime, tx.Type, fiatAmount, estimated, chartAccount.lightning)
			}
		}
	}

	return &ChartTransactionMarkers{
		Daily:  formatChartTransactionMarkers(daily, fiat),
		Hourly: formatChartTransactionMarkers(hourly, fiat),
	}
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

func (backend *Backend) addTxsToChart(
	coinCode coin.Code,
	logCoinCode coin.Code,
	fiat string,
	coinDecimals *big.Int,
	txs accounts.OrderedTransactions,
	until time.Time,
	chartEntriesDaily map[int64]RatChartEntry,
	chartEntriesHourly map[int64]RatChartEntry,
) (bool, error) {
	earliestPriceAvailable := backend.RatesUpdater().HistoryEarliestTimestamp(
		string(coinCode),
		fiat)

	earliestTxTime, err := txs.EarliestTime()
	if errp.Cause(err) == errors.ErrNotAvailable {
		backend.log.WithField("coin", logCoinCode).Info("ChartDataMissing/earliestTxtime")
		return true, nil
	}
	if err != nil {
		return false, err
	}

	if earliestTxTime.IsZero() {
		// Ignore the chart for this account, there is no timed transaction.
		return false, nil
	}
	if earliestPriceAvailable.IsZero() || earliestTxTime.Before(earliestPriceAvailable) {
		backend.log.
			WithField("coin", logCoinCode).
			WithField("earliestTxTime", earliestTxTime).
			WithField("earliestPriceAvailable", earliestPriceAvailable).
			Info("ChartDataMissing")
		return true, nil
	}

	timeseriesDaily, err := txs.Timeseries(
		earliestTxTime.Truncate(24*time.Hour),
		until,
		24*time.Hour,
	)
	if errp.Cause(err) == errors.ErrNotAvailable {
		backend.log.WithField("coin", logCoinCode).Info("ChartDataMissing")
		return true, nil
	}
	if err != nil {
		return false, err
	}

	// Time from which the chart turns from daily points to hourly points.
	hourlyFrom := time.Now().AddDate(0, 0, -7).Truncate(24 * time.Hour)
	timeseriesHourly, err := txs.Timeseries(
		hourlyFrom,
		until,
		time.Hour,
	)
	if errp.Cause(err) == errors.ErrNotAvailable {
		backend.log.WithField("coin", logCoinCode).Info("ChartDataMissing")
		return true, nil
	}
	if err != nil {
		return false, err
	}

	backend.addChartData(coinCode, fiat, coinDecimals, timeseriesDaily, chartEntriesDaily)
	backend.addChartData(coinCode, fiat, coinDecimals, timeseriesHourly, chartEntriesHourly)
	return false, nil
}

// ChartData assembles chart data for all active accounts.
func (backend *Backend) ChartData(includeTransactionMarkers bool) (*Chart, error) {
	// If true, we are missing headers or historical conversion rates necessary to compute the chart
	// data,
	chartDataMissing := false

	// key: unix timestamp.
	chartEntriesDaily := map[int64]RatChartEntry{}
	chartEntriesHourly := map[int64]RatChartEntry{}
	chartAccounts := []chartTransactionAccount{}

	fiat := backend.Config().AppConfig().Backend.MainFiat
	now := time.Now()
	hourlyFrom := now.AddDate(0, 0, -7).Truncate(24 * time.Hour)

	// Chart data until this point in time.
	until := backend.RatesUpdater().HistoryLatestTimestampFiat(backend.chartCoinCodes(), fiat)
	if until.IsZero() {
		chartDataMissing = true
		backend.log.Info("ChartDataMissing, until is zero")
	}
	isUpToDate := now.Sub(until) < 2*time.Hour
	lastTimestamp := until.UnixMilli()

	currentTotal := new(big.Rat)
	currentTotalMissing := false
	// Total number of transactions across all active accounts.
	totalNumberOfTransactions := 0
	transactionHistoryMissing := false
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
		if includeTransactionMarkers {
			chartAccounts = append(chartAccounts, chartTransactionAccount{
				accountCoin: account.Coin(),
				rateUpdater: account.Config().RateUpdater,
				txs:         txs,
			})
		}

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

		accountChartDataMissing, err := backend.addTxsToChart(
			account.Coin().Code(),
			account.Coin().Code(),
			fiat,
			coinDecimals,
			txs,
			until,
			chartEntriesDaily,
			chartEntriesHourly,
		)
		if err != nil {
			return nil, err
		}
		if accountChartDataMissing {
			chartDataMissing = true
			continue
		}

	}

	if backend.hasLightningAccount() {
		var err error
		lightningBalance, err := backend.lightning.Balance()
		if err != nil {
			return nil, err
		}
		lightningBalanceAmount, err := backend.convertBtcAmountToFiat(lightningBalance.Available(), fiat)
		if err != nil {
			return nil, err
		}
		currentTotal.Add(currentTotal, lightningBalanceAmount)

		lightningTxs, err := backend.lightning.Transactions()
		if err != nil {
			backend.log.WithError(err).WithField("coin", coinCodeLightning).Info("ChartDataMissing/list-payments")
			chartDataMissing = true
			transactionHistoryMissing = true
			lightningTxs = nil
		}
		totalNumberOfTransactions += len(lightningTxs)
		btcCoin, err := backend.Coin(coin.CodeBTC)
		if err != nil {
			return nil, err
		}
		if includeTransactionMarkers {
			chartAccounts = append(chartAccounts, chartTransactionAccount{
				accountCoin: btcCoin,
				lightning:   true,
				rateUpdater: backend.RatesUpdater(),
				txs:         lightningTxs,
			})
		}

		if !chartDataMissing {
			lightningChartDataMissing, err := backend.addTxsToChart(
				coin.CodeBTC,
				coinCodeLightning,
				fiat,
				coin.DecimalsExp(btcCoin, false),
				lightningTxs,
				until,
				chartEntriesDaily,
				chartEntriesHourly,
			)
			if err != nil {
				return nil, err
			}
			if lightningChartDataMissing {
				chartDataMissing = true
			}
		}
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
		// missing form the timeseries (`until` is up to 2h in the past).
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
	if chartDataMissing && totalNumberOfTransactions == 0 && !transactionHistoryMissing {
		backend.log.Info("ChartDataMissing forced to false")
		chartDataMissing = false
	}

	var transactionMarkers *ChartTransactionMarkers
	if includeTransactionMarkers && !chartDataMissing {
		transactionMarkers = chartTransactionMarkers(chartAccounts, fiat, hourlyFrom, now)
	}

	var chartTotal *float64
	var formattedChartTotal string
	if !currentTotalMissing {
		tot, _ := currentTotal.Float64()
		chartTotal = &tot
		formattedChartTotal = coin.FormatAsCurrency(currentTotal, fiat)
	}
	return &Chart{
		DataMissing:        chartDataMissing,
		DataDaily:          toSortedSlice(chartEntriesDaily, fiat),
		DataHourly:         toSortedSlice(chartEntriesHourly, fiat),
		Fiat:               fiat,
		Total:              chartTotal,
		FormattedTotal:     formattedChartTotal,
		IsUpToDate:         isUpToDate,
		LastTimestamp:      lastTimestamp,
		TransactionMarkers: transactionMarkers,
	}, nil
}
