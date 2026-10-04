// SPDX-License-Identifier: Apache-2.0

package accountmanager

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// Keystore provides the connected keystore's identity and account capabilities.
type Keystore interface {
	RootFingerprint() ([]byte, error)
	SupportsAccount(coinpkg.Coin, interface{}) bool
}

// Options supplies runtime account construction, coin policy, and lifecycle integration.
type Options struct {
	CoinEnabled     func(coinpkg.Code) bool
	Coin            func(coinpkg.Code) (coinpkg.Coin, error)
	MakeAccount     func(coinpkg.Coin, *config.Account, LoadOptions) accounts.Interface
	OnInitialized   func(accounts.Interface)
	OnUninitialized func(accounts.Interface)
	Log             *logrus.Entry
}

// Manager reconciles persisted account snapshots with runtime membership. The caller applies
// the resulting rate updates and account notifications.
//
// Calls must be serialized with changes to the supplied snapshots and connected keystore.
// The same lock must cover membership-changing storage writes and their reconciliation.
// Lifecycle callbacks run synchronously; account events can also arrive asynchronously.
type Manager struct {
	registry accountRegistry

	coinEnabled func(coinpkg.Code) bool
	coin        func(coinpkg.Code) (coinpkg.Coin, error)
	makeAccount func(coinpkg.Coin, *config.Account, LoadOptions) accounts.Interface
	log         *logrus.Entry
}

// New creates an empty runtime account manager.
func New(options Options) *Manager {
	return &Manager{
		registry: newAccountRegistry(accountRegistryLifecycle{
			onInitialized:   options.OnInitialized,
			onUninitialized: options.OnUninitialized,
		}),
		coinEnabled: options.CoinEnabled,
		coin:        options.Coin,
		makeAccount: options.MakeAccount,
		log:         options.Log,
	}
}

// Accounts returns a snapshot of loaded runtime accounts in registration order.
func (manager *Manager) Accounts() []accounts.Interface {
	return manager.registry.all()
}

// Observe subscribes to account events. Each event's Object is an Event containing the source
// account and its original payload. The returned function unsubscribes the observer.
func (manager *Manager) Observe(observer func(observable.Event)) func() {
	return manager.registry.Observe(observer)
}

// Unload closes and removes all runtime accounts. A later reconciliation may load them again.
func (manager *Manager) Unload() {
	manager.registry.removeAll()
}

// Result describes runtime membership changes. The caller decides whether to
// refresh ETH accounts together or let newly initialized accounts enqueue their own refreshes.
type Result struct {
	MembershipChanged    bool
	ETHMembershipChanged bool
}

func (result *Result) merge(other Result) {
	result.MembershipChanged = result.MembershipChanged || other.MembershipChanged
	result.ETHMembershipChanged = result.ETHMembershipChanged || other.ETHMembershipChanged
}

// LoadOptions controls how persisted accounts are loaded into the runtime account registry.
type LoadOptions struct {
	// SkipETHInitialSync suppresses per-account ETH init refreshes when the caller will refresh all
	// loaded ETH accounts together.
	SkipETHInitialSync bool
}

// addAccount adds the given account to the manager and reports whether registry membership changed.
// The caller must hold the lifecycle lock.
func (manager *Manager) addAccount(account accounts.Interface) bool {
	added, err := manager.registry.add(account)
	if err != nil {
		manager.log.WithError(err).Error("error initializing account")
	}
	return added
}

