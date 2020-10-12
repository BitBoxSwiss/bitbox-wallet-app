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
	"reflect"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/sirupsen/logrus"
)

var coins = []string{"BTC", "LTC", "ETH", "USDT", "LINK", "MKR", "ZRX", "SAI", "DAI", "BAT", "USDC"}
var fiats = []string{"USD", "EUR", "CHF", "GBP", "JPY", "KRW", "CNY", "RUB", "CAD", "AUD", "ILS"}

const interval = time.Minute
const cryptoCompareURL = "https://min-api.cryptocompare.com/data/pricemulti?fsyms=%s&tsyms=%s"

// RateUpdater implements coin.RateUpdater.
type RateUpdater struct {
	observable.Implementation
	last       map[string]map[string]float64
	log        *logrus.Entry
	socksProxy socksproxy.SocksProxy
}

// NewRateUpdater returns a new rates updater.
func NewRateUpdater(socksProxy socksproxy.SocksProxy) *RateUpdater {
	ratesUpdater := &RateUpdater{
		last:       map[string]map[string]float64{},
		log:        logging.Get().WithGroup("rates"),
		socksProxy: socksProxy,
	}
	go ratesUpdater.start()
	return ratesUpdater
}

// Last returns the last rates for a given coin and fiat or nil if not available.
func (updater *RateUpdater) Last() map[string]map[string]float64 {
	return updater.last
}

func (updater *RateUpdater) update() {
	client, err := updater.socksProxy.GetHTTPClient()
	if err != nil {
		updater.log.Printf("Error getting http client %v\n", err)
		updater.last = nil
		return
	}

	url := fmt.Sprintf(cryptoCompareURL,
		strings.Join(coins, ","),
		strings.Join(fiats, ","),
	)
	response, err := client.Get(url)
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

func (updater *RateUpdater) start() {
	for {
		updater.update()
		time.Sleep(interval)
	}
}
