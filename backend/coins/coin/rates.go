package coin

import (
	"github.com/shiftdevices/godbb/util/observable"
)

// RatesUpdater updates the exchange rates continuously.
type RatesUpdater interface {
	observable.Interface
	Last() map[string]map[string]float64
}
