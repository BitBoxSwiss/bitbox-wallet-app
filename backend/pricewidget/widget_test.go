// SPDX-License-Identifier: Apache-2.0

package pricewidget

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeFixture(t *testing.T, dir, name, data string) {
	t.Helper()
	require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(data), 0600))
}

func TestSelectionAndPreferences(t *testing.T) {
	dir := t.TempDir()
	service := New()
	state, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"btc"}, state.Coins)
	assert.Equal(t, "USD", state.Currency)
	assert.Nil(t, state.Price)

	accounts := `{"accounts":[{"coinCode":"sepeth"},{"coinCode":"tbtc"},{"coinCode":"btc"},
		{"coinCode":"ltc"},{"coinCode":"eth-erc20-usdt"},{"coinCode":"eth","inactive":true},
		{"coinCode":"rbtc","hiddenBecauseUnused":true}]}`
	writeFixture(t, dir, "accounts.json", accounts)
	for _, currency := range []string{"CHF", "EUR", "BTC", "sat", "unknown"} {
		config := `{"backend":{"mainFiat":"` + currency + `"}}`
		writeFixture(t, dir, "config.json", config)
		for index, coin := range map[int]string{0: "btc", 1: "eth", 2: "ltc", 3: "btc", -1: "ltc"} {
			state, err := service.Load(dir, index, false, false)
			require.NoError(t, err)
			assert.Equal(t, []string{"btc", "eth", "ltc"}, state.Coins)
			assert.Equal(t, coin, state.CoinCode)
			assert.GreaterOrEqual(t, state.SelectedIndex, 0)
			assert.Equal(t, coin, state.Coins[state.SelectedIndex])
			wantCurrency := currency
			if currency != "CHF" && currency != "EUR" {
				wantCurrency = "USD"
			}
			assert.Equal(t, wantCurrency, state.Currency)
		}
		contents, err := os.ReadFile(filepath.Join(dir, "config.json"))
		require.NoError(t, err)
		assert.Equal(t, config, string(contents))
	}
	contents, err := os.ReadFile(filepath.Join(dir, "accounts.json"))
	require.NoError(t, err)
	assert.Equal(t, accounts, string(contents))

	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth","inactive":true},{"coinCode":"ltc","hiddenBecauseUnused":true}]}`)
	state, err = service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"btc"}, state.Coins)

	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth"}]}`)
	state, err = service.Load(dir, 1, false, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"eth"}, state.Coins)
	assert.Equal(t, "eth", state.CoinCode)
}

func TestBitcoinFallbackWithoutActiveAccounts(t *testing.T) {
	dir := t.TempDir()
	service := New()
	for _, fixture := range []string{
		"",
		`{"accounts":[]}`,
		`{"accounts":[{"coinCode":"eth","inactive":true},{"coinCode":"ltc","hiddenBecauseUnused":true}]}`,
		`{"accounts":[{"coinCode":"eth-erc20-usdt"}]}`,
	} {
		if fixture != "" {
			writeFixture(t, dir, "accounts.json", fixture)
		}
		for _, index := range []int{0, 1, 2, 3, -1, -3} {
			state, err := service.Load(dir, index, false, false)
			require.NoError(t, err)
			assert.Equal(t, []string{"btc"}, state.Coins)
			assert.Equal(t, "btc", state.CoinCode)
		}
	}
}

