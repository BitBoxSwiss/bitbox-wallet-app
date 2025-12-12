// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"time"
)

// MockRateUpdater returns a rate updater mock. Remember to defer calling the Stop() method when using it.
func MockRateUpdater() *RateUpdater {
	updater := NewRateUpdater(nil, "/dev/null")
	updater.history = map[string][]exchangeRate{
		"btcUSD": {
			{value: 1, timestamp: time.Unix(1598832062, 0)}, // 2020-08-31 00:01:02
			{value: 2, timestamp: time.Unix(1598918700, 0)},
			{value: 3, timestamp: time.Unix(1598922501, 0)},
			{value: 4, timestamp: time.Unix(1599091262, 0)}, // 2020-09-03 00:01:02
		},
		"ltcUSD": {
			{value: 4, timestamp: time.Date(2020, 8, 02, 23, 0, 0, 0, time.UTC)},
			{value: 4, timestamp: time.Date(2020, 9, 02, 23, 0, 0, 0, time.UTC)},
		},
	}
	updater.last = map[string]map[string]float64{
		"BTC": {
			"USD": 21.0,
			"EUR": 18.0,
			"CHF": 19.0,
		},
		"ETH": {
			"USD": 1.0,
			"EUR": 0.9,
			"CHF": 0.95,
		},
	}
	return updater
}
