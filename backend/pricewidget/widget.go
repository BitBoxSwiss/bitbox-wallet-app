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
	UpdatedAt int64     `json:"updatedAt,omitempty"` // Last successful refresh, Unix milliseconds.
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
	cacheMu      sync.Mutex
	cache        map[string]record
	nextRefresh  uint64
	savedRefresh map[string]uint64
	now          func() time.Time
	fetch        func(context.Context, *http.Client, string, string) (rates.WidgetData, error)
}

// New creates the widget data service.
func New() *Service {
	return &Service{cache: make(map[string]record), savedRefresh: make(map[string]uint64),
		now: time.Now, fetch: rates.FetchWidgetData}
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
	selected := index % len(coins)
	if selected < 0 {
		selected += len(coins)
	}
	coin := coins[selected]
	currency := rates.WidgetCurrency(preferences.Backend.MainFiat)
	state := State{CoinCode: coin, Currency: currency, Coins: coins, Chart: []float64{}}
	cached := service.cached(dataDir, coin, currency)
	if fetch && (force || cached == nil) {
		refresh := service.startRefresh()
		proxy := socksproxy.NewSocksProxy(preferences.Backend.Proxy.UseProxy, preferences.Backend.Proxy.ProxyAddress)
		client, fetchErr := proxy.GetHTTPClient()
		if fetchErr == nil {
			defer client.CloseIdleConnections()
			var result rates.WidgetData
			result, fetchErr = service.fetch(context.Background(), client, coin, currency)
			if fetchErr == nil {
				service.save(dataDir, result, refresh)
			}
		}
		// A newer refresh may have completed, or the cached quote may have expired in flight.
		cached = service.cached(dataDir, coin, currency)
		if fetchErr != nil {
			state.Retry = cached == nil
			logging.Get().WithGroup("pricewidget").WithError(fetchErr).Debug("Price refresh failed")
		}
	}
	if cached == nil && currency != "USD" {
		cached = service.cached(dataDir, coin, "USD")
	}
	if cached != nil {
		state.Currency = cached.Data.Currency
		state.Price = &cached.Data.Price
		state.Change24h = &cached.Data.Change24h
		state.Chart = normalizedChart(cached.Data.ChartPrices)
		state.UpdatedAt = cached.Timestamp.UnixMilli()
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
		code, err := rates.WidgetCoinCode(account.CoinCode)
		if err == nil && !account.Inactive && !account.HiddenBecauseUnused && !slices.Contains(coins, code) {
			coins = append(coins, code)
		}
	}
	slices.Sort(coins)
	if len(coins) == 0 {
		// Keep a Bitcoin quote available when no supported accounts are active.
		coins = []string{"btc"}
	}
	return coins, nil
}

func cacheFile(dataDir, coin, currency string) *config.File {
	return config.NewFile(filepath.Join(config.CacheDir(dataDir), "price-widget"), coin+"_"+currency+".json")
}

func (service *Service) cached(dataDir, coin, currency string) *record {
	service.cacheMu.Lock()
	defer service.cacheMu.Unlock()
	file := cacheFile(dataDir, coin, currency)
	cached, ok := service.cache[file.Path()]
	if !ok {
		if err := file.ReadJSON(&cached); err != nil {
			return nil
		}
	}
	age := service.now().Sub(cached.Timestamp)
	if age < 0 || age >= cacheTTL || cached.Data.CoinCode != coin || cached.Data.Currency != currency ||
		cached.Data.Price <= 0 || len(cached.Data.ChartPrices) < 2 {
		delete(service.cache, file.Path())
		return nil
	}
	return &cached
}

func (service *Service) startRefresh() uint64 {
	service.cacheMu.Lock()
	defer service.cacheMu.Unlock()
	service.nextRefresh++
	return service.nextRefresh
}

func (service *Service) save(dataDir string, data rates.WidgetData, refresh uint64) {
	service.cacheMu.Lock()
	defer service.cacheMu.Unlock()
	file := cacheFile(dataDir, data.CoinCode, data.Currency)
	// Canceled Android workers can finish later. Order successful refreshes by their start sequence.
	if refresh < service.savedRefresh[file.Path()] {
		return
	}
	service.savedRefresh[file.Path()] = refresh
	cached := record{Data: data, Timestamp: service.now()}
	// Rendering must not depend on disk persistence succeeding.
	service.cache[file.Path()] = cached
	if err := file.WriteJSON(cached); err != nil {
		logging.Get().WithGroup("pricewidget").WithError(errp.WithStack(err)).Warn("Could not cache widget prices")
	}
}

func normalizedChart(prices []float64) []float64 {
	points := slices.Repeat([]float64{0.5}, len(prices))
	if len(prices) == 0 {
		return points
	}
	low, high := slices.Min(prices), slices.Max(prices)
	span := high - low
	if !(span > 0) || math.IsInf(span, 0) {
		return points
	}
	for i, price := range prices {
		points[i] = (price - low) / span
	}
	return points
}
