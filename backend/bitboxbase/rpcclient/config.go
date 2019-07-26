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

// Package rpcclient contains the API to the physical device.
package rpcclient

import (
	"bytes"

	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/flynn/noise"
)

const configFilename = "bitboxbase.json"

//TODO(TheCharlatan) refactor this into a shared interface with the bitbox02 implmentation, for example in util/noiseconfig
type noiseKeypair struct {
	Private []byte `json:"private"`
	Public  []byte `json:"public"`
}

type configuration struct {
	AppNoiseStaticKeypair        *noiseKeypair `json:"appNoiseStaticKeypair"`
	BitBoxBaseNoiseStaticPubkeys [][]byte      `json:"bitboxBaseNoiseStaticPubkeys"`
}

func (rpcClient *RPCClient) readConfig() *configuration {
	configFile := config.NewFile(rpcClient.bitboxBaseConfigDir, configFilename)
	if !configFile.Exists() {
		return &configuration{}
	}
	var conf configuration
	if err := configFile.ReadJSON(&conf); err != nil {
		return &configuration{}
	}
	return &conf
}

func (rpcClient *RPCClient) storeConfig(conf *configuration) error {
	configFile := config.NewFile(rpcClient.bitboxBaseConfigDir, configFilename)
	return configFile.WriteJSON(conf)
}

func (rpcClient *RPCClient) configContainsBitBoxBaseStaticPubkey(pubkey []byte) bool {
	for _, configPubkey := range rpcClient.readConfig().BitBoxBaseNoiseStaticPubkeys {
		if bytes.Equal(configPubkey, pubkey) {
			return true
		}
	}
	return false
}

func (rpcClient *RPCClient) configAddBitBoxBaseStaticPubkey(pubkey []byte) error {
	if rpcClient.configContainsBitBoxBaseStaticPubkey(pubkey) {
		// Don't add again if already present.
		return nil
	}

	config := rpcClient.readConfig()
	config.BitBoxBaseNoiseStaticPubkeys = append(config.BitBoxBaseNoiseStaticPubkeys, pubkey)
	return rpcClient.storeConfig(config)
}

func (rpcClient *RPCClient) configGetAppNoiseStaticKeypair() *noise.DHKey {
	key := rpcClient.readConfig().AppNoiseStaticKeypair
	if key == nil {
		return nil
	}
	return &noise.DHKey{
		Private: key.Private,
		Public:  key.Public,
	}
}

func (rpcClient *RPCClient) configSetAppNoiseStaticKeypair(key *noise.DHKey) error {
	config := rpcClient.readConfig()
	config.AppNoiseStaticKeypair = &noiseKeypair{
		Private: key.Private,
		Public:  key.Public,
	}
	return rpcClient.storeConfig(config)
}
