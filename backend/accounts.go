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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
)

// hardenedKeystart is the BIP44 offset to make a keypath element hardened.
const hardenedKeystart uint32 = hdkeychain.HardenedKeyStart

// accountsHardlimit is the maximum possible number of accounts per coin and keystore.  This is
// useful in recovery, so we can scan a fixed number of accounts to discover all funds.  The
// alternative (or a complement) would be an accounts gap limit, similar to Bitcoin's address gap
// limit, but simply use a hard limit for simplicity.
const accountsHardLimit = 5

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
		coinpkg.CodeETH, coinpkg.CodeTETH, coinpkg.CodeRETH,
	}
	var availableCoins []coinpkg.Code
	for _, coinCode := range allCoins {
		if _, isTestnet := coinpkg.TestnetCoins[coinCode]; !backend.arguments.Regtest() && isTestnet != backend.Testing() {
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

// defaultAccountName returns a default name for a new account. The first account is the coin name,
// the following accounts is the coin name followed by the account number. Note: `accountNumber` is
// 0-indexed, so `accountNumber 1` results in e.g. "Bitcoin 2".
func defaultAccountName(coin coinpkg.Coin, accountNumber uint16) string {
	if accountNumber > 0 {
		return fmt.Sprintf("%s %d", coin.Name(), accountNumber+1)
	}
	return coin.Name()
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
	accountsConfig *config.AccountsConfig) (accounts.Code, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", err
	}
	coin, err := backend.Coin(coinCode)
	if err != nil {
		return "", err
	}
	if name == "" {
		name = defaultAccountName(coin, accountNumber)
	}

	// v0 prefix: in case this code turns out to be not unique in the future, we can switch to 'v1-'
	// and avoid any collisions.
	accountCode := regularAccountCode(rootFingerprint, coinCode, accountNumber)

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
				{signing.ScriptTypeP2TR, signing.NewAbsoluteKeypathFromUint32(86+hardenedKeystart, bip44Coin, accountNumberHardened)},
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
func nextAccountNumber(coinCode coinpkg.Code, keystore keystore.Keystore, accountsConfig *config.AccountsConfig) (uint16, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return 0, err
	}
	nextAccountNumber := uint16(0)
	for _, account := range accountsConfig.Accounts {
		if coinCode != account.CoinCode {
			continue
		}
		if !account.Configurations.ContainsRootFingerprint(rootFingerprint) {
			continue
		}
		if len(account.Configurations) == 0 {
			continue
		}
		accountNumber, err := account.Configurations[0].AccountNumber()
		if err != nil {
			continue
		}
		if accountNumber+1 > nextAccountNumber {
			nextAccountNumber = accountNumber + 1
		}
	}
	if !keystore.SupportsMultipleAccounts() && nextAccountNumber >= 1 {
		return 0, errp.WithStack(ErrAccountLimitReached)
	}

	if nextAccountNumber >= accountsHardLimit {
		return 0, errp.WithStack(ErrAccountLimitReached)
	}
	return nextAccountNumber, nil
}

// CanAddAccount returns true if it is possible to add an account for the given coin and keystore,
// along with a suggested name for the account.
func (backend *Backend) CanAddAccount(coinCode coinpkg.Code, keystore keystore.Keystore) (string, bool) {
	conf := backend.config.AccountsConfig()
	accountNumber, err := nextAccountNumber(coinCode, keystore, &conf)
	if err != nil {
		return "", false
	}
	coin, err := backend.Coin(coinCode)
	if err != nil {
		return "", false
	}
	return defaultAccountName(coin, accountNumber), true
}

// CreateAndPersistAccountConfig checks if an account for the given coin can be added, and if so,
// adds it to the accounts database. The next account number, which is part of the BIP44 keypath, is
// determined automatically to be the increment of the highest existing account.
// `name` is the account name, shown to the user. If empty, a default name will be set.
func (backend *Backend) CreateAndPersistAccountConfig(
	coinCode coinpkg.Code, name string, keystore keystore.Keystore) (accounts.Code, error) {
	var accountCode accounts.Code
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		nextAccountNumber, err := nextAccountNumber(coinCode, keystore, accountsConfig)
		if err != nil {
			return err
		}
		accountCode, err = backend.createAndPersistAccountConfig(
			coinCode, nextAccountNumber, name, keystore, nil, accountsConfig)
		return err
	})
	if err != nil {
		return "", err
	}
	backend.ReinitializeAccounts()
	return accountCode, nil
}

// SetAccountActive activates/deactivates an account.
func (backend *Backend) SetAccountActive(accountCode accounts.Code, active bool) error {
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		acct.Inactive = !active
		return nil
	})
	if err != nil {
		return err
	}
	backend.ReinitializeAccounts()
	return nil
}

