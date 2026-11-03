// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"encoding/hex"
	"errors"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// accountDiscovery holds the workers for one keystore fingerprint. accountDiscoveryLock protects
// their registration; the wake map is immutable once registered. Cancellation interrupts waiting.
type accountDiscovery struct {
	cancel context.CancelFunc
	wake   map[coinpkg.Code]chan struct{}
}

// startAccountDiscoveryLocked starts one sequential scanner per supported discovery coin for ks.
// Any existing scanners for the same root fingerprint are canceled first.
// The lifecycle lock must be held, and runtime accounts must already have been reconciled.
func (backend *Backend) startAccountDiscoveryLocked(ks keystore.Keystore) {
	if ks == nil || backend.closed {
		return
	}
	rootFingerprint, err := ks.RootFingerprint()
	if err != nil {
		backend.log.WithError(err).Error("could not retrieve discovery keystore fingerprint")
		return
	}
	backend.stopAccountDiscoveryLocked(rootFingerprint)
	ctx, cancel := context.WithCancel(context.Background())
	discovery := &accountDiscovery{cancel: cancel, wake: map[coinpkg.Code]chan struct{}{}}
	// ETH discovery needs more care because its backend is rate limited.
	for _, coinCode := range backend.coinPolicy().discoveryCoins() {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			backend.log.WithError(err).Error("could not find discovery coin")
			continue
		}
		if !ks.SupportsCoin(coin) {
			continue
		}
		discovery.wake[coinCode] = make(chan struct{}, 1)
	}
	unlock := backend.accountDiscoveryLock.Lock()
	backend.accountDiscovery[hex.EncodeToString(rootFingerprint)] = discovery
	unlock()
	if backend.tstDisableAccountDiscovery {
		return
	}
	for coinCode, wake := range discovery.wake {
		backend.discoveryWorkers.Add(1)
		go backend.discoverAccounts(ctx, ks, coinCode, rootFingerprint, wake)
	}
}

// stopAccountDiscoveryLocked cancels only the workers for the given root fingerprint.
// Call under the lifecycle lock before replacing the keystore or its runtime accounts. Workers
// check cancellation under that lock before loading or creating accounts. In-flight history
// reads may still finish and persist usage after cancellation.
func (backend *Backend) stopAccountDiscoveryLocked(rootFingerprint []byte) {
	defer backend.accountDiscoveryLock.Lock()()
	key := hex.EncodeToString(rootFingerprint)
	if discovery := backend.accountDiscovery[key]; discovery != nil {
		discovery.cancel()
		delete(backend.accountDiscovery, key)
	}
}

// stopAllAccountDiscoveryLocked cancels all scanners before shared runtime state is cleared or
// shut down. The lifecycle lock must be held.
func (backend *Backend) stopAllAccountDiscoveryLocked() {
	defer backend.accountDiscoveryLock.Lock()()
	for _, discovery := range backend.accountDiscovery {
		discovery.cancel()
	}
	clear(backend.accountDiscovery)
}

// wakeAccountDiscovery signals a sync, usage, or membership change for this account's coin and
// fingerprint. Coalescing signals is safe because the worker re-reads current state each time.
// It can be called with or without the lifecycle lock. Frontend reloads do not drive discovery.
func (backend *Backend) wakeAccountDiscovery(account accounts.Interface) {
	fingerprint, err := account.Config().SigningConfigurations.RootFingerprint()
	if err != nil {
		return
	}
	defer backend.accountDiscoveryLock.RLock()()
	if discovery := backend.accountDiscovery[hex.EncodeToString(fingerprint)]; discovery != nil {
		select {
		case discovery.wake[account.Coin().Code()] <- struct{}{}:
		default:
		}
	}
}

func (backend *Backend) discoverAccounts(
	ctx context.Context, ks keystore.Keystore, coinCode coinpkg.Code, rootFingerprint []byte,
	wake <-chan struct{},
) {
	defer backend.discoveryWorkers.Done()
	log := backend.log.WithField("coinCode", coinCode).
		WithField("rootFingerprint", hex.EncodeToString(rootFingerprint))
	// Successful checks belong to runtime instances. Keep them across wakes so a later sync
	// failure does not erase known usage, while still checking unused accounts for new history.
	checked := map[accounts.Interface]bool{}
	for {
		err := backend.advanceAccountDiscovery(ctx, ks, coinCode, rootFingerprint, checked)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			log.WithError(err).Error("could not advance account discovery")
		}
		// Wait for a sync, usage, or membership change, including any queued during this step.
		// Loading an account also queues a membership change. Every wake
		// selects from current state, so a removed or replaced account cannot strand this worker.
		select {
		case <-ctx.Done():
			return
		case <-wake:
		}
	}
}

// loadDiscoveryAccounts loads persisted accounts before checking usage, so all accounts can
// sync independently of discovery order. The lifecycle lock protects loading and cancellation.
func (backend *Backend) loadDiscoveryAccounts(
	ctx context.Context, ks keystore.Keystore, coinCode coinpkg.Code, rootFingerprint []byte,
) ([]accounts.Interface, error) {
	defer backend.accountsAndKeystoreLock.Lock()()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		return nil, err
	}
	loaded := map[accountsTypes.Code]accounts.Interface{}
	for _, account := range backend.accounts.Accounts() {
		loaded[account.Config().Code] = account
	}
	var result []accounts.Interface
	// A previous attempt may have persisted an account but failed to load its snapshot.
	// Retry loading missing accounts so their sync can run independently of discovery order.
	for _, candidate := range accountCandidates(&accountsConfig, rootFingerprint, coinCode) {
		code := candidate.account.Code
		account := loaded[code]
		if account == nil {
			account = backend.loadDiscoveryAccountLocked(ks, accountsConfig, code)
		}
		if account != nil {
			result = append(result, account)
		}
	}
	return result, nil
}

