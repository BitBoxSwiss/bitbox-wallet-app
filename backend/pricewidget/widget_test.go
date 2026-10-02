// SPDX-License-Identifier: Apache-2.0

package pricewidget

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
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
	assert.Equal(t, []string{"btc", "eth", "ltc"}, state.Coins)
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
	assert.Equal(t, []string{"btc", "eth", "ltc"}, state.Coins)

	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth"}]}`)
	state, err = service.Load(dir, 1, false, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"eth"}, state.Coins)
	assert.Equal(t, "eth", state.CoinCode)
}

func TestCycleWithoutAccounts(t *testing.T) {
	dir := t.TempDir()
	service := New()
	for _, fixture := range []string{"", `{"accounts":[]}`} {
		if fixture != "" {
			writeFixture(t, dir, "accounts.json", fixture)
		}
		for index, coin := range map[int]string{0: "btc", 1: "eth", 2: "ltc", 3: "btc", -1: "ltc", -3: "btc"} {
			state, err := service.Load(dir, index, false, false)
			require.NoError(t, err)
			assert.Equal(t, []string{"btc", "eth", "ltc"}, state.Coins)
			assert.Equal(t, coin, state.CoinCode)
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
	assert.True(t, state.Retry)

	now = now.Add(cacheTTL)
	state, err = service.Load(dir, 0, true, false)
	require.NoError(t, err)
	assert.Nil(t, state.Price, "expired prices cannot be presented as fresh")
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

func TestWidgetHonorsProxy(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "config.json", `{"backend":{"proxy":{"useProxy":true,"proxyAddress":"127.0.0.1:9050"}}}`)
	service := New()
	service.fetch = func(_ context.Context, client *http.Client, _, _ string) (rates.WidgetData, error) {
		transport, ok := client.Transport.(*http.Transport)
		require.True(t, ok)
		require.NotNil(t, transport.Dial, "must use the configured SOCKS dialer")
		return rates.WidgetData{}, errors.New("offline")
	}
	state, err := service.Load(dir, 0, true, false)
	require.NoError(t, err)
	assert.Nil(t, state.Price)
	assert.True(t, state.Retry)
}

func TestNormalizedChart(t *testing.T) {
	assert.Equal(t, []float64{0.5, 0.5}, normalizedChart([]float64{100, 100}))
	assert.Equal(t, []float64{1, 0, 0.5}, normalizedChart([]float64{30, 10, 20}))
	assert.Empty(t, normalizedChart(nil))
}