// SetTokenActive activates/deactivates an token on an account. `tokenCode` must be an ERC20 token
// code, e.g. "eth-erc20-usdt", "eth-erc20-bat", etc.
func (backend *Backend) SetTokenActive(accountCode accounts.Code, tokenCode string, active bool) error {
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		return acct.SetTokenActive(tokenCode, active)
	})
	if err != nil {
		return err
	}
	backend.ReinitializeAccounts()
	return nil
}

// RenameAccount renames an account in the accounts database.
func (backend *Backend) RenameAccount(accountCode accounts.Code, name string) error {
	if name == "" {
		return errp.New("Name cannot be empty")
	}
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		acct.Name = name
		return nil
	})
	if err != nil {
		return err
	}
	backend.ReinitializeAccounts()
	return nil
}

// addAccount adds the given account to the backend.
// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) addAccount(account accounts.Interface) {
	backend.accounts = append(backend.accounts, account)
	account.Observe(backend.Notify)
	if backend.onAccountInit != nil {
		backend.onAccountInit(account)
	}
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) createAndAddAccount(
	coin coinpkg.Coin,
	code accounts.Code,
	name string,
	signingConfigurations signing.Configurations,
	active bool,
	activeTokens []string,
) {
	var account accounts.Interface
	accountConfig := &accounts.AccountConfig{
		Active:      active,
		Code:        code,
		Name:        name,
		DBFolder:    backend.arguments.CacheDirectoryPath(),
		NotesFolder: backend.arguments.NotesDirectoryPath(),
		Keystore:    backend.keystore,
		OnEvent: func(event accounts.Event) {
			backend.events <- AccountEvent{Type: "account", Code: code, Data: string(event)}
			if account != nil && event == accounts.EventSyncDone {
				backend.notifyNewTxs(account)
			}
		},
		RateUpdater:           backend.ratesUpdater,
		SigningConfigurations: signingConfigurations,
		GetNotifier: func(configurations signing.Configurations) accounts.Notifier {
			return backend.notifier.ForAccount(code)
		},
		GetSaveFilename:  backend.environment.GetSaveFilename,
		UnsafeSystemOpen: backend.environment.SystemOpen,
	}

	switch specificCoin := coin.(type) {
	case *btc.Coin:
		account = btc.NewAccount(
			accountConfig,
			specificCoin,
			backend.arguments.GapLimits(),
			backend.log,
		)
		backend.addAccount(account)
	case *eth.Coin:
		account = eth.NewAccount(accountConfig, specificCoin, backend.httpClient, backend.log)
		backend.addAccount(account)

		// Load ERC20 tokens enabled with this Ethereum account.
		for _, erc20TokenCode := range activeTokens {
			token, err := backend.Coin(coinpkg.Code(erc20TokenCode))
			if err != nil {
				backend.log.WithError(err).Error("could not find ERC20 token")
				continue
			}
			erc20AccountCode := Erc20AccountCode(code, erc20TokenCode)

			tokenName := token.Name()

			accountNumber, err := accountConfig.SigningConfigurations[0].AccountNumber()
			if err != nil {
				backend.log.WithError(err).Error("could not get account number")
			} else if accountNumber > 0 {
				tokenName = fmt.Sprintf("%s %d", tokenName, accountNumber+1)
			}
			backend.createAndAddAccount(token, erc20AccountCode, tokenName, signingConfigurations, active, nil)
		}
	default:
		panic("unknown coin type")
	}
}

func (backend *Backend) emitAccountsStatusChanged() {
	backend.Notify(observable.Event{
		Subject: "accounts",
		Action:  action.Reload,
	})
}

// persistAccount adds the account information to the accounts database. These accounts are loaded
// in `initPersistedAccounts()`.
func (backend *Backend) persistAccount(account config.Account, accountsConfig *config.AccountsConfig) error {
	if account.Name == "" {
		return errp.New("Account name cannot be empty")
	}
	for idx := range accountsConfig.Accounts {
		account2 := &accountsConfig.Accounts[idx]
		if account.Code == account2.Code {
			backend.log.Errorf("An account with same code exists: %s", account.Code)
			return errp.WithStack(ErrAccountAlreadyExists)
		}
		if account.CoinCode == account2.CoinCode {
			// We detect a duplicate account (subaccount in a unified account) if any of the
			// configurations is already present.
			for _, config := range account.Configurations {
				for _, config2 := range account2.Configurations {
					if config.ExtendedPublicKey().String() == config2.ExtendedPublicKey().String() {
						return errp.WithStack(ErrAccountAlreadyExists)
					}
				}
			}

		}
	}
	accountsConfig.Accounts = append(accountsConfig.Accounts, account)
	return nil
}

type scriptTypeWithKeypath struct {
	scriptType signing.ScriptType
	keypath    signing.AbsoluteKeypath
}

