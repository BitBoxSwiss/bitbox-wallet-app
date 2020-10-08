// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package rates

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
)

// If modified, also update geckoCoin map.
var coins = []string{"BTC", "LTC", "ETH", "USDT", "LINK", "MKR", "ZRX", "DAI", "BAT", "USDC"}

// If modified, also update geckoFiat map.
var fiats = []string{"USD", "EUR", "CHF", "GBP", "JPY", "KRW", "CNY", "RUB", "CAD", "AUD", "ILS"}

const interval = time.Minute
const cryptoCompareURL = "https://min-api.cryptocompare.com/data/pricemulti?fsyms=%s&tsyms=%s"

type exchangeRate struct {
	value     float64
	timestamp time.Time
}

// RateUpdater provides cryptocurrency-to-fiat conversion rates.
type RateUpdater struct {
	observable.Implementation

	httpClient *http.Client
	log        *logrus.Entry

	// last contains most recent conversion to fiat, keyed by a coin.
	last map[string]map[string]float64

	historyMu sync.RWMutex // guards both history and historyGo
	// history contains historical conversion rates in asc order, keyed by coin+fiat pair.
	// For example, BTC/CHF pair's key is "BTCCHF".
	// TODO: store in bolt DB
	history map[string][]exchangeRate
	// historyGo contains context canceling funcs to stop periodic updates
	// of historical data, keyed by coin+fiat pair.
	// For example, BTC/EUR pair's key is "BTCEUR".
	historyGo map[string]context.CancelFunc

	// CoinGecko is where updater gets the historical conversion rates.
	// See https://www.coingecko.com/en/api for details.
	coingeckoURL string
}

// NewRateUpdater returns a new rates updater.
func NewRateUpdater(client *http.Client) *RateUpdater {
	return &RateUpdater{
		last:         make(map[string]map[string]float64),
		history:      make(map[string][]exchangeRate),
		historyGo:    make(map[string]context.CancelFunc),
		log:          logging.Get().WithGroup("rates"),
		httpClient:   client,
		coingeckoURL: coingeckoAPIV3,
	}
}

// Last returns the most recent conversion rates.
// The returned map is keyed by a crypto coin with values mapped by fiat rates.
// RateUpdater assumes the returned value is never modified by the callers.
func (updater *RateUpdater) Last() map[string]map[string]float64 {
	return updater.last
}

// PriceAt returns a historical exchange rate for the given coin.
// The returned value may be imprecise if at arg matches no timestamp exactly.
// In this case, linear interpolation is used as an approximation.
// If no data is available with the given args, PriceAt returns 0.
func (updater *RateUpdater) PriceAt(coin, fiat string, at time.Time) float64 {
	updater.historyMu.RLock()
	defer updater.historyMu.RUnlock()
	data := updater.history[coin+fiat]
	if len(data) == 0 {
		return 0 // no data at all
	}
	// Find an index of the first entry older or equal the at timestamp.
	idx := sort.Search(len(data), func(i int) bool {
		return !data[i].timestamp.Before(at)
	})
	if idx == len(data) || (idx == 0 && !data[idx].timestamp.Equal(at)) {
		return 0 // no data
	}
	if data[idx].timestamp.Equal(at) {
		return data[idx].value // don't need to interpolate
	}

	// Approximate value, somewhere between a and b.
	// https://en.wikipedia.org/wiki/Linear_interpolation#Linear_interpolation_as_approximation
	a := data[idx-1]
	b := data[idx]
	x := float64((at.Unix() - a.timestamp.Unix())) / float64((b.timestamp.Unix() - a.timestamp.Unix()))
	return a.value + x*(b.value-a.value)
}

// Start spins up the updater's goroutines to periodically update current exchange rates.
// It returns immediately.
// To initiate historical exchange rates update, the callers can use EnableHistoryPair.
func (updater *RateUpdater) Start() {
	go updater.lastUpdateLoop()
}

// lastUpdateLoop periodically updates most recent exchange rates.
// It never returns.
func (updater *RateUpdater) lastUpdateLoop() {
	for {
		updater.updateLast()
		time.Sleep(interval)
	}
}

func (updater *RateUpdater) updateLast() {
	url := fmt.Sprintf(cryptoCompareURL,
		strings.Join(coins, ","),
		strings.Join(fiats, ","),
	)
	response, err := updater.httpClient.Get(url)
	if err != nil {
		updater.log.WithError(err).WithField("url", url).Error("Error getting rates")
		updater.last = nil
		return
	}
	defer func() {
		_ = response.Body.Close()
	}()

	var rates map[string]map[string]float64
	const max = 10240
	responseBody, err := ioutil.ReadAll(io.LimitReader(response.Body, max+1))
	if err != nil {
		updater.last = nil
		return
	}
	if len(responseBody) > max {
		updater.log.Errorf("rates response too long (> %d bytes)", max)
		updater.last = nil
		return
	}
	if err := json.Unmarshal(responseBody, &rates); err != nil {
		updater.log.WithError(err).Errorf("could not parse rates response: %s", string(responseBody))
		updater.last = nil
		return
	}

	if reflect.DeepEqual(rates, updater.last) {
		return
	}

	updater.last = rates
	updater.Notify(observable.Event{
		Subject: "rates",
		Action:  action.Replace,
		Object:  rates,
	})
}
