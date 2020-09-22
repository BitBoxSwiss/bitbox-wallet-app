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
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
)

var coins = []string{"BTC", "LTC", "ETH", "USDT", "LINK", "MKR", "ZRX", "DAI", "BAT", "USDC"}
var fiats = []string{"USD", "EUR", "CHF", "GBP", "JPY", "KRW", "CNY", "RUB", "CAD", "AUD"}

const interval = time.Minute
const cryptoCompareURL = "https://min-api.cryptocompare.com/data/pricemulti?fsyms=%s&tsyms=%s"

// RateUpdater provides cryptocurrency-to-fiat conversion rates.
type RateUpdater struct {
	observable.Implementation
	httpClient *http.Client
	// last contains most recent conversion to fiat, keyed by a coin.
	last map[string]map[string]float64
	log  *logrus.Entry
}

// NewRateUpdater returns a new rates updater.
func NewRateUpdater(client *http.Client) *RateUpdater {
	return &RateUpdater{
		last:       map[string]map[string]float64{},
		log:        logging.Get().WithGroup("rates"),
		httpClient: client,
	}
}

// Last returns the most recent conversion rates.
// The returned map is keyed by a crypto coin with values mapped by fiat rates.
// RateUpdater assumes the returned value is never modified by the callers.
func (updater *RateUpdater) Last() map[string]map[string]float64 {
	return updater.last
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

// Starts spins up the updater's goroutine to periodically fetch exchange rates.
// It returns immediately.
func (updater *RateUpdater) Start() {
	go func() {
		for {
			updater.updateLast()
			time.Sleep(interval)
		}
	}()
}
