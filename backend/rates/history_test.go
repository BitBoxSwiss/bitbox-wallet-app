package rates

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPriceAt(t *testing.T) {
	updater := NewRateUpdater(nil) // don't need to make HTTP requests
	updater.history = map[string][]exchangeRate{
		"BTC": {
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
		assert.Equal(t, test.wantValue, updater.PriceAt("BTC", "USD", test.at), "at = %s", test.at)
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
	updater := NewRateUpdater(http.DefaultClient)
	updater.coingeckoURL = ts.URL
	updater.history = map[string][]exchangeRate{
		"BTC": {
			{value: 1.0, timestamp: time.Unix(1598832062, 0)}, // 2020-08-31 00:01:02
			{value: 2.0, timestamp: time.Unix(1599091262, 0)}, // 2020-09-03 00:01:02
		},
	}

	n, err := updater.updateHistory("BTC", "USD", time.Unix(wantStartUnix, 0), time.Unix(wantEndUnix, 0))
	require.NoError(t, err, "updater.updateHistory err")
	assert.Equal(t, 2, n, "updater.updateHistory n")
	wantHistory := map[string][]exchangeRate{
		"BTC": {
			{value: 1.0, timestamp: time.Unix(1598832062, 0)}, // preexisting point
			{value: 10000.0, timestamp: time.Unix(1598918700, 0)},
			{value: 10001.0, timestamp: time.Unix(1598922501, 0)},
			{value: 2.0, timestamp: time.Unix(1599091262, 0)}, // preexisting point
		},
	}
	assert.Equal(t, wantHistory, updater.history, "updater.history")
}

func TestFetchGeckoMarketRangeInvalidCoinFiat(t *testing.T) {
	tt := []struct{ coin, fiat string }{
		{coins[0], "invalid"},
		{coins[0], ""},
		{"unsupported", fiats[0]},
		{"", fiats[0]},
	}
	for _, test := range tt {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		var updater RateUpdater
		_, err := updater.fetchGeckoMarketRange(ctx, test.coin, test.fiat, time.Now().Add(-time.Hour), time.Now())
		assert.Error(t, err, "fetchGeckoMarketRange(%q, %q) returned nil error", test.coin, test.fiat)
		cancel()
	}
}
