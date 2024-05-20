// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bitbox02

import (
	"bytes"
	"sync"

	fileconfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/flynn/noise"
)

const configFilename = "bitbox02.json"

// NoiseKeypair holds a noise keypair.
type NoiseKeypair struct {
	Private []byte `json:"private"`
	Public  []byte `json:"public"`
}

// ConfigData holds the persisted app configuration related to bitbox02 devices.
type ConfigData struct {
	AppNoiseStaticKeypair    *NoiseKeypair `json:"appNoiseStaticKeypair"`
	DeviceNoiseStaticPubkeys [][]byte      `json:"deviceNoiseStaticPubkeys"`
}

// Config perists the bitbox02 related configuration in a file.
type Config struct {
	mu        sync.RWMutex
	configDir string
}

// NewConfig creates a new Config instance. The config will be stored in the given location.
func NewConfig(configDir string) *Config {
	return &Config{configDir: configDir}
}

func (config *Config) readConfig() *ConfigData {
	configFile := fileconfig.NewFile(config.configDir, configFilename)
	if !configFile.Exists() {
		return &ConfigData{}
	}
	var conf ConfigData
	if err := configFile.ReadJSON(&conf); err != nil {
		return &ConfigData{}
	}
	return &conf
}

func (config *Config) storeConfig(conf *ConfigData) error {
	configFile := fileconfig.NewFile(config.configDir, configFilename)
	return configFile.WriteJSON(conf)
}

// ContainsDeviceStaticPubkey implements ConfigurationInterface.
func (config *Config) ContainsDeviceStaticPubkey(pubkey []byte) bool {
	config.mu.RLock()
	defer config.mu.RUnlock()

	for _, configPubkey := range config.readConfig().DeviceNoiseStaticPubkeys {
		if bytes.Equal(configPubkey, pubkey) {
			return true
		}
	}
	return false
}

// AddDeviceStaticPubkey implements ConfigurationInterface.
func (config *Config) AddDeviceStaticPubkey(pubkey []byte) error {
	if config.ContainsDeviceStaticPubkey(pubkey) {
		// Don't add again if already present.
		return nil
	}

	config.mu.Lock()
	defer config.mu.Unlock()

	configData := config.readConfig()
	configData.DeviceNoiseStaticPubkeys = append(configData.DeviceNoiseStaticPubkeys, pubkey)
	return config.storeConfig(configData)
}

// GetAppNoiseStaticKeypair implements ConfigurationInterface.
func (config *Config) GetAppNoiseStaticKeypair() *noise.DHKey {
	config.mu.RLock()
	defer config.mu.RUnlock()

	key := config.readConfig().AppNoiseStaticKeypair
	if key == nil {
		return nil
	}
	return &noise.DHKey{
		Private: key.Private,
		Public:  key.Public,
	}
}

// SetAppNoiseStaticKeypair implements ConfigurationInterface.
func (config *Config) SetAppNoiseStaticKeypair(key *noise.DHKey) error {
	config.mu.Lock()
	defer config.mu.Unlock()

	configData := config.readConfig()
	configData.AppNoiseStaticKeypair = &NoiseKeypair{
		Private: key.Private,
		Public:  key.Public,
	}
	return config.storeConfig(configData)
}
