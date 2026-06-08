// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPriceAt(t *testing.T) {
	updater := NewRateUpdater(nil, "/dev/null") // don't need to make HTTP requests or load DB
	defer updater.Stop()
	updater.history = map[string][]exchangeRate{
		"btcUSD": {
			{value: 2, timestamp: time.Date(2020, 9, 1, 0, 0, 0, 0, time.UTC)},
			{value: 3, timestamp: time.Date(2020, 9, 2, 0, 0, 0, 0, time.UTC)},
			{value: 5, timestamp: time.Date(2020, 9, 3, 0, 0, 0, 0, time.UTC)},
			{value: 8, timestamp: time.Date(2020, 9, 4, 0, 0, 0, 0, time.UTC)},
		},
	}
	tt := []struct {
		wantValue float64
		at        time.Time
	}{
		{0, time.Date(2020, 8, 31, 0, 0, 0, 0, time.UTC)}, // before first point
		{2, time.Date(2020, 9, 1, 0, 0, 0, 0, time.UTC)},  // exactly at first point
		{0, time.Date(2020, 9, 10, 0, 0, 0, 0, time.UTC)}, // no data; way in the future
		{5, time.Date(2020, 9, 3, 0, 0, 0, 0, time.UTC)},  // exact match
		{8, time.Date(2020, 9, 4, 0, 0, 0, 0, time.UTC)},  // exact match
		// The following are all interpolated.
		{2.5, time.Date(2020, 9, 1, 12, 0, 0, 0, time.UTC)},
		{4, time.Date(2020, 9, 2, 12, 0, 0, 0, time.UTC)},
		{6.5, time.Date(2020, 9, 3, 12, 0, 0, 0, time.UTC)},
		{7.25, time.Date(2020, 9, 3, 18, 0, 0, 0, time.UTC)},
	}
	for _, test := range tt {
		assert.Equal(t,
			test.wantValue,
			updater.HistoricalPriceAt("btc", "USD", test.at), "at = %s", test.at)
	}
}

func TestUpdateHistory(t *testing.T) {
	const wantStartUnix = 1598918462 // 2020-09-01 00:01:02
	const wantEndUnix = 1599004862   // 2020-09-02 00:01:02

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method, "request method")
		assert.Equal(t, "/coins/bitcoin/market_chart/range", r.URL.Path, "URL path")
		assert.Equal(t, strconv.Itoa(wantStartUnix), r.URL.Query().Get("from"), "from query arg")
		assert.Equal(t, strconv.Itoa(wantEndUnix), r.URL.Query().Get("to"), "to query arg")
		assert.Equal(t, "usd", r.URL.Query().Get("vs_currency"), "vs_currency query arg")

		// Composed after a real response like this one:
		// https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=1598918400&to=1600128000
		// - 2020-09-01 00:05:00 UTC
		// - 2020-09-01 01:08:21 UTC
		fmt.Fprintln(w, `{
			"prices": [
			  [
			    1598918700000,
			    10000.0
			  ],
			  [
			    1598922501000,
			    10001.0
			  ]
			]
		}`)
	}))
	defer ts.Close()

	dbdir := test.TstTempDir("TestUpdateHistory")
	defer os.RemoveAll(dbdir)
	updater := NewRateUpdater(http.DefaultClient, dbdir)
	updater.coingeckoURL = ts.URL
	updater.history = map[string][]exchangeRate{
		"btcUSD": {
			{value: 1.0, timestamp: time.Unix(1598832062, 0)}, // 2020-08-31 00:01:02
			{value: 2.0, timestamp: time.Unix(1599091262, 0)}, // 2020-09-03 00:01:02
		},
	}

	g := fixedTimeRange(time.Unix(wantStartUnix, 0), time.Unix(wantEndUnix, 0))
	n, err := updater.updateHistory(t.Context(), "btc", "USD", g)
	require.NoError(t, err, "updater.updateHistory err")
	assert.Equal(t, 2, n, "updater.updateHistory n")
	wantHistory := map[string][]exchangeRate{
		"btcUSD": {
			{value: 1.0, timestamp: time.Unix(1598832062, 0)}, // preexisting point
			{value: 10000.0, timestamp: time.Unix(1598918700, 0)},
			{value: 10001.0, timestamp: time.Unix(1598922501, 0)},
			{value: 2.0, timestamp: time.Unix(1599091262, 0)}, // preexisting point
		},
	}
	assert.Equal(t, wantHistory, updater.history, "updater.history")
	updater.Stop() // closes dbdir so updater2 can load it

	updater2 := NewRateUpdater(http.DefaultClient, dbdir)
	defer updater2.Stop()
	updater2.coingeckoURL = "unused"
	updater2.loadHistoryBucket("btcUSD")
	assert.Equal(t, wantHistory, updater.history, "updater2.history")
}