// createAndAddAccount creates and registers the account and its enabled ERC20 tokens.
// It reports whether registry membership changed.
// The caller must hold the lifecycle lock.
func (manager *Manager) createAndAddAccount(
	coin coinpkg.Coin,
	persistedConfig *config.Account,
	options LoadOptions,
) bool {
	if manager.registry.lookup(persistedConfig.Code) != nil {
		// Do not create/load account if it is already loaded.
		return false
	}
	account := manager.makeAccount(coin, persistedConfig, options)
	membershipChanged := manager.addAccount(account)
	if _, isETH := coin.(*eth.Coin); isETH {
		// Load ERC20 tokens enabled with this Ethereum account.
		for _, erc20TokenCode := range persistedConfig.ActiveTokens {
			erc20CoinCode := coinpkg.Code(erc20TokenCode)
			token, err := manager.coin(erc20CoinCode)
			if err != nil {
				manager.log.WithError(err).Error("could not find ERC20 token")
				continue
			}
			erc20AccountCode := accountsTypes.Erc20AccountCode(persistedConfig.Code, erc20TokenCode)

			erc20Config := &config.Account{
				CoinCode:              erc20CoinCode,
				Code:                  erc20AccountCode,
				SigningConfigurations: persistedConfig.SigningConfigurations,
			}

			if manager.createAndAddAccount(token, erc20Config, options) {
				membershipChanged = true
			}
		}
	}
	return membershipChanged
}

// accountLoadable reports whether a persisted account belongs in the runtime registry.
// The caller must hold the lifecycle lock.
func (manager *Manager) accountLoadable(
	accountsConfig config.AccountsConfig,
	account *config.Account,
	keystore Keystore,
) (coinpkg.Coin, bool) {
	if !manager.coinEnabled(account.CoinCode) {
		return nil, false
	}
	accountCoin, err := manager.coin(account.CoinCode)
	if err != nil {
		manager.log.WithField("code", account.Code).WithError(err).Error("could not find account coin")
		return nil, false
	}

	isWatchonly, err := accountsConfig.IsAccountWatchOnly(account)
	if err != nil {
		manager.log.WithField("code", account.Code).WithError(err).Error("could not determine watch status")
		return nil, false
	}
	// Watch-only accounts are loaded regardless of support reported by the connected keystore. A
	// mismatch is handled when that keystore is later used for an account operation.
	if isWatchonly {
		return accountCoin, true
	}
	if keystore == nil {
		return nil, false
	}
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		manager.log.WithError(err).Error("could not retrieve keystore fingerprint")
		return nil, false
	}
	if !account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
		return nil, false
	}

	// Persisted accounts may have been created by a more capable keystore with the same seed.
	// For example, a BitBox02 Multi can persist altcoin accounts that must not be loaded when a
	// BTC-only BitBox02 is connected later. Watch-only accounts are handled above.
	switch accountCoin.(type) {
	case *btc.Coin:
		// Load the account if at least one signing configuration is supported, retaining all
		// configurations for complete balances and history on older firmware.
		for _, signingConfig := range account.SigningConfigurations {
			if keystore.SupportsAccount(accountCoin, signingConfig.ScriptType()) {
				return accountCoin, true
			}
		}
		return nil, false
	default:
		if !keystore.SupportsAccount(accountCoin, nil) {
			return nil, false
		}
	}
	return accountCoin, true
}

// isTokenAccountOf reports whether account is an ERC20 token derived from parentCode.
func isTokenAccountOf(account accounts.Interface, parentCode accountsTypes.Code) bool {
	return eth.IsERC20(account) &&
		account.Config().Code == accountsTypes.Erc20AccountCode(parentCode, string(account.Coin().Code()))
}

func (manager *Manager) removeAccountFamily(
	accountCode accountsTypes.Code,
) (result Result) {
	for _, account := range manager.registry.all() {
		if account.Config().Code != accountCode && !isTokenAccountOf(account, accountCode) {
			continue
		}
		if manager.registry.remove(account.Config().Code) {
			result.MembershipChanged = true
			if _, isETH := account.Coin().(*eth.Coin); isETH {
				result.ETHMembershipChanged = true
			}
		}
	}
	return result
}

// ReconcileFamily reconciles one persisted account and its derived token accounts.
// Newly loaded ETH accounts enqueue their own initial refreshes.
// The caller must hold the lifecycle lock.
func (manager *Manager) ReconcileFamily(
	accountsConfig config.AccountsConfig,
	accountCode accountsTypes.Code,
	keystore Keystore,
) Result {
	return manager.reconcileAccountFamily(accountsConfig, accountCode, LoadOptions{}, keystore)
}

