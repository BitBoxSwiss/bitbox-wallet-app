package rates

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"
)

// CoinGeckoRateLimit specifies the minimal interval between equally spaced
// API calls. From https://www.coingecko.com/en/api:
// > Generous rate limits with up to 100 requests/minute
// We use slightly lower value.
const CoinGeckoRateLimit = 2 * time.Second

// See the following for docs and details: https://www.coingecko.com/en/api.
// Rate limit: 6k QPS per IP address.
const coingeckoAPIV3 = "https://api.coingecko.com/api/v3"

var (
	// Values are copied from https://api.coingecko.com/api/v3/coins/list.
	// TODO: Replace keys with coin.Code.
	geckoCoin = map[string]string{
		"btc": "bitcoin",
		"ltc": "litecoin",
		"eth": "ethereum",
		// Useful for testing with testnets.
		"tbtc": "bitcoin",
		"rbtc": "bitcoin",
		"tltc": "litecoin",
		"teth": "ethereum",
		"reth": "ethereum",
		// ERC20 tokens as used in the backend.
		// Frontend and app config use unprefixed name, without "eth-erc20-".
		"eth-erc20-bat":       "basic-attention-token",
		"eth-erc20-dai0x6b17": "dai",
		"eth-erc20-link":      "chainlink",
		"eth-erc20-mkr":       "maker",
		"eth-erc20-sai0x89d2": "sai",
		"eth-erc20-usdc":      "usd-coin",
		"eth-erc20-usdt":      "tether",
		"eth-erc20-zrx":       "0x",
	}

	// Copied from https://api.coingecko.com/api/v3/simple/supported_vs_currencies.
	// The keys must match entries in fiats slice.
	geckoFiat = map[string]string{
		"USD": "usd",
		"EUR": "eur",
		"CHF": "chf",
		"GBP": "gbp",
		"JPY": "jpy",
		"KRW": "krw",
		"CNY": "cny",
		"RUB": "rub",
		"CAD": "cad",
		"AUD": "aud",
		"ILS": "ils",
		"BTC": "btc",
	}
)

// ReconfigureHistory resets all currently running historical rates goroutines.
// The end result is only coin/fiat pairs present in the arguments are active.
// Duplicate or unsupported values in coins and fiats are ignored.
// Supported fiats are currently hardcoded in the unexported geckoFiat map in this package.
func (updater *RateUpdater) ReconfigureHistory(coins, fiats []string) {
	updater.log.Printf("ReconfigureHistory: coins=%q; fiats=%q", coins, fiats)
	updater.historyMu.Lock()
	defer updater.historyMu.Unlock()
	// Stop all running history goroutines.
	for key, stop := range updater.historyGo {
		stop()
		delete(updater.historyGo, key)
	}
	// Enable those requested.
	for _, coin := range coins {
		if geckoCoin[coin] == "" {
			updater.log.Errorf("ReconfigureHistory: unsupported coin %q", coin)
			continue
		}
		for _, fiat := range fiats {
			if geckoFiat[fiat] == "" {
				updater.log.Errorf("ReconfigureHistory: unsupported fiat %q", fiat)
				continue
			}
			key := coin + fiat
			// The coins+fiats args may have duplicates.
			if _, exists := updater.historyGo[key]; exists {
				continue // already running
			}
			if rates, err := updater.loadHistoryBucket(key); err != nil {
				// Non-critical: can continue without database cache.
				updater.log.Errorf("loadHistoryBucket(%q): %v", key, err)
			} else {
				updater.history[key] = rates
			}
			ctx, cancel := context.WithCancel(context.Background())
			updater.historyGo[key] = cancel
			go updater.historyUpdateLoop(ctx, coin, fiat)
			go updater.backfillHistory(ctx, coin, fiat)
		}
	}
}

// stopAllHistory shuts down all historical exchange rates goroutines.
// It may return before the goroutines have exited.
func (updater *RateUpdater) stopAllHistory() {
	updater.ReconfigureHistory(nil, nil)
}