func TestCacheAndOfflineFallback(t *testing.T) {
	dir := t.TempDir()
	now := time.Unix(1700000000, 0)
	service := New()
	service.now = func() time.Time { return now }
	calls := 0
	offline := false
	service.fetch = func(_ context.Context, _ *http.Client, coin, currency string) (rates.WidgetData, error) {
		calls++
		if offline {
			return rates.WidgetData{}, errors.New("offline")
		}
		return rates.WidgetData{CoinCode: coin, Currency: currency, Price: 120, Change24h: 20,
			ChartPrices: []float64{100, 110, 120}}, nil
	}
	state, err := service.Load(dir, 0, true, false)
	require.NoError(t, err)
	require.NotNil(t, state.Price)
	assert.Equal(t, float64(120), *state.Price)
	assert.Equal(t, now.UnixMilli(), state.UpdatedAt)
	assert.Equal(t, []float64{0, 0.5, 1}, state.Chart)
	assert.Equal(t, 1, calls)
	path := cacheFile(dir, "btc", "USD").Path()
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())

	_, err = service.Load(dir, 0, true, false)
	require.NoError(t, err)
	assert.Equal(t, 1, calls, "fresh cache prevents another request")
	require.NoError(t, os.Chmod(path, 0644))
	_, err = service.Load(dir, 0, true, true)
	require.NoError(t, err)
	assert.Equal(t, 2, calls, "forced refresh bypasses cache")
	info, err = os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())

	offline = true
	state, err = service.Load(dir, 0, true, true)
	require.NoError(t, err)
	require.NotNil(t, state.Price)
	assert.False(t, state.Retry)
	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"CHF"}}`)
	state, err = service.Load(dir, 0, true, false)
	require.NoError(t, err)
	require.NotNil(t, state.Price)
	assert.Equal(t, "USD", state.Currency, "fallback quote must carry its actual currency")
	assert.Equal(t, now.UnixMilli(), state.UpdatedAt, "fallback retains its own refresh timestamp")
	assert.True(t, state.Retry)

	now = now.Add(cacheTTL)
	state, err = service.Load(dir, 0, true, false)
	require.NoError(t, err)
	assert.Nil(t, state.Price, "expired prices cannot be presented as fresh")
	assert.Zero(t, state.UpdatedAt)
	assert.Empty(t, state.Chart)
	assert.Equal(t, "CHF", state.Currency)
	assert.True(t, state.Retry)
}

func TestMalformedSettingsDoNotFetch(t *testing.T) {
	dir := t.TempDir()
	service := New()
	service.fetch = func(context.Context, *http.Client, string, string) (rates.WidgetData, error) {
		t.Fatal("must not fetch with unreadable proxy preferences")
		return rates.WidgetData{}, nil
	}
	writeFixture(t, dir, "config.json", `{"backend":`)
	_, err := service.Load(dir, 0, true, true)
	require.Error(t, err)
}

func TestFallbackExpiresDuringRefresh(t *testing.T) {
	for _, duration := range []time.Duration{4 * time.Second, 10 * time.Second} {
		t.Run(duration.String(), func(t *testing.T) {
			dir := t.TempDir()
			now := time.Unix(1700000000, 0)
			service := New()
			service.now = func() time.Time { return now }
			service.save(dir, rates.WidgetData{CoinCode: "btc", Currency: "USD", Price: 100,
				ChartPrices: []float64{90, 100}}, service.startRefresh())
			now = now.Add(cacheTTL - 5*time.Second)
			service.fetch = func(context.Context, *http.Client, string, string) (rates.WidgetData, error) {
				now = now.Add(duration)
				return rates.WidgetData{}, errors.New("offline")
			}
			state, err := service.Load(dir, 0, true, true)
			require.NoError(t, err)
			rendered, err := service.Load(dir, 0, false, false)
			require.NoError(t, err)
			assert.Equal(t, rendered.Price, state.Price)
			if duration < 5*time.Second {
				require.NotNil(t, state.Price)
				assert.False(t, state.Retry)
			} else {
				assert.Nil(t, state.Price)
				assert.Empty(t, state.Chart)
				assert.True(t, state.Retry)
			}
		})
	}
}

func TestFreshQuoteSurvivesCacheWriteFailure(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"btc"},{"coinCode":"eth"}]}`)
	now := time.Unix(1700000000, 0)
	service := New()
	service.now = func() time.Time { return now }
	// A directory at the cache file path makes writes fail on every platform.
	file := cacheFile(dir, "btc", "USD")
	require.NoError(t, os.MkdirAll(file.Path(), 0700))
	quote := rates.WidgetData{CoinCode: "btc", Currency: "USD", Price: 120, Change24h: 20,
		ChartPrices: []float64{100, 110, 120}}
	require.Error(t, file.WriteJSON(record{Data: quote, Timestamp: now}))
	service.fetch = func(context.Context, *http.Client, string, string) (rates.WidgetData, error) {
		return quote, nil
	}
	state, err := service.Load(dir, 0, true, false)
	require.NoError(t, err)
	require.NotNil(t, state.Price)
	assert.Equal(t, float64(120), *state.Price)
	assert.False(t, state.Retry)
	rendered, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.True(t, state.Refreshed)
	state.Refreshed = false
	assert.Equal(t, state, rendered, "rendering retains the fresh quote without a disk cache")

	otherCoin, err := service.Load(dir, 1, false, false)
	require.NoError(t, err)
	assert.Equal(t, "eth", otherCoin.CoinCode)
	assert.Nil(t, otherCoin.Price)
	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"CHF"}}`)
	fallback, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, "USD", fallback.Currency)
	assert.Equal(t, state.Price, fallback.Price)

	now = now.Add(cacheTTL)
	expired, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Nil(t, expired.Price, "memory cache must expire too")
	assert.Empty(t, expired.Chart)
}

func TestWidgetHonorsProxy(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "config.json", `{"backend":{"proxy":{"useProxy":true,"proxyAddress":"127.0.0.1:9050"}}}`)
	service := New()
	service.fetch = func(_ context.Context, client *http.Client, _, _ string) (rates.WidgetData, error) {
		transport, ok := client.Transport.(*http.Transport)
		require.True(t, ok)
		require.NotNil(t, transport.Dial, "must use the configured SOCKS dialer") //nolint:staticcheck // SA1019: socksproxy.GetHTTPClient configures only Dial.
		return rates.WidgetData{}, errors.New("offline")
	}
	state, err := service.Load(dir, 0, true, false)
	require.NoError(t, err)
	assert.Nil(t, state.Price)
	assert.True(t, state.Retry)
}

func TestOverlappingRefreshes(t *testing.T) {
	for _, test := range []struct {
		name       string
		newerFails bool
		expires    bool
		otherCoin  bool
	}{
		{name: "newer success wins"},
		{name: "newer failure permits older success", newerFails: true},
		{name: "expired newer quote cannot be replaced by older refresh", expires: true},
		{name: "ordering is per pair", otherCoin: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			dir := t.TempDir()
			writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"btc"},{"coinCode":"eth"}]}`)
			now := time.Unix(1700000000, 0)
			service := New()
			service.now = func() time.Time { return now }
			started, release := make(chan struct{}), make(chan struct{})
			unblock := sync.OnceFunc(func() { close(release) })
			defer unblock()
			var calls atomic.Int32
			service.fetch = func(_ context.Context, _ *http.Client, coin, currency string) (rates.WidgetData, error) {
				price := float64(200)
				if calls.Add(1) == 1 {
					close(started)
					<-release
					price = 100
				} else if test.newerFails {
					return rates.WidgetData{}, errors.New("offline")
				}
				return rates.WidgetData{CoinCode: coin, Currency: currency, Price: price,
					ChartPrices: []float64{90, price}}, nil
			}
			type result struct {
				state State
				err   error
			}
			done := make(chan result, 1)
			go func() {
				state, err := service.Load(dir, 0, true, true)
				done <- result{state, err}
			}()
			<-started
			index := 0
			if test.otherCoin {
				index = 1
			}
			_, err := service.Load(dir, index, true, true)
			require.NoError(t, err)
			newerTime := now
			if test.expires {
				now = now.Add(cacheTTL)
				expired, err := service.Load(dir, 0, false, false)
				require.NoError(t, err)
				assert.Nil(t, expired.Price)
			} else {
				now = now.Add(5 * time.Second)
			}
			unblock()
			older := <-done
			require.NoError(t, older.err)
			// A new service also checks the on-disk result after both requests finish.
			restarted := New()
			restarted.now = service.now
			cached, err := restarted.Load(dir, 0, false, false)
			require.NoError(t, err)
			older.state.Refreshed = false
			assert.Equal(t, cached, older.state)
			if test.expires {
				assert.Nil(t, cached.Price)
				assert.Zero(t, cached.UpdatedAt)
			} else {
				require.NotNil(t, cached.Price)
				want := float64(200)
				updatedAt := newerTime
				if test.newerFails || test.otherCoin {
					want = 100
					updatedAt = now
				}
				assert.Equal(t, want, *cached.Price)
				assert.Equal(t, updatedAt.UnixMilli(), cached.UpdatedAt)
			}
		})
	}
}

