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

// Lightning holds information related to the lightning config.
type LightningConfig struct {
	// Inactive is true if lightning has not yet been setup.
	Inactive bool `json:"inactive"`
	// Mnemonic is the wallet node generated from the device entropy.
	Mnemonic string `json:"mnemonic"`
}

// newDefaultAccountsConfig returns the default accounts config.
func newDefaultLightningConfig() LightningConfig {
	return LightningConfig{
		Inactive: true,
	}
}