// historyUpdateLoop periodically updates historical market exchange rates
// forward in time starting with the last fetched timestamp in a loop.
// It returns when the context is done.
func (updater *RateUpdater) historyUpdateLoop(ctx context.Context, coin, fiat string) {
	updater.log.Printf("started historyUpdateLoop for %s/%s", coin, fiat)
	for {
		// When to update next, after this loop iteration is done.
		untilNext := time.Minute + time.Duration(rand.Intn(30))*time.Second

		start := updater.HistoryLatestTimestamp(coin, fiat)
		// When zero, there's no point in fetching data here because the backfillHistory
		// will kick in and fill it up for the past 90 days anyway.
		if !start.IsZero() {
			// Start slightly past the last fetched timestamp
			start = start.Add(10 * time.Minute)
			// TODO: Handle the case where (now - start) > 90 days to get hourly rates?
			now := time.Now()
			// It's ok if start == now or now < start. CoinGecko simply returns no results.
			// It's also ok if our "now" doesn't match CoinGecko: it always returns
			// the latest available data without errors.
			if _, err := updater.updateHistory(ctx, coin, fiat, start, now); err != nil {
				// Reduce logging by omitting context.Canceled error which simply indiates
				// the context is done and we are exiting from the loop.
				// All other errors indicate we should retry.
				if err != context.Canceled {
					updater.log.Errorf("updateHistory(%s, %s, %s, %s): %v", coin, fiat, start, now, err)
					untilNext = time.Second // TODO: exponential backoff
				}
			}
		}

		select {
		case <-ctx.Done():
			updater.log.Printf("stopped historyUpdateLoop for %s/%s: %v", coin, fiat, ctx.Err())
			return
		case <-time.After(untilNext):
			// continue next iteration
		}
	}
}

// backfillHistory fetches historical market exchange rates starting with
// the earliest fetched timestamp backwards until data is available at the API endpoint.
//
// It does so in a loop and returns only after all data is backfilled or the context is done.
// Callers are expected to run this in a separate goroutine.
func (updater *RateUpdater) backfillHistory(ctx context.Context, coin, fiat string) {
	updater.log.Printf("started backfillHistory for %s/%s", coin, fiat)
	for {
		// When to update next, after this loop iteration is done.
		untilNext := time.Duration(1+rand.Intn(5)) * time.Second

		end := updater.HistoryEarliestTimestamp(coin, fiat)
		var start time.Time
		if end.IsZero() {
			// First time; don't have historical data yet.
			end = time.Now()
			// 90 days is the max interval which CoinGecko responds to with hourly timeseries.
			// Make sure we get hourly rates by requesting 90 days minus 1 hour, just in case.
			start = end.Add(-90*24*time.Hour + time.Hour)
		} else {
			// End at the day earlier than the last known timestamp.
			// We want daily rates for timestamps past the first 90 days: use annual intervals.
			end = end.Add(-24 * time.Hour)
			start = end.Add(-365 * 24 * time.Hour)
		}

		n, err := updater.updateHistory(ctx, coin, fiat, start, end)
		switch {
		case err == nil:
			// CoinGecko returns an empty list if we're too far back in history.
			// Use it to detect when to stop.
			// Unless the start/end range is suspiciously arbitrary close to current time.
			// It may indicate an API failure and we'll want to retry.
			if n == 0 {
				if time.Since(end) > 365*24*time.Hour {
					updater.log.Printf("backfillHistory for %s/%s: reached end of data at %s", coin, fiat, start)
					return
				}
				untilNext = time.Second // TODO: exponential backoff
			}
		case err != nil:
			// Reduce logging by omitting context.Canceled error which simply indiates
			// the context is done and we are exiting from the loop.
			// All other errors indicate we should retry.
			if err != context.Canceled {
				updater.log.Printf("updateHistory(%s, %s, %s, %s): %v", coin, fiat, start, end, err)
				untilNext = time.Second // TODO: exponential backoff
			}
		}

		select {
		case <-ctx.Done():
			updater.log.Printf("stopped backfillHistory for %s/%s: %v", coin, fiat, ctx.Err())
			return
		case <-time.After(untilNext):
			// continue next iteration
		}
	}
}

