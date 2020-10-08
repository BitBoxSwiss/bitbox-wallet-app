package rates

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"
)

// See the following for docs and details: https://www.coingecko.com/en/api.
// Rate limit: 6k QPS per IP address.
const coingeckoAPIV3 = "https://api.coingecko.com/api/v3"

var (
	// Values are copied from https://api.coingecko.com/api/v3/coins/list.
	// TODO: Replace keys with coin.Code.
	geckoCoin = map[string]string{
		"BTC": "bitcoin",
		"LTC": "litecoin",
		"ETH": "ethereum",
		// Useful for testing with testnets.
		"TBTC": "bitcoin",
		"RBTC": "bitcoin",
		"TLTC": "litecoin",
		"TETH": "ethereum",
		"RETH": "ethereum",
		// ERC20 tokens as used in the backend.
		// Frontend and app config use unprefixed name, without "eth-erc20-".
		"eth-erc20-bat":  "basic-attention-token",
		"eth-erc20-dai":  "dai",
		"eth-erc20-link": "chainlink",
		"eth-erc20-mkr":  "maker",
		"eth-erc20-usdc": "usd-coin",
		"eth-erc20-usdt": "tether",
		"eth-erc20-zrx":  "0x",
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
	}
)

// EnableHistoryPair spins up a new goroutine to periodically update
// and backfill historical exchange rates.
// If a pair is unsupported or already enabled, EnableHistoryPair does nothing.
// The fiat arg is expected to be uppercase. Supported fiats are currently hardcoded
// in the unexported geckFiat map in this package.
func (updater *RateUpdater) EnableHistoryPair(coin, fiat string) {
	if geckoCoin[coin] == "" || geckoFiat[fiat] == "" {
		updater.log.Errorf("EnableHistoryPair(%q, %q): unsupported coin or fiat", coin, fiat)
		return
	}
	key := coin + fiat
	updater.historyMu.Lock()
	defer updater.historyMu.Unlock()
	if _, exist := updater.historyGo[key]; exist {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	updater.historyGo[key] = cancel
	go updater.historyUpdateLoop(ctx, coin, fiat)
	go updater.backfillHistory(ctx, coin, fiat)
}

// historyUpdateLoop periodically updates historical market exchange rates
// forward in time starting with the last fetched timestamp in a loop.
// It returns when the context is done.
func (updater *RateUpdater) historyUpdateLoop(ctx context.Context, coin, fiat string) {
	updater.log.Printf("started historyUpdateLoop for %s/%s", coin, fiat)
	for {
		// When to update next, after this loop iteration is done.
		untilNext := 10 * time.Minute // TODO: add jitter

		start := updater.historyLatestTimestamp(coin, fiat)
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
			_, err := updater.updateHistory(ctx, coin, fiat, start, now)
			// If ctx is done, this is ctx.Err() but we don't care because the <-ctx.Done()
			// select below will take care of it and exit.
			if err != nil {
				updater.log.Errorf("updateHistory(%s, %s, %s, %s): %v", coin, fiat, start, now, err)
				untilNext = time.Minute // TODO: exponential backoff
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
		untilNext := time.Second // TODO: add jitter

		end := updater.historyEarliestTimestamp(coin, fiat)
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
		// If ctx is done, this is ctx.Err() but we don't care because the <-ctx.Done()
		// select below will take care of it and exit.
		if err != nil {
			updater.log.Printf("updateHistory(%s, %s, %s, %s): %v", coin, fiat, start, end, err)
			untilNext = time.Minute // TODO: exponential backoff
		}
		// CoinGecko returns an empty list if we're too far back in history.
		// Use it to detect when to stop.
		// Unless the start/end range is suspiciously arbitrary close to current time.
		// It may indicate an API failure and we'll want to retry.
		if n == 0 {
			if time.Since(end) > 365*24*time.Hour {
				return
			}
			untilNext = time.Minute // TODO: exponential backoff
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
	rates, err := updater.fetchGeckoMarketRange(ctx, coin, fiat, start, end)
	if err != nil {
		return 0, err
	}

	key := coin + fiat
	updater.historyMu.Lock()
	defer updater.historyMu.Unlock()
	a := append(updater.history[key], rates...)
	sort.Slice(a, func(i, j int) bool {
		return a[i].timestamp.Before(a[j].timestamp)
	})
	updater.history[key] = a
	return len(rates), nil
}

func (updater *RateUpdater) historyLatestTimestamp(coin, fiat string) time.Time {
	key := coin + fiat
	updater.historyMu.RLock()
	defer updater.historyMu.RUnlock()
	var t time.Time
	if n := len(updater.history[key]); n > 0 {
		t = updater.history[key][n-1].timestamp
	}
	return t
}

func (updater *RateUpdater) historyEarliestTimestamp(coin, fiat string) time.Time {
	key := coin + fiat
	updater.historyMu.RLock()
	defer updater.historyMu.RUnlock()
	var t time.Time
	if len(updater.history[key]) > 0 {
		t = updater.history[key][0].timestamp
	}
	return t
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