// adds a combined BTC account with the given script types.
func (backend *Backend) persistBTCAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code accounts.Code,
	name string,
	configs []scriptTypeWithKeypath,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.WithField("code", code).WithField("name", name)
	var supportedConfigs []scriptTypeWithKeypath
	for _, cfg := range configs {
		if keystore.SupportsAccount(coin, cfg.scriptType) {
			supportedConfigs = append(supportedConfigs, cfg)
		}
	}
	if len(supportedConfigs) == 0 {
		log.Info("skipping unsupported account")
		return nil
	}
	log.Info("persist account")

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}

	var signingConfigurations signing.Configurations
	for _, cfg := range supportedConfigs {
		extendedPublicKey, err := keystore.ExtendedPublicKey(coin, cfg.keypath)
		if err != nil {
			log.WithError(err).Errorf(
				"Could not derive xpub at keypath %s", cfg.keypath.Encode())
			return err
		}

		signingConfiguration := signing.NewBitcoinConfiguration(
			cfg.scriptType,
			rootFingerprint,
			cfg.keypath,
			extendedPublicKey,
		)
		signingConfigurations = append(signingConfigurations, signingConfiguration)
	}

	if keystore.SupportsUnifiedAccounts() {
		return backend.persistAccount(config.Account{
			CoinCode:       coin.Code(),
			Name:           name,
			Code:           code,
			Configurations: signingConfigurations,
		}, accountsConfig)
	}

	// Unified accounts not supported, so we add one account per configuration.
	for _, cfg := range signingConfigurations {
		suffixedName := name
		switch cfg.ScriptType() {
		case signing.ScriptTypeP2PKH:
			suffixedName += ": legacy"
		case signing.ScriptTypeP2WPKH:
			suffixedName += ": bech32"
		}

		err := backend.persistAccount(config.Account{
			CoinCode:       coin.Code(),
			Name:           suffixedName,
			Code:           splitAccountCode(code, cfg.ScriptType()),
			Configurations: signing.Configurations{cfg},
		}, accountsConfig)
		if err != nil {
			return err
		}
	}
	return nil
}

func (backend *Backend) persistETHAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code accounts.Code,
	keypath string,
	name string,
	activeTokens []string,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.
		WithField("code", code).
		WithField("name", name).
		WithField("keypath", keypath)

	if !keystore.SupportsAccount(coin, nil) {
		log.Info("skipping unsupported account")
		return nil
	}

	log.Info("persist account")
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	extendedPublicKey, err := keystore.ExtendedPublicKey(coin, absoluteKeypath)
	if err != nil {
		return err
	}

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}
	signingConfigurations := signing.Configurations{
		signing.NewEthereumConfiguration(
			rootFingerprint,
			absoluteKeypath,
			extendedPublicKey,
		),
	}

	return backend.persistAccount(config.Account{
		CoinCode:       coin.Code(),
		Name:           name,
		Code:           code,
		Configurations: signingConfigurations,
		ActiveTokens:   activeTokens,
	}, accountsConfig)
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) initPersistedAccounts() {
	if backend.keystore == nil {
		return
	}
	// Only load accounts which belong to connected keystores.
	rootFingerprint, err := backend.keystore.RootFingerprint()
	if err != nil {
		backend.log.WithError(err).Error("Could not retrieve root fingerprint")
		return
	}
	keystoreConnected := func(account *config.Account) bool {
		return account.Configurations.ContainsRootFingerprint(rootFingerprint)
	}

	persistedAccounts := backend.config.AccountsConfig()
outer:
	for _, account := range backend.filterAccounts(&persistedAccounts, keystoreConnected) {
		coin, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}
		switch coin.(type) {
		case *btc.Coin:
			for _, cfg := range account.Configurations {
				if !backend.keystore.SupportsAccount(coin, cfg.ScriptType()) {
					continue outer
				}
			}
		default:
			if !backend.keystore.SupportsAccount(coin, nil) {
				continue
			}
		}

		backend.createAndAddAccount(
			coin, account.Code, account.Name, account.Configurations, !account.Inactive, account.ActiveTokens)
	}
}

