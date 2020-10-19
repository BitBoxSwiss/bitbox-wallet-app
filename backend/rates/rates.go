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

	bbolt "github.com/coreos/bbolt"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
)

// TODO: Unify these with geckoCoin map.
var coins = []string{"BTC", "LTC", "ETH", "USDT", "LINK", "MKR", "ZRX", "SAI", "DAI", "BAT", "USDC"}

// TODO: Unify these with geckoFiat map.
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
	// stopLastUpdateLoop is the cancel function of the lastUpdateLoop context.
	stopLastUpdateLoop context.CancelFunc

	// historyDB is an internal cached copy of history, transparent to the users.
	// While RateUpdater can function without a valid historyDB,
	// it may be impacted by API rate limits.
	historyDB *bbolt.DB

	historyMu sync.RWMutex // guards both history and historyGo
	// history contains historical conversion rates in asc order, keyed by coin+fiat pair.
	// For example, BTC/CHF pair's key is "btcCHF".
	history map[string][]exchangeRate
	// historyGo contains context canceling funcs to stop periodic updates
	// of historical data, keyed by coin+fiat pair.
	// For example, BTC/EUR pair's key is "btcEUR".
	historyGo map[string]context.CancelFunc

	// CoinGecko is where updater gets the historical conversion rates.
	// See https://www.coingecko.com/en/api for details.
	coingeckoURL string
}

// NewRateUpdater returns a new rates updater.
// The dbdir argument is the location of a historical rates database cache.
// The returned updater can function without a valid database cache but may be
// impacted by rate limits. The database cache is transparent to the updater users.
//
// Both Last and PriceAt of the newly created updater always return zero values
// until data is fetched from the external APIs. To make the updater start fetching data
// the caller can use StartCurrentRates and ReconfigureHistory, respectively.
//
// The caller is advised to always call Stop as soon as the updater is no longer needed
// to free up all used resources.
func NewRateUpdater(client *http.Client, dbdir string) *RateUpdater {
	log := logging.Get().WithGroup("rates")
	db, err := openRatesDB(dbdir)
	if err != nil {
		log.Errorf("openRatesDB(%q): %v; database is unusable", dbdir, err)
		// To avoid null pointer dereference in other methods where historyDB
		// is used, use an unopened DB instance. This simplifies code, reducing
		// the number of nil checks and an additional mutex.
		// An unopened DB will simply return bbolt.ErrDatabaseNotOpen on all operations.
		db = &bbolt.DB{}
	}
	return &RateUpdater{
		last:         make(map[string]map[string]float64),
		history:      make(map[string][]exchangeRate),
		historyGo:    make(map[string]context.CancelFunc),
		historyDB:    db,
		log:          log,
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

// StartCurrentRates spins up the updater's goroutines to periodically update
// current exchange rates. It returns immediately.
// StartCurrentRates panics if called twice, even after Stop'ed.
//
// To initiate historical exchange rates update, the caller can use ReconfigureHistory.
// The current and historical exchange rates are independent from each other.
//
// StartCurrentRates is unsafe for concurrent use.
func (updater *RateUpdater) StartCurrentRates() {
	if updater.stopLastUpdateLoop != nil {
		panic("RateUpdater: StartCurrentRates called twice")
	}
	ctx, cancel := context.WithCancel(context.Background())
	updater.stopLastUpdateLoop = cancel
	go updater.lastUpdateLoop(ctx)
}

// Stop shuts down all running goroutines and closes history database cache.
// It may return before the goroutines have exited.
// Once Stop'ed, the updater is no longer usable.
//
// Stop is unsafe for concurrent use.
func (updater *RateUpdater) Stop() {
	updater.stopAllHistory()
	if updater.stopLastUpdateLoop != nil {
		updater.stopLastUpdateLoop()
	}
	if err := updater.historyDB.Close(); err != nil {
		updater.log.Errorf("historyDB.Close: %v", err)
	}
}

// lastUpdateLoop periodically updates most recent exchange rates.
// It never returns until the context is done.
func (updater *RateUpdater) lastUpdateLoop(ctx context.Context) {
	for {
		updater.updateLast(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
			// continue
		}
	}
}

func (updater *RateUpdater) updateLast(ctx context.Context) {
	url := fmt.Sprintf(cryptoCompareURL,
		strings.Join(coins, ","),
		strings.Join(fiats, ","),
	)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		updater.log.Errorf("updateLast: http.NewRequest: %v", err)
		return
	}
	response, err := updater.httpClient.Do(req.WithContext(ctx))
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
