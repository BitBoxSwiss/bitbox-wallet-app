package coin

import (
	"github.com/shiftdevices/godbb/util/observable"
)

// Rates store the exchange rate into various fiat currencies.
type Rates struct {
	USD float64 `json:"usd"`
	EUR float64 `json:"eur"`
	CHF float64 `json:"chf"`
	GBP float64 `json:"gbp"`
}

// RatesUpdater updates the exchange rates continuously.
type RatesUpdater interface {
	observable.Interface
	Last() Rates
}