// persistDefaultAccountConfigs persists a bunch of default accounts for the connected keystore (not
// manually user-added). Currently the first bip44 account of BTC/LTC/ETH. ERC20 tokens are added if
// they were configured to be active by the user in the past, when they could still configure them
// globally in the settings.
//
// The accounts are only added for the coins that are marked active in the settings. This used to be
// a user-facing setting. Now we simply use it for migration to decide which coins to add by
// default.
func (backend *Backend) persistDefaultAccountConfigs(keystore keystore.Keystore, accountsConfig *config.AccountsConfig) error {
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinpkg.CodeRBTC) {
				if _, err := backend.createAndPersistAccountConfig(coinpkg.CodeRBTC, 0, "", keystore, nil, accountsConfig); err != nil {
					return err
				}
			}
		} else {
			for _, coinCode := range []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeTETH, coinpkg.CodeRETH} {
				if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
					if _, err := backend.createAndPersistAccountConfig(coinCode, 0, "", keystore, nil, accountsConfig); err != nil {
						return err

					}
				}
			}
		}
	} else {
		for _, coinCode := range []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH} {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
				// In the past, ERC20 tokens were configured to be active or inactive globally, now they are
				// active/inactive per ETH account. We use the previous global settings to decide the default
				// set of active tokens, for a smoother migration for the user.
				var activeTokens []string
				if coinCode == coinpkg.CodeETH {
					for _, tokenCode := range backend.config.AppConfig().Backend.ETH.DeprecatedActiveERC20Tokens {
						prefix := "eth-erc20-"
						// Old config entries did not contain this prefix, but the token codes in the new config
						// do, to match the codes listed in erc20.go
						activeTokens = append(activeTokens, prefix+tokenCode)
					}
				}

				if _, err := backend.createAndPersistAccountConfig(coinCode, 0, "", keystore, activeTokens, accountsConfig); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// maybeAddP2TR adds a taproot subaccount to all Bitcoin accounts if the keystore suports it.
func (backend *Backend) maybeAddP2TR(keystore keystore.Keystore, accounts []*config.Account) error {
	if !keystore.SupportsUnifiedAccounts() {
		// This case is true only for the BitBox01 keystore only at the moment, where accounts are
		// not unified, but subaccounts are added as top-level accounts instead. We won't handle
		// this case as the BitBox01 doesn't support taproot. This could be revisited if there is
		// ever another keystore that doesn't support unified accounts.
		return nil
	}
	for _, account := range accounts {
		if account.CoinCode == coinpkg.CodeBTC ||
			account.CoinCode == coinpkg.CodeTBTC ||
			account.CoinCode == coinpkg.CodeRBTC {
			coin, err := backend.Coin(account.CoinCode)
			if err != nil {
				return err
			}
			if keystore.SupportsAccount(coin, signing.ScriptTypeP2TR) &&
				account.Configurations.FindScriptType(signing.ScriptTypeP2TR) == -1 {
				rootFingerprint, err := backend.keystore.RootFingerprint()
				if err != nil {
					return err
				}
				bip44Coin := 1 + hardenedKeystart
				if account.CoinCode == coinpkg.CodeBTC {
					bip44Coin = hardenedKeystart
				}
				accountNumber, err := account.Configurations[0].AccountNumber()
				if err != nil {
					return err
				}
				keypath := signing.NewAbsoluteKeypathFromUint32(
					86+hdkeychain.HardenedKeyStart,
					bip44Coin,
					uint32(accountNumber)+hdkeychain.HardenedKeyStart)
				extendedPublicKey, err := keystore.ExtendedPublicKey(coin, keypath)
				if err != nil {
					return err
				}
				account.Configurations = append(
					account.Configurations,
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2TR,
						rootFingerprint,
						keypath,
						extendedPublicKey,
					))
				backend.log.WithField("code", account.Code).
					Info("upgraded account with taproot subaccount")
			}
		}
	}
	return nil
}

// updatePersistedAccounts handles any updates to the persisted accounts before loading them, to
// perform migrations, updates etc. We use it to add taproot subaccounts to Bitcoin accounts that
// were created (persisted) before the introduction of taproot support.
func (backend *Backend) updatePersistedAccounts(
	keystore keystore.Keystore, accounts []*config.Account) error {
	return backend.maybeAddP2TR(keystore, accounts)
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) initAccounts() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitAccounts()

	backend.initPersistedAccounts()

	backend.emitAccountsStatusChanged()

	// The updater fetches rates only for active accounts, so this seems the most
	// appropriate place to update exchange rate configuration.
	// Every time fiats or coins list is changed in the UI settings, ReinitializedAccounts
	// is invoked which triggers this method.
	backend.configureHistoryExchangeRates()
}

// ReinitializeAccounts uninits and then reinits all accounts. This is useful to reload the accounts
// if the configuration changed (e.g. which accounts are active). This is a stopgap measure until
// accounts can be added and removed individually.
func (backend *Backend) ReinitializeAccounts() {
	defer backend.accountsAndKeystoreLock.Lock()()

	backend.log.Info("Reinitializing accounts")
	backend.initAccounts()
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) uninitAccounts() {
	for _, account := range backend.accounts {
		account := account
		if backend.onAccountUninit != nil {
			backend.onAccountUninit(account)
		}
		account.Close()
	}
	backend.accounts = []accounts.Interface{}
}
