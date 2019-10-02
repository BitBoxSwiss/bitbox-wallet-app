// Copyright 2018 Shift Devices AG
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
	"reflect"
	"strings"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/sirupsen/logrus"
)

var coins = []string{"BTC", "LTC", "ETH", "USDT", "LINK", "MKR", "ZRX", "DAI", "BAT"}
var fiats = []string{"USD", "EUR", "CHF", "GBP", "JPY", "KRW", "CNY", "RUB", "CAD"}

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

	response, err := client.Get(fmt.Sprintf(cryptoCompareURL,
		strings.Join(coins, ","),
		strings.Join(fiats, ","),
	))
	if err != nil {
		updater.log.Printf("Error getting rates: %v\n", err)
		updater.last = nil
		return
	}
	defer func() {
		_ = response.Body.Close()
	}()

	var rates map[string]map[string]float64
	err = json.NewDecoder(response.Body).Decode(&rates)
	if err != nil {
		updater.last = nil
		return
	}

	if reflect.DeepEqual(rates, updater.last) {
		return
	}

	updater.last = rates
	updater.log.WithField("data", spew.Sprintf("%v", rates)).Debug("Exchange rates changed.")
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
