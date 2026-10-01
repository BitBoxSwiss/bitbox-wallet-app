// SPDX-License-Identifier: Apache-2.0

package mobileserver

import (
	"encoding/json"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/pricewidget"
)

var widgetService = pricewidget.New()

// PriceWidgetState returns widget display data without starting the wallet server.
// Call on a background thread; network requests can take up to ten seconds.
func PriceWidgetState(dataDir string, selectedIndex int, fetch, force bool) (string, error) {
	initialize(dataDir)
	state, err := widgetService.Load(dataDir, selectedIndex, fetch, force)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(state)
	return string(data), err
}
