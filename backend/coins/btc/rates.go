package btc

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/shiftdevices/godbb/util/observable/action"

	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/observable"
	"github.com/sirupsen/logrus"
)

// RatesUpdater implements coin.RatesUpdater.
type RatesUpdater struct {
	observable.Implementation
	last coin.Rates
	log  *logrus.Entry
}

// NewRatesUpdater returns a new rates updater.
func NewRatesUpdater() *RatesUpdater {
	updater := &RatesUpdater{log: logging.Get().WithGroup("coin").WithField("name", "btc")}
	go updater.start()
	return updater
}

func (updater *RatesUpdater) Last() coin.Rates {
	return updater.last
}

func (updater *RatesUpdater) update() {
	response, err := http.Get("https://blockchain.info/ticker")
	if err != nil {
		return
	}
	defer response.Body.Close()

	var data interface{}
	err = json.NewDecoder(response.Body).Decode(&data)
	if err != nil {
		return
	}

	currencies, ok := data.(map[string]interface{})
	if !ok {
		return
	}

	extractor := func(acronym string) float64 {
		currency, found := currencies[acronym]
		if !found {
			return 0
		}
		values, ok := currency.(map[string]interface{})
		if !ok {
			return 0
		}
		value, found := values["last"]
		if !found {
			return 0
		}
		number, ok := value.(float64)
		if !ok {
			return 0
		}
		return number
	}

	rates := coin.Rates{
		USD: extractor("USD"),
		CHF: extractor("CHF"),
		EUR: extractor("EUR"),
		GBP: extractor("GBP"),
	}

	if rates == updater.last {
		return
	}

	updater.last = rates

	updater.log.WithField("rates", rates).Debug("Exchange rates for BTC changed.")

	updater.Notify(observable.Event{
		Subject: "coins/btc/rates",
		Action:  action.Replace,
		Object:  rates,
	})
}

func (updater *RatesUpdater) start() {
	for {
		updater.update()
		time.Sleep(time.Minute)
	}
}
