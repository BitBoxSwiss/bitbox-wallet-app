// SPDX-License-Identifier: Apache-2.0

package config

import (
	"encoding/json"
	"maps"
)

// WhatsNew tracks the highest observed app version.
type WhatsNew struct {
	Version string `json:"version"`
}

// SetWhatsNew persists the version and an optional frontend dismissal key atomically.
func (config *Config) SetWhatsNew(state WhatsNew, dismissibleKey string) error {
	defer config.appConfigLock.Lock()()
	appConfig := config.appConfig
	appConfig.Backend.WhatsNew = &state
	if dismissibleKey != "" {
		frontend, _ := appConfig.Frontend.(map[string]interface{})
		frontend = maps.Clone(frontend)
		if frontend == nil {
			frontend = make(map[string]interface{})
		}
		frontend[dismissibleKey] = true
		appConfig.Frontend = frontend
	}
	if err := config.save(config.appConfigFilename, appConfig); err != nil {
		return err
	}
	config.appConfig = appConfig
	return nil
}

// migrateWhatsNew preserves dismissals stored in the legacy pending field.
func migrateWhatsNew(appConfig *AppConfig, data []byte) {
	var legacy struct {
		Backend struct {
			WhatsNew struct {
				Pending *bool `json:"pending"`
			} `json:"whatsNew"`
		} `json:"backend"`
	}
	if json.Unmarshal(data, &legacy) != nil || legacy.Backend.WhatsNew.Pending == nil ||
		*legacy.Backend.WhatsNew.Pending || appConfig.Backend.WhatsNew == nil {
		return
	}
	frontend, _ := appConfig.Frontend.(map[string]interface{})
	if frontend == nil {
		frontend = make(map[string]interface{})
	}
	frontend["whats-new-"+appConfig.Backend.WhatsNew.Version] = true
	appConfig.Frontend = frontend
}
