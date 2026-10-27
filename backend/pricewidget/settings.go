// SPDX-License-Identifier: Apache-2.0

package pricewidget

import (
	"os"
	"path/filepath"
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
)

type settings struct {
	Backend struct {
		MainFiat string `json:"mainFiat"`
		Proxy    struct {
			UseProxy     bool   `json:"useProxy"`
			ProxyAddress string `json:"proxyAddress"`
		} `json:"proxy"`
	} `json:"backend"`
}

// Keep only widget display preferences, not wallet accounts or proxy credentials.
type widgetSettings struct {
	Currency string   `json:"currency"`
	Coins    []string `json:"coins"`
	dirty    bool
}

func settingsFile(dataDir string) *config.File {
	return config.NewFile(filepath.Join(config.CacheDir(dataDir), "price-widget"), "settings.json")
}

// Each source replaces its synchronized values only after a successful read.
// Disk persistence keeps the display preferences available across worker process restarts.
func (service *Service) syncSettings(dataDir string) (settings, widgetSettings, bool) {
	service.settingsMu.Lock()
	defer service.settingsMu.Unlock()

	file := settingsFile(dataDir)
	previous, ok := service.settings[file.Path()]
	if !ok {
		var saved widgetSettings
		if err := file.ReadJSON(&saved); err == nil {
			previous = saved
		}
	}
	synced := previous
	log := logging.Get().WithGroup("pricewidget")
	var preferences settings
	err := config.NewFile(dataDir, "config.json").ReadJSON(&preferences)
	// An absent config on a fresh install uses defaults. Once synchronized, a missing
	// or unreadable config must not bypass a proxy the user may have configured.
	canFetch := err == nil || (os.IsNotExist(err) && previous.Currency == "")
	if err == nil {
		synced.Currency = rates.WidgetCurrency(preferences.Backend.MainFiat)
	} else if !os.IsNotExist(err) {
		log.WithError(err).Warn("Could not synchronize widget currency")
	}
	if coins, err := activeCoins(dataDir); err == nil {
		synced.Coins = coins
	} else if !os.IsNotExist(err) {
		log.WithError(err).Warn("Could not synchronize widget accounts")
	}
	synced.dirty = previous.dirty || synced.Currency != previous.Currency || !slices.Equal(synced.Coins, previous.Coins)
	if synced.dirty {
		if err := file.WriteJSON(synced); err != nil {
			log.WithError(err).Warn("Could not persist widget settings")
		} else {
			synced.dirty = false
		}
	}
	service.settings[file.Path()] = synced
	return preferences, synced, canFetch
}
