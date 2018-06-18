package coin

import (
	"github.com/shiftdevices/godbb/util/observable"
)

// Rates store the exchange rate into various fiat currencies.
type Rates struct {
	USD float64 `json:"USD"`
	EUR float64 `json:"EUR"`
	CHF float64 `json:"CHF"`
	GBP float64 `json:"GBP"`
}

// RatesUpdater updates the exchange rates continuously.
type RatesUpdater interface {
	observable.Interface
	Last(coin string) Rates
}
