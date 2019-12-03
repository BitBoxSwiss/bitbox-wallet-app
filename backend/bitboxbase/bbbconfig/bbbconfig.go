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

package bbbconfig

import (
	"bytes"
	"sync"

	fileconfig "github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/flynn/noise"
)

const configFilename = "bitboxbase.json"

// BBBConfigurationInterface provides an interface to interact with the persisted BBBConfig
type BBBConfigurationInterface interface {
	// ContainsBaseStaticPubkey returns true if a device pubkey has been added before.
	ContainsBaseStaticPubkey(pubkey []byte) bool
	// AddBaseStaticPubkey adds a device pubkey.
	AddBaseStaticPubkey(pubkey []byte) error
	// BBBConfigGetAppNoiseStaticKeypair retrieves the app keypair. Returns nil if none has been set before.
	GetAppNoiseStaticKeypair() *noise.DHKey
	// BBBConfigSetAppNoiseStaticKeypair stores the app keypair. Overwrites keypair if one already exists.
	SetAppNoiseStaticKeypair(key *noise.DHKey) error
}

// BBBConfig perists the BitBoxBase related configuration in a file.
type BBBConfig struct {
	mu        sync.RWMutex
	configDir string
}

//TODO(TheCharlatan) refactor this into a shared interface with the bitbox02 implmentation, for example in util/noiseconfig
type noiseKeypair struct {
	Private []byte `json:"private"`
	Public  []byte `json:"public"`
}

// ConfigData holds the persisted app configuration related to BitBoxBases.
type ConfigData struct {
	AppNoiseStaticKeypair        *noiseKeypair `json:"appNoiseStaticKeypair"`
	BitBoxBaseNoiseStaticPubkeys [][]byte      `json:"bitboxBaseNoiseStaticPubkeys"`
}

// NewBBBConfig creates a new BBBConfig instance. The config will be stored in the given location.
func NewBBBConfig(configDir string) *BBBConfig {
	return &BBBConfig{configDir: configDir}
}

func (bbbconfig *BBBConfig) readConfig() *ConfigData {
	configFile := fileconfig.NewFile(bbbconfig.configDir, configFilename)
	if !configFile.Exists() {
		return &ConfigData{}
	}
	var conf ConfigData
	if err := configFile.ReadJSON(&conf); err != nil {
		return &ConfigData{}
	}
	return &conf
}

func (bbbconfig *BBBConfig) storeConfig(conf *ConfigData) error {
	configFile := fileconfig.NewFile(bbbconfig.configDir, configFilename)
	return configFile.WriteJSON(conf)
}

// ContainsBaseStaticPubkey implements BBBConfigurationInterface
func (bbbconfig *BBBConfig) ContainsBaseStaticPubkey(pubkey []byte) bool {
	bbbconfig.mu.RLock()
	defer bbbconfig.mu.RUnlock()

	for _, configPubkey := range bbbconfig.readConfig().BitBoxBaseNoiseStaticPubkeys {
		if bytes.Equal(configPubkey, pubkey) {
			return true
		}
	}
	return false
}

// AddBaseStaticPubkey implements BBBConfigurationInterface
func (bbbconfig *BBBConfig) AddBaseStaticPubkey(pubkey []byte) error {
	if bbbconfig.ContainsBaseStaticPubkey(pubkey) {
		// Don't add again if already present.
		return nil
	}

	bbbconfig.mu.Lock()
	defer bbbconfig.mu.Unlock()

	configData := bbbconfig.readConfig()
	configData.BitBoxBaseNoiseStaticPubkeys = append(configData.BitBoxBaseNoiseStaticPubkeys, pubkey)
	return bbbconfig.storeConfig(configData)
}

// GetAppNoiseStaticKeypair implements BBBConfigurationInterface
func (bbbconfig *BBBConfig) GetAppNoiseStaticKeypair() *noise.DHKey {
	bbbconfig.mu.RLock()
	defer bbbconfig.mu.RUnlock()

	key := bbbconfig.readConfig().AppNoiseStaticKeypair
	if key == nil {
		return nil
	}
	return &noise.DHKey{
		Private: key.Private,
		Public:  key.Public,
	}
}

// SetAppNoiseStaticKeypair implements BBBConfigurationInterface
func (bbbconfig *BBBConfig) SetAppNoiseStaticKeypair(key *noise.DHKey) error {
	bbbconfig.mu.Lock()
	defer bbbconfig.mu.Unlock()

	configData := bbbconfig.readConfig()
	configData.AppNoiseStaticKeypair = &noiseKeypair{
		Private: key.Private,
		Public:  key.Public,
	}
	return bbbconfig.storeConfig(configData)
}
