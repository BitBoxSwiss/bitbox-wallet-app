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
	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// Account holds information related to an account.
type Account struct {
	// Used is true if the account has a transaction history.
	Used bool `json:"used"`
	// Inactive is true if the account should not be loaded in the sidebar and portfolio. It will
	// still be shown in 'Manage accounts'.
	Inactive bool `json:"inactive"`
	// InsuranceStatus is the last retrieved insurance status for accounts insured through the
	// service offered by Bitsurance.
	InsuranceStatus string `json:"insuranceStatus"`
	// HiddenBecauseUnused is true if the account should not loaded in the sidebar and portfolio,
	// and not be shown in 'Manage accounts', because the account is unused (has no transaction
	// history). This is used to facilitate automatic discovery of used accounts.
	HiddenBecauseUnused   bool                   `json:"hiddenBecauseUnused"`
	CoinCode              coin.Code              `json:"coinCode"`
	Name                  string                 `json:"name"`
	Code                  accountsTypes.Code     `json:"code"`
	SigningConfigurations signing.Configurations `json:"configurations"`
	// ActiveTokens list the tokens that should be loaded along with the account.  Currently, this
	// only applies to ETH, and the elements are ERC20 token codes (e.g. "eth-erc20-usdt",
	// "eth-erc20-bat", etc).
	ActiveTokens []string `json:"activeTokens,omitempty"`
}

// SetTokenActive activates/deactivates an token on an account. `tokenCode` must be an ERC20 token
// code, e.g. "eth-erc20-usdt", "eth-erc20-bat", etc.
func (acct *Account) SetTokenActive(tokenCode string, active bool) error {
	if acct.CoinCode != coin.CodeETH {
		return errp.New("tokens are only enabled for ETH")
	}
	var activeTokens []string
	for _, activeToken := range acct.ActiveTokens {
		if activeToken != tokenCode {
			activeTokens = append(activeTokens, activeToken)
		}
	}
	if active {
		activeTokens = append(activeTokens, tokenCode)
	}
	acct.ActiveTokens = activeTokens
	return nil
}

// AccountsConfig persists the list of accounts added to the app.
type AccountsConfig struct {
	Accounts []*Account `json:"accounts"`
}

// newDefaultAccountsonfig returns the default accounts config.
func newDefaultAccountsonfig() AccountsConfig {
	return AccountsConfig{
		Accounts: []*Account{},
	}
}

// Lookup returns the account with the given code, or nil if no such account exists.
// A reference is returned, so the account can be modified by the caller.
func (cfg AccountsConfig) Lookup(code accountsTypes.Code) *Account {
	for _, acct := range cfg.Accounts {
		if acct.Code == code {
			return acct
		}
	}
	return nil
}

// migrateActiveTokens removes tokens from AccountsConfig.
func migrateActiveTokens(accountsConf *AccountsConfig) error {
	for _, account := range accountsConf.Accounts {
		if account.CoinCode != coin.CodeETH {
			continue
		}

		err := account.SetTokenActive("eth-erc20-sai0x89d", false)
		if err != nil {
			return err
		}

	}
	return nil
}
