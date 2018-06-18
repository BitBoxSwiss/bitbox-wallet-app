package btc

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/sirupsen/logrus"

	coinpkg "github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/observable"
	"github.com/shiftdevices/godbb/util/observable/action"
)

var coins = []string{"BTC", "LTC"}
var currencies = []string{"USD", "EUR", "CHF", "GBP"}

const interval = time.Minute
const url = "https://min-api.cryptocompare.com/data/pricemulti?fsyms=%s&tsyms=%s"

// RatesUpdater implements coin.RatesUpdater.
type RatesUpdater struct {
	observable.Implementation
	last map[string]coinpkg.Rates
	log  *logrus.Entry
}

// NewRatesUpdater returns a new rates updater.
func NewRatesUpdater() *RatesUpdater {
	updater := &RatesUpdater{
		last: map[string]coinpkg.Rates{},
		log:  logging.Get().WithGroup("rates"),
	}
	go updater.start()
	return updater
}

// All returns the last rates for all coins.
func (updater *RatesUpdater) All() map[string]coinpkg.Rates {
	return updater.last
}

// Last returns the last rates for the given coin.
func (updater *RatesUpdater) Last(coin string) coinpkg.Rates {
	if len(coin) == 4 && strings.HasPrefix(coin, "T") {
		coin = coin[1:]
	}
	return updater.last[coin]
}

func (updater *RatesUpdater) update() {
	response, err := http.Get(fmt.Sprintf(url,
		strings.Join(coins, ","),
		strings.Join(currencies, ","),
	))
	if err != nil {
		return
	}
	defer response.Body.Close()

	var data map[string]map[string]float64
	err = json.NewDecoder(response.Body).Decode(&data)
	if err != nil {
		return
	}

	changed := false

	for _, coin := range coins {
		rates, found := data[coin]
		if !found {
			updater.last[coin] = coinpkg.Rates{}
			continue
		}
		newRates := coinpkg.Rates{
			USD: rates["USD"],
			CHF: rates["CHF"],
			EUR: rates["EUR"],
			GBP: rates["GBP"],
		}
		if newRates != updater.last[coin] {
			updater.last[coin] = newRates
			changed = true
		}
	}

	if changed {
		updater.log.WithField("data", spew.Sprintf("%v", data)).Debug("Exchange rates changed.")
		updater.Notify(observable.Event{
			Subject: "coins/rates",
			Action:  action.Replace,
			Object:  updater.last,
		})
	}
}

func (updater *RatesUpdater) start() {
	for {
		updater.update()
		time.Sleep(interval)
	}
}
