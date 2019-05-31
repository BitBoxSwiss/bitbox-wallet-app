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

// Package bitbox02 contains the API to the physical device.
package bitbox02

import (
	"bytes"

	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/flynn/noise"
)

const configFilename = "bitbox02.json"

type noiseKeypair struct {
	Private []byte `json:"private"`
	Public  []byte `json:"public"`
}

type configuration struct {
	AppNoiseStaticKeypair    *noiseKeypair `json:"appNoiseStaticKeypair"`
	DeviceNoiseStaticPubkeys [][]byte      `json:"deviceNoiseStaticPubkeys"`
}

func (device *Device) readConfig() *configuration {
	configFile := config.NewFile(device.configDir, configFilename)
	if !configFile.Exists() {
		return &configuration{}
	}
	var conf configuration
	if err := configFile.ReadJSON(&conf); err != nil {
		return &configuration{}
	}
	return &conf
}

func (device *Device) storeConfig(conf *configuration) error {
	configFile := config.NewFile(device.configDir, configFilename)
	return configFile.WriteJSON(conf)
}

func (device *Device) configContainsDeviceStaticPubkey(pubkey []byte) bool {
	device.mu.RLock()
	defer device.mu.RUnlock()

	for _, configPubkey := range device.readConfig().DeviceNoiseStaticPubkeys {
		if bytes.Equal(configPubkey, pubkey) {
			return true
		}
	}
	return false
}

func (device *Device) configAddDeviceStaticPubkey(pubkey []byte) error {
	if device.configContainsDeviceStaticPubkey(pubkey) {
		// Don't add again if already present.
		return nil
	}

	device.mu.Lock()
	defer device.mu.Unlock()

	config := device.readConfig()
	config.DeviceNoiseStaticPubkeys = append(config.DeviceNoiseStaticPubkeys, pubkey)
	return device.storeConfig(config)
}

func (device *Device) configGetAppNoiseStaticKeypair() *noise.DHKey {
	device.mu.RLock()
	defer device.mu.RUnlock()

	key := device.readConfig().AppNoiseStaticKeypair
	if key == nil {
		return nil
	}
	return &noise.DHKey{
		Private: key.Private,
		Public:  key.Public,
	}
}

func (device *Device) configSetAppNoiseStaticKeypair(key *noise.DHKey) error {
	device.mu.Lock()
	defer device.mu.Unlock()

	config := device.readConfig()
	config.AppNoiseStaticKeypair = &noiseKeypair{
		Private: key.Private,
		Public:  key.Public,
	}
	return device.storeConfig(config)
}
