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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

// Account holds information related to an account.
type Account struct {
	CoinCode coin.Code `json:"coinCode"`
	Name     string    `json:"name"`
	Code     string    `json:"code"`
	// SupportsUnifiedAccounts, if true, allows multiple configurations in one account. If false,
	// one account will be added per configuration.
	//
	// This is used to unify multiple Bitcoin script types (p2wsh, p2wsh-p2sh) in one account. The
	// keystore must be able to sign transactions with mixed inputs.
	SupportsUnifiedAccounts bool                   `json:"supportsUnifiedaccounts"`
	Configurations          signing.Configurations `json:"configurations"`
}

// AccountsConfig persists the list of accounts added to the app.
type AccountsConfig struct {
	Accounts []Account `json:"accounts"`
}

// newDefaultAccountsonfig returns the default accounts config.
func newDefaultAccountsonfig() AccountsConfig {
	return AccountsConfig{
		Accounts: []Account{},
	}
}
