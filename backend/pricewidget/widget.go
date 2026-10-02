// SPDX-License-Identifier: Apache-2.0

// Package pricewidget supplies home-screen widgets without starting the wallet backend.
package pricewidget

import (
	"context"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
)

const cacheTTL = 10 * time.Minute

// State contains display values. Chart points are normalized to the range 0..1.
type State struct {
	CoinCode  string    `json:"coinCode"`
	Currency  string    `json:"currency"`
	Coins     []string  `json:"coins"`
	Price     *float64  `json:"price"`
	Change24h *float64  `json:"change24h"`
	Chart     []float64 `json:"chart"`
	Retry     bool      `json:"retry"`
}

type record struct {
	Data      rates.WidgetData `json:"data"`
	Timestamp time.Time        `json:"timestamp"`
}

type settings struct {
	Backend struct {
		MainFiat string `json:"mainFiat"`
		Proxy    struct {
			UseProxy     bool   `json:"useProxy"`
			ProxyAddress string `json:"proxyAddress"`
		} `json:"proxy"`
	} `json:"backend"`
}

// Service manages a separate widget cache; it never writes wallet settings or accounts.
type Service struct {
	cacheMu sync.Mutex
	now     func() time.Time
	fetch   func(context.Context, *http.Client, string, string) (rates.WidgetData, error)
}

// New creates the widget data service.
func New() *Service {
	return &Service{now: time.Now, fetch: rates.FetchWidgetData}
}

// Load resolves the selected account and quote. With fetch=false it performs no network requests.
// A forced refresh tries the network before falling back to an unexpired cache entry.
func (service *Service) Load(dataDir string, index int, fetch, force bool) (State, error) {
	var preferences settings
	if err := readOptional(dataDir, "config.json", &preferences); err != nil {
		return State{}, err
	}
	coins, err := activeCoins(dataDir)
	if err != nil {
		return State{}, err
	}
	coin := coins[((index%len(coins))+len(coins))%len(coins)]
	currency := rates.WidgetCurrency(preferences.Backend.MainFiat)
	state := State{CoinCode: coin, Currency: currency, Coins: coins, Chart: []float64{}}
	exact := service.cached(dataDir, coin, currency)
	data := exact
	if fetch && (force || exact == nil) {
		proxy := socksproxy.NewSocksProxy(preferences.Backend.Proxy.UseProxy, preferences.Backend.Proxy.ProxyAddress)
		client, fetchErr := proxy.GetHTTPClient()
		if fetchErr == nil {
			defer client.CloseIdleConnections()
			var result rates.WidgetData
			result, fetchErr = service.fetch(context.Background(), client, coin, currency)
			if fetchErr == nil {
				data = &result
				service.save(dataDir, result)
			}
		}
		if fetchErr != nil {
			state.Retry = exact == nil
			logging.Get().WithGroup("pricewidget").WithError(fetchErr).Debug("Price refresh failed")
		}
	}
	if data == nil && currency != "USD" {
		data = service.cached(dataDir, coin, "USD")
	}
	if data != nil {
		state.Currency = data.Currency
		state.Price = &data.Price
		state.Change24h = &data.Change24h
		state.Chart = normalizedChart(data.ChartPrices)
	}
	return state, nil
}

func readOptional(dir, name string, result interface{}) error {
	err := config.NewFile(dir, name).ReadJSON(result)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func activeCoins(dataDir string) ([]string, error) {
	var accounts struct {
		Accounts []struct {
			CoinCode            string `json:"coinCode"`
			Inactive            bool   `json:"inactive"`
			HiddenBecauseUnused bool   `json:"hiddenBecauseUnused"`
		} `json:"accounts"`
	}
	if err := readOptional(dataDir, "accounts.json", &accounts); err != nil {
		return nil, err
	}
	var coins []string
	for _, account := range accounts.Accounts {
		code := rates.WidgetCoinCode(account.CoinCode)
		if code != "" && !account.Inactive && !account.HiddenBecauseUnused && !slices.Contains(coins, code) {
			coins = append(coins, code)
		}
	}
	slices.Sort(coins)
	if len(coins) == 0 {
		// Allow browsing market prices before wallet accounts have been set up.
		coins = []string{"btc", "eth", "ltc"}
	}
	return coins, nil
}

func cacheFile(dataDir, coin, currency string) *config.File {
	return config.NewFile(filepath.Join(dataDir, "cache", "price-widget"), coin+"_"+currency+".json")
}

func (service *Service) cached(dataDir, coin, currency string) *rates.WidgetData {
	service.cacheMu.Lock()
	defer service.cacheMu.Unlock()
	var cached record
	if err := cacheFile(dataDir, coin, currency).ReadJSON(&cached); err != nil {
		return nil
	}
	age := service.now().Sub(cached.Timestamp)
	if age < 0 || age >= cacheTTL || cached.Data.CoinCode != coin || cached.Data.Currency != currency ||
		cached.Data.Price <= 0 || len(cached.Data.ChartPrices) < 2 {
		return nil
	}
	return &cached.Data
}

func (service *Service) save(dataDir string, data rates.WidgetData) {
	service.cacheMu.Lock()
	defer service.cacheMu.Unlock()
	if err := cacheFile(dataDir, data.CoinCode, data.Currency).WriteJSON(record{Data: data, Timestamp: service.now()}); err != nil {
		logging.Get().WithGroup("pricewidget").WithError(errp.WithStack(err)).Warn("Could not cache widget prices")
	}
}

func normalizedChart(prices []float64) []float64 {
	if len(prices) == 0 {
		return []float64{}
	}
	low, high := slices.Min(prices), slices.Max(prices)
	points := make([]float64, len(prices))
	for i, price := range prices {
		points[i] = 0.5
		if high > low && !math.IsInf(high-low, 0) {
			points[i] = (price - low) / (high - low)
		}
	}
	return points
}