func TestFetchGeckoMarketRangeInvalidCoinFiat(t *testing.T) {
	tt := []struct{ coin, fiat string }{
		{"BTC", "invalid"},
		{"BTC", ""},
		{"unsupported", "USD"},
		{"", "USD"},
	}
	for _, test := range tt {
		ctx, cancel := context.WithTimeout(t.Context(), time.Second)
		var updater RateUpdater
		g := fixedTimeRange(time.Now().Add(-time.Hour), time.Now())
		_, err := updater.fetchGeckoMarketRange(ctx, test.coin, test.fiat, g)
		require.Error(t, err, "fetchGeckoMarketRange(%q, %q) returned nil error", test.coin, test.fiat)
		cancel()
	}
}

func TestHistoryEarliestLatest(t *testing.T) {
	updater := NewRateUpdater(nil, "/dev/null")
	defer updater.Stop()
	updater.history = map[string][]exchangeRate{
		"btcUSD": {
			{value: 1, timestamp: time.Unix(1598832062, 0)}, // 2020-08-31 00:01:02
			{value: 2, timestamp: time.Unix(1598918700, 0)},
			{value: 3, timestamp: time.Unix(1598922501, 0)},
			{value: 4, timestamp: time.Unix(1599091262, 0)}, // 2020-09-03 00:01:02
		},
		"ltcUSD": {
			{value: 4, timestamp: time.Date(2020, 8, 02, 23, 0, 0, 0, time.UTC)},
			{value: 4, timestamp: time.Date(2020, 9, 02, 23, 0, 0, 0, time.UTC)},
		},
	}

	earliest := updater.HistoryEarliestTimestamp("btc", "USD")
	assert.Equal(t, updater.history["btcUSD"][0].timestamp, earliest, "earliest")

	latest := updater.HistoryLatestTimestamp("btc", "USD")
	assert.Equal(t, updater.history["btcUSD"][3].timestamp, latest, "latest")

	assert.Zero(t, updater.HistoryEarliestTimestamp("foo", "bar"), "zero earliest")
	assert.Zero(t, updater.HistoryLatestTimestamp("foo", "bar"), "zero latest")

	assert.Equal(t,
		updater.history["ltcUSD"][1].timestamp,
		updater.HistoryLatestTimestampFiat([]string{"btc", "ltc"}, "USD"))

	assert.Zero(t, updater.HistoryLatestTimestampFiat([]string{"btc", "foo"}, "USD"))
	assert.Zero(t, updater.HistoryLatestTimestampFiat([]string{"foo", "btc"}, "USD"))
}

// TestLoadDumpBucketUnusableDB ensures no panic when the RateUpdater.historyDB is unusable.
func TestLoadDumpBucketUnusableDB(t *testing.T) {
	updater := NewRateUpdater(nil, "/dev/null")
	defer updater.Stop()
	_, err1 := updater.loadHistoryBucket("foo")
	require.Error(t, err1, "loadHistoryBucket")
	err2 := updater.dumpHistoryBucket("bar", nil)
	require.Error(t, err2, "dumpHistoryBucket")
}

func TestDumpLoadHistoryBucket(t *testing.T) {
	wantRates := []exchangeRate{
		{value: 1, timestamp: time.Unix(1598832062, 0)},
		{value: 2, timestamp: time.Unix(1598918700, 0)},
		{value: 3, timestamp: time.Unix(1598922501, 0)},
		{value: 4, timestamp: time.Unix(1599091262, 0)},
	}
	dbdir := test.TstTempDir("TestLoadDumpHistoryBucket")
	defer os.RemoveAll(dbdir)

	updater1 := NewRateUpdater(nil, dbdir)
	require.NoError(t, updater1.dumpHistoryBucket("btcUSD", wantRates), "dumpHistoryBucket")
	updater1.Stop() // close dbdir so updater2 can load

	updater2 := NewRateUpdater(nil, dbdir)
	defer updater2.Stop()
	rates, err := updater2.loadHistoryBucket("btcUSD")
	require.NoError(t, err, "updater2.loadHistoryBucket")
	assert.Len(t, rates, 4, "len(rates)")
}