// reconcileAccountFamily reconciles one persisted account and its derived token accounts.
// The caller must hold the lifecycle lock.
func (manager *Manager) reconcileAccountFamily(
	accountsConfig config.AccountsConfig,
	accountCode accountsTypes.Code,
	options LoadOptions,
	keystore Keystore,
) (result Result) {
	record := accountsConfig.Lookup(accountCode)
	if record == nil {
		return Result{}
	}

	accountCoin, loadable := manager.accountLoadable(accountsConfig, record, keystore)
	if !loadable {
		return manager.removeAccountFamily(accountCode)
	}

	loadedAccount := manager.registry.lookup(accountCode)
	if loadedAccount == nil {
		added := manager.createAndAddAccount(
			accountCoin,
			record,
			options,
		)
		_, isETH := accountCoin.(*eth.Coin)
		return Result{MembershipChanged: added, ETHMembershipChanged: added && isETH}
	}

	if _, isETH := accountCoin.(*eth.Coin); !isETH {
		return Result{}
	}

	for _, account := range manager.registry.all() {
		if !isTokenAccountOf(account, accountCode) {
			continue
		}
		if slices.Contains(record.ActiveTokens, string(account.Coin().Code())) {
			continue
		}
		if manager.registry.remove(account.Config().Code) {
			result.MembershipChanged = true
			result.ETHMembershipChanged = true
		}
	}
	for _, tokenCode := range record.ActiveTokens {
		tokenAccountCode := accountsTypes.Erc20AccountCode(accountCode, tokenCode)
		if manager.registry.lookup(tokenAccountCode) != nil {
			continue
		}
		tokenCoin, err := manager.coin(coinpkg.Code(tokenCode))
		if err != nil {
			manager.log.WithField("code", tokenAccountCode).WithError(err).Error("could not find ERC20 token")
			continue
		}
		tokenRecord := &config.Account{
			CoinCode:              tokenCoin.Code(),
			Code:                  tokenAccountCode,
			SigningConfigurations: record.SigningConfigurations,
		}
		if manager.createAndAddAccount(
			tokenCoin,
			tokenRecord,
			options,
		) {
			result.MembershipChanged = true
			result.ETHMembershipChanged = true
		}
	}
	return result
}

// Reconcile makes runtime membership match one authoritative accounts database snapshot.
// replaceFamilies forces replacement of families whose immutable construction data changed.
// These families are unloaded before reconciling the snapshot.
// The caller must hold the lifecycle lock.
func (manager *Manager) Reconcile(
	accountsConfig config.AccountsConfig,
	keystore Keystore,
	replaceFamilies ...accountsTypes.Code,
) (result Result) {
	for _, code := range replaceFamilies {
		result.merge(manager.removeAccountFamily(code))
	}
	desiredAccountCodes := make(map[accountsTypes.Code]struct{}, len(accountsConfig.Accounts))
	for _, record := range accountsConfig.Accounts {
		desiredAccountCodes[record.Code] = struct{}{}
		for _, tokenCode := range record.ActiveTokens {
			desiredAccountCodes[accountsTypes.Erc20AccountCode(record.Code, tokenCode)] = struct{}{}
		}

		result.merge(manager.reconcileAccountFamily(
			accountsConfig,
			record.Code,
			LoadOptions{SkipETHInitialSync: true},
			keystore,
		))
	}

	for _, account := range manager.registry.all() {
		if _, desired := desiredAccountCodes[account.Config().Code]; desired {
			continue
		}
		if manager.registry.remove(account.Config().Code) {
			result.MembershipChanged = true
			if _, isETH := account.Coin().(*eth.Coin); isETH {
				result.ETHMembershipChanged = true
			}
		}
	}
	return result
}
