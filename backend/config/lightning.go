// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

package config

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
)

// LightningAccountConfig is the configuration of a single Lightning account.
type LightningAccountConfig struct {
	// Mnemonic is the wallet node generated from the device entropy.
	Mnemonic string `json:"mnemonic"`
	// RootFingerprint is fingerprint of the keystore that generated the entropy.
	RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
	// Code is the code of the lightning account.
	Code types.Code `json:"code"`
	// Number is the lightning account incremental number.
	Number uint16 `json:"num"`
}

// LightningConfig holds information related to the lightning config.
type LightningConfig struct {
	// Accounts is an array of existing lightning accounts configurations.
	Accounts []*LightningAccountConfig `json:"accounts"`
}

// newDefaultAccountsConfig returns the default accounts config.
func newDefaultLightningConfig() LightningConfig {
	return LightningConfig{
		Accounts: []*LightningAccountConfig{},
	}
}