func TestNormalizedChart(t *testing.T) {
	assert.Equal(t, []float64{0.5, 0.5}, normalizedChart([]float64{100, 100}))
	assert.Equal(t, []float64{1, 0, 0.5}, normalizedChart([]float64{30, 10, 20}))
	assert.Empty(t, normalizedChart(nil))
}

func TestSelectionAfterWrappingAndRemovingAccount(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"btc"},{"coinCode":"eth"},{"coinCode":"ltc"}]}`)
	service := New()
	index := 0
	for range 3 {
		state, err := service.Load(dir, index+1, false, false)
		require.NoError(t, err)
		index = state.SelectedIndex
	}
	assert.Zero(t, index)
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"btc"},{"coinCode":"eth"}]}`)
	state, err := service.Load(dir, index, false, false)
	require.NoError(t, err)
	assert.Equal(t, "btc", state.CoinCode)
}

func TestCanceledFetchDoesNotSave(t *testing.T) {
	dir := t.TempDir()
	service := New()
	started := make(chan struct{})
	service.fetch = func(ctx context.Context, _ *http.Client, coin, currency string) (rates.WidgetData, error) {
		close(started)
		<-ctx.Done()
		// Even a response arriving during cancellation must not be cached.
		return rates.WidgetData{CoinCode: coin, Currency: currency, Price: 120, ChartPrices: []float64{100, 120}}, nil
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, err := service.LoadContext(ctx, dir, 0, true, true)
		done <- err
	}()
	<-started
	cancel()
	require.ErrorIs(t, <-done, context.Canceled)
	assert.Nil(t, service.cached(dir, "btc", "USD"))
	assert.NoFileExists(t, cacheFile(dir, "btc", "USD").Path())
}
