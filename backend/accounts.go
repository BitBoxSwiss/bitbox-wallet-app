// Copyright 2021 Shift Crypto AG
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

package backend

import (
	"fmt"
	"sort"
	"strings"

	"github.com/btcsuite/btcutil/hdkeychain"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// hardenedKeystart is the BIP44 offset to make a keypath element hardened.
const hardenedKeystart uint32 = hdkeychain.HardenedKeyStart

// accountsHardlimit is the maximum possible number of accounts per coin and keystore.  This is
// useful in recovery, so we can scan a fixed number of accounts to discover all funds.  The
// alternative (or a complement) would be an accounts gap limit, similar to Bitcoin's address gap
// limit, but simply use a hard limit for simplicity.
const accountsHardLimit = 5

// ErrorCode are errors that are represented by an error code. This helps the frontend to translate
// error messages.
type ErrorCode string

func (e ErrorCode) Error() string {
	return string(e)
}

const (
	// ErrAccountAlreadyExists is returned if an account is being added which already exists.
	ErrAccountAlreadyExists ErrorCode = "alreadyExists"
	// ErrAccountLimitReached is returned when adding an account if no more accounts can be added.
	ErrAccountLimitReached ErrorCode = "limitReached"
)

// sortAccounts sorts the accounts in-place by 1) coin 2) account number.
func sortAccounts(accounts []*config.Account) {
	compareCoin := func(coin1, coin2 coinpkg.Code) int {
		order := map[coinpkg.Code]int{
			coinpkg.CodeBTC:  0,
			coinpkg.CodeTBTC: 1,
			coinpkg.CodeLTC:  2,
			coinpkg.CodeTLTC: 3,
			coinpkg.CodeETH:  4,
			coinpkg.CodeTETH: 5,
			coinpkg.CodeRETH: 6,
		}
		order1, ok1 := order[coin1]
		order2, ok2 := order[coin2]
		if !ok1 || !ok2 {
			// In case we deal with a coin we didn't specify, we fallback to ordering by coin code.
			return strings.Compare(string(coin1), string(coin2))
		}
		return order1 - order2
	}
	less := func(i, j int) bool {
		acct1 := accounts[i]
		acct2 := accounts[j]
		coinCmp := compareCoin(acct1.CoinCode, acct2.CoinCode)
		if coinCmp == 0 && len(acct1.Configurations) > 0 && len(acct2.Configurations) > 0 {
			signingCfg1 := acct1.Configurations[0]
			signingCfg2 := acct2.Configurations[0]
			// An error should never happen here, but if it does, we just sort as if it was account
			// number 0.
			accountNumber1, _ := signingCfg1.AccountNumber()
			accountNumber2, _ := signingCfg2.AccountNumber()
			return accountNumber1 < accountNumber2
		}
		return coinCmp < 0
	}
	sort.Slice(accounts, less)
}

// filterAccounts fetches all persisted accounts that pass the provided filter. Testnet/regtest
// accounts are not loaded in mainnet and vice versa.
func (backend *Backend) filterAccounts(accountsConfig *config.AccountsConfig, filter func(*config.Account) bool) []*config.Account {
	var accounts []*config.Account
	for idx := range accountsConfig.Accounts {
		account := &accountsConfig.Accounts[idx]
		if _, isTestnet := coinpkg.TestnetCoins[account.CoinCode]; isTestnet != backend.Testing() {
			// Don't load testnet accounts when running normally, nor mainnet accounts when running
			// in testing mode
			continue
		}
		if isRegtest := account.CoinCode == coinpkg.CodeRBTC; isRegtest != backend.arguments.Regtest() {
			// Don't load regtest accounts when running normally, nor mainnet accounts when running
			// in regtest mode.
			continue
		}
		_, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("filterAccounts: skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}

		if !filter(account) {
			continue
		}
		accounts = append(accounts, account)
	}
	sortAccounts(accounts)
	return accounts
}

// SupportedCoins returns the list of coins that can be used with the given keystore.
func (backend *Backend) SupportedCoins(keystore keystore.Keystore) []coinpkg.Code {
	allCoins := []coinpkg.Code{
		coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC,
		coinpkg.CodeLTC, coinpkg.CodeTLTC,
		coinpkg.CodeETH, coinpkg.CodeTETH,
	}
	var availableCoins []coinpkg.Code
	for _, coinCode := range allCoins {
		if _, isTestnet := coinpkg.TestnetCoins[coinCode]; isTestnet != backend.Testing() {
			// Don't load testnet accounts when running normally, nor mainnet accounts when running
			// in testing mode
			continue
		}
		if isRegtest := coinCode == coinpkg.CodeRBTC; isRegtest != backend.arguments.Regtest() {
			// Don't load regtest accounts when running normally, nor mainnet accounts when running
			// in regtest mode.
			continue
		}
		coin, err := backend.Coin(coinCode)
		if err != nil {
			backend.log.WithError(err).Errorf("AvailableCoins")
			continue
		}
		if !keystore.SupportsCoin(coin) {
			continue
		}
		availableCoins = append(availableCoins, coinCode)
	}
	return availableCoins
}

// createAndPersistAccountConfig adds an account for the given coin and account number. The account
// numbers start at 0 (first account). The added account will be a unified account supporting all
// types that the keystore supports. The keypaths will be standard BIP44 keypaths for the respective
// account types. `name` is the name of the new account and will be shown to the user.
// If empty, a default name will be used.
//
// The account code of the newly created account is returned.
func (backend *Backend) createAndPersistAccountConfig(
	coinCode coinpkg.Code,
	accountNumber uint16,
	name string,
	keystore keystore.Keystore,
	activeTokens []string,
	accountsConfig *config.AccountsConfig) (string, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", err
	}
	coin, err := backend.Coin(coinCode)
	if err != nil {
		return "", err
	}
	if name == "" {
		if accountNumber == 0 {
			name = coin.Name()
		} else {
			name = fmt.Sprintf("%s %d", coin.Name(), accountNumber+1)
		}
	}

	// v0 prefix: in case this code turns out to be not unique in the future, we can switch to 'v1-'
	// and avoid any collisions.
	accountCode := fmt.Sprintf("v0-%x-%s-%d", rootFingerprint, coinCode, accountNumber)

	log := backend.log.
		WithField("accountCode", accountCode).
		WithField("coinCode", coinCode).
		WithField("accountNumber", accountNumber)
	log.Info("Persisting new account config")
	accountNumberHardened := uint32(accountNumber) + hardenedKeystart

	switch coinCode {
	case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC:
		bip44Coin := 1 + hardenedKeystart
		if coinCode == coinpkg.CodeBTC {
			bip44Coin = hardenedKeystart
		}
		return accountCode, backend.persistBTCAccountConfig(keystore, coin,
			accountCode,
			name,
			[]scriptTypeWithKeypath{
				{signing.ScriptTypeP2WPKH, signing.NewAbsoluteKeypathFromUint32(84+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2WPKHP2SH, signing.NewAbsoluteKeypathFromUint32(49+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2PKH, signing.NewAbsoluteKeypathFromUint32(44+hardenedKeystart, bip44Coin, accountNumberHardened)},
			},
			accountsConfig,
		)
	case coinpkg.CodeLTC, coinpkg.CodeTLTC:
		bip44Coin := 1 + hardenedKeystart
		if coinCode == coinpkg.CodeLTC {
			bip44Coin = 2 + hardenedKeystart
		}
		return accountCode, backend.persistBTCAccountConfig(keystore, coin,
			accountCode,
			name,
			[]scriptTypeWithKeypath{
				{signing.ScriptTypeP2WPKH, signing.NewAbsoluteKeypathFromUint32(84+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2WPKHP2SH, signing.NewAbsoluteKeypathFromUint32(49+hardenedKeystart, bip44Coin, accountNumberHardened)},
			},
			accountsConfig,
		)
	case coinpkg.CodeETH, coinpkg.CodeRETH, coinpkg.CodeTETH:
		bip44Coin := "1'"
		if coinCode == coinpkg.CodeETH {
			bip44Coin = "60'"
		}
		return accountCode, backend.persistETHAccountConfig(
			keystore, coin, accountCode,
			// TODO: Use []uint32 instead of a string keypath
			fmt.Sprintf("m/44'/%s/0'/0/%d", bip44Coin, accountNumber),
			name,
			activeTokens,
			accountsConfig)
	default:
		return "", errp.Newf("Unrecognized coin code: %s", coinCode)
	}
}

// nextAccountNumber checks if an account for the given coin can be added, and if so, returns the
// account number of the new account.
func (backend *Backend) nextAccountNumber(coinCode coinpkg.Code, keystore keystore.Keystore, accountsConfig *config.AccountsConfig) (uint16, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return 0, err
	}
	filter := func(account *config.Account) bool {
		// Same coin:
		if coinCode != account.CoinCode {
			return false
		}
		// Belongs to keystore:
		return account.Configurations.ContainsRootFingerprint(rootFingerprint)
	}

	nextAccountNumber := uint16(len(backend.filterAccounts(accountsConfig, filter)))

	if nextAccountNumber >= accountsHardLimit {
		return 0, errp.WithStack(ErrAccountLimitReached)
	}
	return nextAccountNumber, nil
}

// CanAddAccount returns true if it is possible to add an account for the given coin and keystore.
func (backend *Backend) CanAddAccount(coinCode coinpkg.Code, keystore keystore.Keystore) bool {
	conf := backend.config.AccountsConfig()
	_, err := backend.nextAccountNumber(coinCode, keystore, &conf)
	return err == nil
}

// CreateAndPersistAccountConfig checks if an account for the given coin can be added, and if so,
// adds it to the accounts database. The next account number, which is part of the BIP44 keypath, is
// determined automatically to be the increment of the highest existing account.
// `name` is the account name, shown to the user. If empty, a default name will be set.
func (backend *Backend) CreateAndPersistAccountConfig(
	coinCode coinpkg.Code, name string, keystore keystore.Keystore) (string, error) {
	var accountCode string
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		nextAccountNumber, err := backend.nextAccountNumber(coinCode, keystore, accountsConfig)
		if err != nil {
			return err
		}
		accountCode, err = backend.createAndPersistAccountConfig(
			coinCode, nextAccountNumber, name, keystore, nil, accountsConfig)
		return err
	})
	return accountCode, err
}

// SetTokenActive activates/deactivates an token on an account. `tokenCode` must be an ERC20 token
// code, e.g. "eth-erc20-usdt", "eth-erc20-bat", etc.
func (backend *Backend) SetTokenActive(accountCode string, tokenCode string, active bool) error {
	return backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		return acct.SetTokenActive(tokenCode, active)
	})
}
