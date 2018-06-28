package btc

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/observable"
	"github.com/shiftdevices/godbb/util/observable/action"
)

var coins = []string{"BTC", "LTC"}
var fiats = []string{"USD", "EUR", "CHF", "GBP", "JPY", "KRW", "CNY", "RUB"}

const interval = time.Minute
const url = "https://min-api.cryptocompare.com/data/pricemulti?fsyms=%s&tsyms=%s"

// RatesUpdater implements coin.RatesUpdater.
type RatesUpdater struct {
	observable.Implementation
	last map[string]map[string]float64
	log  *logrus.Entry
}

// NewRatesUpdater returns a new rates updater.
func NewRatesUpdater() *RatesUpdater {
	updater := &RatesUpdater{
		last: map[string]map[string]float64{},
		log:  logging.Get().WithGroup("rates"),
	}
	go updater.start()
	return updater
}

// Last returns the last rates for a given coin and fiat or nil if not available.
func (updater *RatesUpdater) Last() map[string]map[string]float64 {
	return updater.last
}

func (updater *RatesUpdater) update() {
	response, err := http.Get(fmt.Sprintf(url,
		strings.Join(coins, ","),
		strings.Join(fiats, ","),
	))
	if err != nil {
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
		Subject: "coins/rates",
		Action:  action.Replace,
		Object:  rates,
	})
}

func (updater *RatesUpdater) start() {
	for {
		updater.update()
		time.Sleep(interval)
	}
}