// updateHistory fetches and stores historical data for later use.
// It returns a number of the newly fetched and stored entries.
// The data is stored in updater.history.
func (updater *RateUpdater) updateHistory(ctx context.Context, coin, fiat string, start, end time.Time) (n int, err error) {
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	fetchedRates, err := updater.fetchGeckoMarketRange(ctx, coin, fiat, start, end)
	if err != nil {
		return 0, err
	}

	key := coin + fiat
	updater.historyMu.Lock()
	defer updater.historyMu.Unlock()
	allRates := append(updater.history[key], fetchedRates...)
	sort.Slice(allRates, func(i, j int) bool {
		return allRates[i].timestamp.Before(allRates[j].timestamp)
	})
	updater.history[key] = allRates
	if err := updater.dumpHistoryBucket(key, allRates); err != nil {
		// Non-critical: can continue without persistent DB.
		updater.log.Errorf("dumpHistoryBucket(%q): %v", key, err)
	}

	return len(fetchedRates), nil
}

// HistoryLatestTimestamp reports the most recent timestamp at which an exchange rate
// is available for the given coin/fiat pair.
func (updater *RateUpdater) HistoryLatestTimestamp(coin, fiat string) time.Time {
	key := coin + fiat
	updater.historyMu.RLock()
	defer updater.historyMu.RUnlock()
	var t time.Time
	if n := len(updater.history[key]); n > 0 {
		t = updater.history[key][n-1].timestamp
	}
	return t
}

// HistoryEarliestTimestamp reports the oldest timestamp at which an exchange rate
// is available for the given coin/fiat pair.
func (updater *RateUpdater) HistoryEarliestTimestamp(coin, fiat string) time.Time {
	key := coin + fiat
	updater.historyMu.RLock()
	defer updater.historyMu.RUnlock()
	var t time.Time
	if len(updater.history[key]) > 0 {
		t = updater.history[key][0].timestamp
	}
	return t
}

// HistoryLatestTimestampAll returns the latest timestamp for which there an exchange rates is
// available for all coins. In other words: the earliest of all latest timestamps.
func (updater *RateUpdater) HistoryLatestTimestampAll(coins []string, fiat string) time.Time {
	var result time.Time
	for _, coin := range coins {
		latest := updater.HistoryLatestTimestamp(coin, fiat)
		if latest.IsZero() {
			return latest
		}
		if result.IsZero() || latest.Before(result) {
			result = latest
		}
	}
	return result
}

// fetchGeckoMarketRange slurps historical exchange rates using CoinGecko's
// "market_chart/range" API.
func (updater *RateUpdater) fetchGeckoMarketRange(ctx context.Context, coin, fiat string, start, end time.Time) ([]exchangeRate, error) {
	gcoin := geckoCoin[coin]
	if gcoin == "" {
		return nil, fmt.Errorf("fetchGeckoMarketRange: unsupported coin %s", coin)
	}
	gfiat := geckoFiat[fiat]
	if gfiat == "" {
		return nil, fmt.Errorf("fetchGeckoMarketRange: unsupported fiat %s", fiat)
	}
	param := url.Values{
		"from":        {strconv.FormatInt(start.Unix(), 10)},
		"to":          {strconv.FormatInt(end.Unix(), 10)},
		"vs_currency": {gfiat},
	}
	endpoint := fmt.Sprintf("%s/coins/%s/market_chart/range?%s", updater.coingeckoURL, gcoin, param.Encode())
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	res, err := updater.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer res.Body.Close() //nolint:errcheck
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetchGeckoMarketRange: bad response code %d", res.StatusCode)
	}
	var jsonBody struct {
		Prices [][2]float64 // [timestamp in milliseconds, value], sorted by timestamp asc
	}
	// 1Mb is more than enough for a single response.
	// For comparison, a range of 15 days is about 14Kb.
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&jsonBody); err != nil {
		return nil, err
	}

	rates := make([]exchangeRate, len(jsonBody.Prices))
	for i, v := range jsonBody.Prices {
		rates[i] = exchangeRate{
			value:     v[1],
			timestamp: time.Unix(int64(v[0])/1000, 0), // local timezone
		}
	}
	return rates, nil
}
