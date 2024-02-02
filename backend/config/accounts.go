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
	"bytes"
	"time"

	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
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
	HiddenBecauseUnused bool `json:"hiddenBecauseUnused"`
	// Watch indicates if the account should be loaded even if its keystore is not connected.
	//
	// If false, the account is only displayed if the keystore is connected. If true, it is loaded
	// and displayed when the app launches.
	//
	// If nil, it is considered false.  The reason for this is that we don't want to suddenly show
	// all persisted accounts when the Watchonly setting is enabled - only accounts that are loaded
	// when Watchonly is enabled should do this.
	Watch                 *bool                  `json:"watch"`
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

// Keystore holds information related to keystores such as the BitBox02.
type Keystore struct {
	// Watchonly determines if accounts of this keystore should be loaded even if the keystore is not connected.
	// If false, accounts are only loaded if this keystore is connected.
	// If true, they are loaded and displayed when the app launches.
	// Individual accounts can be exempt from being loaded even if this flag is true by setting the account's
	// `Watch` flag to false.
	Watchonly bool `json:"watchonly"`
	// The root fingerprint is the first 32 bits of the hash160 of the pubkey at the keypath m/.
	// https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#key-identifiers It serves as
	// an identifier for the keystore. Collisions are possible but the chance is very small.
	RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
	// Name is the name of the keystore, e.g. the BitBox02 device name.
	Name string `json:"name"`
	// LastConnected is the date/time when the keystore was last connected/registered. We don't use
	// this field yet but it may be helpful in the future if we want to remind users to connect
	// their device, e.g. to check that they still know their device password.
	LastConnected time.Time `json:"lastConnected"`
}

// AccountsConfig persists the list of accounts added to the app.
type AccountsConfig struct {
	Accounts  []*Account  `json:"accounts"`
	Keystores []*Keystore `json:"keystores"`
}

// newDefaultAccountsConfig returns the default accounts config.
func newDefaultAccountsConfig() AccountsConfig {
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

// LookupKeystore looks up a keystore by fingerprint. Returns error if it could not be found.
func (cfg AccountsConfig) LookupKeystore(rootFingerprint []byte) (*Keystore, error) {
	for _, ks := range cfg.Keystores {
		if bytes.Equal(ks.RootFingerprint, rootFingerprint) {
			return ks, nil
		}
	}
	return nil, errp.Newf("could not retrieve keystore for fingerprint %x", rootFingerprint)
}

// IsKeystoreWatchonly returns true if the keystore's watchonly setting is true.
// If no such keystore exists, false is returned.
func (cfg AccountsConfig) IsKeystoreWatchonly(rootFingerprint []byte) bool {
	ks, err := cfg.LookupKeystore(rootFingerprint)
	if err != nil {
		return false
	}
	return ks.Watchonly
}

// IsAccountWatchonly returns true if the `Watch` setting of the account is set to true and its
// keystores watchonly setting is true.
func (cfg AccountsConfig) IsAccountWatchonly(account *Account) (bool, error) {
	rootFingerprint, err := account.SigningConfigurations.RootFingerprint()
	if err != nil {
		return false, err
	}
	return cfg.IsKeystoreWatchonly(rootFingerprint) && account.Watch != nil && *account.Watch, nil
}

// GetOrAddKeystore looks up the keystore by root fingerprint. If it does not exist, one is added to
// the list of keystores and the newly created one is returned.
func (cfg *AccountsConfig) GetOrAddKeystore(rootFingerprint []byte) *Keystore {
	ks, err := cfg.LookupKeystore(rootFingerprint)
	if err == nil {
		return ks
	}

	ks = &Keystore{RootFingerprint: rootFingerprint}
	cfg.Keystores = append(cfg.Keystores, ks)
	return ks
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