func TestReconfigureHistoryLoadsFromDB(t *testing.T) {
	sampleRates := []exchangeRate{
		{value: 1, timestamp: time.Unix(1598832062, 0)},
		{value: 2, timestamp: time.Unix(1598918700, 0)},
		{value: 3, timestamp: time.Unix(1598922501, 0)},
		{value: 4, timestamp: time.Unix(1599091262, 0)},
	}
	dbdir := test.TstTempDir("TestReconfigureHistoryLoadsFromDB")
	defer os.RemoveAll(dbdir)

	updater1 := NewRateUpdater(nil, dbdir)
	require.NoError(t, updater1.dumpHistoryBucket("btcUSD", sampleRates), "dumpHistoryBucket")
	updater1.Stop() // close dbdir so updater2 can load

	updater2 := NewRateUpdater(http.DefaultClient, dbdir)
	updater2.coingeckoURL = "unused" // avoid hitting real API
	defer updater2.Stop()
	updater2.ReconfigureHistory([]string{"btc"}, []string{"USD"})
	// Loading from bbolt DB may result in unsorted slice.
	// To test this manually, comment out sortRatesByTimestamp in
	// RateUpdater.loadHistoryBucket and add the following here:
	// assert.Equal(t, nil, updater2.history["btcUSD"])
	for _, rate := range sampleRates {
		v := updater2.HistoricalPriceAt("btc", "USD", rate.timestamp)
		assert.Equal(t, rate.value, v, "PriceAt(btc, USD, %d)", rate.timestamp.Unix())
	}
}

func BenchmarkDumpHistoryBucket(b *testing.B) {
	var rates []exchangeRate
	for i := 0; i < 5000; i++ {
		rates = append(rates, exchangeRate{
			value:     float64(i),
			timestamp: time.Unix(int64(i), 0),
		})
	}
	updater := NewRateUpdater(nil, test.TstTempDir("BenchmarkDumpHistoryBucket"))
	defer updater.Stop()

	for b.Loop() {
		err := updater.dumpHistoryBucket("btcUSD", rates)
		require.NoError(b, err, "updater.dumpHistoryBucket")
	}
}

func BenchmarkLoadHistoryBucket(b *testing.B) {
	var rates []exchangeRate
	for i := 0; i < 5000; i++ {
		rates = append(rates, exchangeRate{
			value:     float64(i),
			timestamp: time.Unix(int64(i), 0),
		})
	}
	dbdir := test.TstTempDir("BenchmarkLoadHistoryBucket")
	updater := NewRateUpdater(nil, dbdir)
	updater.dumpHistoryBucket("btcUSD", rates)
	updater.Stop()

	updater2 := NewRateUpdater(nil, dbdir)
	defer updater2.Stop()

	for b.Loop() {
		rates, err := updater2.loadHistoryBucket("btcUSD")
		require.NoError(b, err, "updater.loadHistoryBucket")
		require.Len(b, rates, 5000, "len(rates)")
	}
}

func TestHistoryLatestTimestampCoin(t *testing.T) {
	updater := NewRateUpdater(nil, "/dev/null") // don't need to make HTTP requests or load DB
	defer updater.Stop()
	updater.history = map[string][]exchangeRate{
		"btcUSD": {
			{value: 2, timestamp: time.Date(2020, 9, 1, 0, 0, 0, 0, time.UTC)},
			{value: 3, timestamp: time.Date(2020, 9, 2, 0, 0, 0, 0, time.UTC)},
			{value: 5, timestamp: time.Date(2020, 9, 3, 0, 0, 0, 0, time.UTC)},
			{value: 8, timestamp: time.Date(2020, 9, 4, 0, 0, 0, 0, time.UTC)},
		},
		"btcEUR": {
			{value: 2, timestamp: time.Date(2020, 9, 1, 0, 0, 0, 0, time.UTC)},
			{value: 3, timestamp: time.Date(2020, 9, 2, 0, 0, 0, 0, time.UTC)},
			{value: 5, timestamp: time.Date(2020, 9, 3, 0, 0, 0, 0, time.UTC)},
		},
	}
	assert.Equal(t, time.Time{}, updater.HistoryLatestTimestampCoin("eth"))
	assert.Equal(t,
		time.Date(2020, 9, 3, 0, 0, 0, 0, time.UTC),
		updater.HistoryLatestTimestampCoin("btc"))
}
