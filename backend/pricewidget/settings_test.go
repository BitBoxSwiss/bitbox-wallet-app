// SPDX-License-Identifier: Apache-2.0

package pricewidget

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUnreadableSettingsRetainDisplayAcrossRestarts(t *testing.T) {
	for _, failure := range []string{"malformed", "missing", "unreadable"} {
		t.Run(failure, func(t *testing.T) {
			dir := t.TempDir()
			writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"CHF","proxy":{"useProxy":true,"proxyAddress":"127.0.0.1:9050"}}}`)
			writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth"}]}`)
			now := time.Unix(1700000000, 0)
			service := New()
			service.now = func() time.Time { return now }
			service.save(dir, rates.WidgetData{CoinCode: "eth", Currency: "CHF", Price: 120,
				ChartPrices: []float64{100, 120}}, service.startRefresh())
			before, err := service.Load(dir, 0, false, false)
			require.NoError(t, err)
			require.NotNil(t, before.Price)
			for _, name := range []string{"config.json", "accounts.json"} {
				require.NoError(t, os.Remove(filepath.Join(dir, name)))
				switch failure {
				case "malformed":
					writeFixture(t, dir, name, `{`)
				case "unreadable":
					require.NoError(t, os.Mkdir(filepath.Join(dir, name), 0700))
				}
			}
			for _, current := range []*Service{service, New()} {
				current.now = service.now
				current.fetch = func(context.Context, *http.Client, string, string) (rates.WidgetData, error) {
					t.Fatal("must not fetch without readable proxy preferences")
					return rates.WidgetData{}, nil
				}
				after, err := current.Load(dir, 0, false, false)
				require.NoError(t, err)
				assert.Equal(t, before, after)
				after, err = current.Load(dir, 0, true, true)
				require.NoError(t, err)
				assert.True(t, after.Retry)
				assert.False(t, after.Refreshed)
				assert.Equal(t, before.Price, after.Price)
			}

			now = now.Add(cacheTTL)
			expired, err := service.Load(dir, 0, false, false)
			require.NoError(t, err)
			assert.Equal(t, "eth", expired.CoinCode)
			assert.Equal(t, "CHF", expired.Currency)
			assert.Nil(t, expired.Price)
			assert.Zero(t, expired.UpdatedAt)
			assert.Empty(t, expired.Chart)

			// Only the widget's own display snapshot is persisted, not proxy settings.
			data, err := os.ReadFile(settingsFile(dir).Path())
			require.NoError(t, err)
			assert.JSONEq(t, `{"currency":"CHF","coins":["eth"]}`, string(data))
			info, err := os.Stat(settingsFile(dir).Path())
			require.NoError(t, err)
			assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
		})
	}
}

func TestSettingsSynchronizeIndependentlyAndRecover(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"CHF"}}`)
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth"}]}`)
	service := New()
	_, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)

	// JSON decoding can populate some fields before reporting a type error.
	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"EUR","proxy":{"useProxy":"invalid"}}}`)
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"ltc"}]}`)
	state, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, "CHF", state.Currency)
	assert.Equal(t, []string{"ltc"}, state.Coins)

	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"EUR"}}`)
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"btc","inactive":"invalid"}]}`)
	state, err = service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, "EUR", state.Currency)
	assert.Equal(t, []string{"ltc"}, state.Coins)
	service.fetch = func(_ context.Context, _ *http.Client, coin, currency string) (rates.WidgetData, error) {
		assert.Equal(t, "ltc", coin)
		assert.Equal(t, "EUR", currency)
		return rates.WidgetData{CoinCode: coin, Currency: currency, Price: 120,
			ChartPrices: []float64{100, 120}}, nil
	}
	state, err = service.Load(dir, 0, true, true)
	require.NoError(t, err)
	assert.True(t, state.Refreshed, "fetching resumes when the proxy configuration is readable")
	assert.False(t, state.Retry)

	// A successfully read empty list clears the saved accounts rather than retaining them.
	writeFixture(t, dir, "accounts.json", `{"accounts":[]}`)
	state, err = service.Load(dir, 1, false, false)
	require.NoError(t, err)
	assert.Equal(t, "btc", state.CoinCode)
	assert.Equal(t, []string{"btc"}, state.Coins)
	assert.Zero(t, state.SelectedIndex)
	assert.Equal(t, "EUR", state.Currency)
}

func TestSettingsPersistenceFailureRetainsMemoryAndRetries(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "config.json", `{"backend":{"mainFiat":"CHF"}}`)
	writeFixture(t, dir, "accounts.json", `{"accounts":[{"coinCode":"eth"}]}`)
	file := settingsFile(dir)
	require.NoError(t, os.MkdirAll(file.Path(), 0700))
	service := New()
	before, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	writeFixture(t, dir, "config.json", `{`)
	writeFixture(t, dir, "accounts.json", `{`)
	after, err := service.Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, before, after)
	require.NoError(t, os.Remove(file.Path()))
	_, err = service.Load(dir, 0, false, false)
	require.NoError(t, err)
	restarted, err := New().Load(dir, 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, before, restarted)

	// A different app data directory must not inherit these preferences.
	other, err := service.Load(t.TempDir(), 0, false, false)
	require.NoError(t, err)
	assert.Equal(t, "USD", other.Currency)
	assert.Equal(t, []string{"btc"}, other.Coins)
}