// advanceAccountDiscovery checks usage, then creates the next hidden account if all loaded
// accounts have known usage and the gap limit allows it. History reads and usage persistence run
// outside the lifecycle lock, so they do not block account listing, loading, or disconnection.
// checked belongs to this worker and retains successful checks for loaded runtime instances.
func (backend *Backend) advanceAccountDiscovery(
	ctx context.Context, ks keystore.Keystore, coinCode coinpkg.Code, rootFingerprint []byte,
	checked map[accounts.Interface]bool,
) error {
	toCheck, err := backend.loadDiscoveryAccounts(ctx, ks, coinCode, rootFingerprint)
	if err != nil {
		return err
	}
	for _, account := range toCheck {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := backend.checkAccountUsed(account); err != nil {
			if !errors.Is(err, accounts.ErrSyncInProgress) {
				backend.log.WithField("accountCode", account.Config().Code).
					WithError(err).Error("could not check account usage")
			}
			// An unready or failed account must not prevent later accounts from being unhidden.
			continue
		}
		checked[account] = true
	}

	defer backend.accountsAndKeystoreLock.Lock()()
	if err := ctx.Err(); err != nil {
		return err
	}
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		return err
	}
	loaded := map[accountsTypes.Code]accounts.Interface{}
	for _, account := range backend.accounts.Accounts() {
		loaded[account.Config().Code] = account
	}
	for account := range checked {
		if loaded[account.Config().Code] != account {
			delete(checked, account)
		}
	}
	candidates := accountCandidates(&accountsConfig, rootFingerprint, coinCode)
	for _, candidate := range candidates {
		account := loaded[candidate.account.Code]
		if account == nil || candidate.account.Used {
			// Persisted usage already answers the discovery question, even if another sync fails.
			continue
		}
		// A successful empty check counts only for the same runtime instance. A removed or
		// replaced account cannot supply results for newly loaded accounts.
		if !checked[account] {
			return nil
		}
	}
	next, ok := nextDiscoveryAccountNumber(coinCode, candidates)
	if !ok {
		return nil
	}
	return backend.createDiscoveryAccountLocked(ks, coinCode, next)
}

// createDiscoveryAccountLocked builds and persists a hidden account, then loads it if possible.
// The lifecycle lock must be held.
func (backend *Backend) createDiscoveryAccountLocked(
	ks keystore.Keystore, coinCode coinpkg.Code, number uint16,
) error {
	_, record, err := backend.accountBuilder.Build(coinCode, number, true, "", ks, nil)
	if err != nil || record == nil {
		return err
	}
	if err := backend.accountsDB.Update(func(cfg *config.AccountsConfig) error {
		return backend.persistAccount(*record, cfg)
	}); err != nil {
		return err
	}
	backend.log.WithField("accountCode", record.Code).WithField("accountNumber", number).
		Info("automatically created hidden account")
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		return err
	}
	backend.loadDiscoveryAccountLocked(ks, accountsConfig, record.Code)
	return nil
}

func (backend *Backend) loadDiscoveryAccountLocked(
	ks keystore.Keystore, accountsConfig config.AccountsConfig, code accountsTypes.Code,
) accounts.Interface {
	result := backend.accounts.ReconcileFamily(accountsConfig, code, ks)
	if result.MembershipChanged {
		// Discovery adds scanning accounts without restarting historical exchange-rate updates.
		backend.emitAccountsStatusChanged()
	}
	for _, account := range backend.accounts.Accounts() {
		if account.Config().Code == code {
			return account
		}
	}
	return nil
}

// checkAccountUsed records usage and unhides used accounts. An unused account is also a successful
// check; errors mean usage could not be inspected or persisted.
func (backend *Backend) checkAccountUsed(account accounts.Interface) error {
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		return err
	}
	accountRecord := accountsConfig.Lookup(account.Config().Code)
	if accountRecord == nil {
		return errp.Newf("could not find account %s", account.Config().Code)
	}
	if accountRecord.Used && !accountRecord.HiddenBecauseUnused {
		return nil
	}
	if !accountRecord.Used {
		if !account.Synced() {
			return accounts.ErrSyncInProgress
		}
		if account.FatalError() {
			return errp.New("cannot check usage after a fatal sync error")
		}
		txs, err := account.Transactions()
		if err != nil {
			return err
		}

		if len(txs) == 0 {
			return nil
		}
	}
	if err := backend.markAccountUsed(account.Config().Code); err != nil {
		return err
	}
	// A canceled worker can finish persisting usage after account replacement. Wake the
	// current worker too, so it sees that usage even if its new runtime has not synced yet.
	backend.wakeAccountDiscovery(account)
	return nil
}

// markAccountUsed persists known usage and makes the account visible.
func (backend *Backend) markAccountUsed(code accountsTypes.Code) error {
	backend.log.WithField("accountCode", code).Info("marking account as used")
	var emitUpdate bool
	err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(code)
		if acct == nil {
			return errp.Newf("could not find account")
		}
		emitUpdate = !acct.Used || acct.HiddenBecauseUnused
		acct.Used = true
		acct.HiddenBecauseUnused = false

		return nil
	})
	if err != nil {
		return err
	}
	if emitUpdate {
		backend.emitAccountsStatusChanged()
	}
	return nil
}
