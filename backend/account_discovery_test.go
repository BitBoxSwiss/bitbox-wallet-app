// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accountmanager"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

// advanceTestAccountDiscovery starts at most one scan per coin with the background workers
// disabled. Other backend tests use it to set up hidden accounts deterministically.
func advanceTestAccountDiscovery(t *testing.T, backend *Backend) {
	t.Helper()
	require.True(t, backend.tstDisableAccountDiscovery)
	fingerprint, err := backend.keystore.RootFingerprint()
	require.NoError(t, err)
	require.Contains(t, backend.accountDiscovery, hex.EncodeToString(fingerprint))
	for _, code := range backend.coinPolicy().discoveryCoins() {
		coin, err := backend.Coin(code)
		require.NoError(t, err)
		if backend.keystore.SupportsCoin(coin) {
			err := backend.advanceAccountDiscovery(context.Background(), backend.keystore, code, fingerprint, map[accounts.Interface]bool{})
			require.NoError(t, err)
		}
	}
}

type discoveryTestAccount struct {
	observable.Implementation
	synced atomic.Bool
	used   atomic.Bool
	fail   atomic.Bool
	fatal  atomic.Bool
	closed atomic.Bool
	reads  atomic.Int32
}

func (account *discoveryTestAccount) finish(used bool) {
	account.used.Store(used)
	account.synced.Store(true)
	account.Notify(observable.Event{Subject: string(accountsTypes.EventSyncDone)})
}

type discoveryTestBackend struct {
	*Backend
	created sync.Map
	close   func()
}

func newDiscoveryTestBackend(t *testing.T) *discoveryTestBackend {
	t.Helper()
	h := &discoveryTestBackend{Backend: newBackend(t, testnetDisabled, regtestDisabled)}
	h.tstDisableAccountDiscovery = false
	var once sync.Once
	h.close = func() { once.Do(func() { require.NoError(t, h.Close()) }) }
	t.Cleanup(h.close)
	configure := func(account *accountsMocks.InterfaceMock) accounts.Interface {
		state := &discoveryTestAccount{}
		account.ObserveFunc = state.Observe
		account.SyncedFunc = state.synced.Load
		account.FatalErrorFunc = state.fatal.Load
		account.NotifierFunc = func() accounts.Notifier { return nil }
		account.CloseFunc = func() {
			state.closed.Store(true)
			state.synced.Store(false)
		}
		account.TransactionsFunc = func() (accounts.OrderedTransactions, error) {
			state.reads.Add(1)
			if state.fail.Load() || !state.synced.Load() {
				return nil, errors.New("sync not ready")
			}
			if state.used.Load() {
				return accounts.OrderedTransactions{&accounts.TransactionData{}}, nil
			}
			return nil, nil
		}
		h.created.Store(account.Config().Code, state)
		return account
	}
	h.makeBtcAccount = func(cfg *accounts.AccountConfig, coin *btc.Coin, limits *types.GapLimits,
		_ func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry,
	) accounts.Interface {
		return configure(MockBtcAccount(t, cfg, coin, limits, log))
	}
	h.makeEthAccount = func(cfg *accounts.AccountConfig, coin *eth.Coin, log *logrus.Entry) accounts.Interface {
		return configure(MockEthAccount(cfg, coin, log))
	}
	return h
}

func (h *discoveryTestBackend) account(t *testing.T, code accountsTypes.Code) *discoveryTestAccount {
	t.Helper()
	require.Eventually(t, func() bool {
		_, ok := h.created.Load(code)
		return ok
	}, 5*time.Second, time.Millisecond, "account %s was not created", code)
	value, _ := h.created.Load(code)
	return value.(*discoveryTestAccount)
}

func (h *discoveryTestBackend) noAccount(t *testing.T, code accountsTypes.Code) {
	t.Helper()
	require.Never(t, func() bool {
		_, ok := h.created.Load(code)
		return ok
	}, 100*time.Millisecond, time.Millisecond, "unexpected account %s", code)
}

func TestDiscoverySignalsAreScopedAndIndependentOfFrontendEvents(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	t.Cleanup(func() { require.NoError(t, backend.Close()) })
	backend.registerKeystore(makeBitBox02Multi())
	account := backend.Accounts().lookup("v0-55555555-btc-0").Account

	// Keep workers disabled so their input channels can be inspected directly.
	btcWake, ltcWake, otherWalletWake := make(chan struct{}, 1), make(chan struct{}, 1), make(chan struct{}, 1)
	unlock := backend.accountDiscoveryLock.Lock()
	backend.accountDiscovery[hex.EncodeToString(rootFingerprint1)].wake = map[coinpkg.Code]chan struct{}{
		coinpkg.CodeBTC: btcWake,
		coinpkg.CodeLTC: ltcWake,
	}
	backend.accountDiscovery[hex.EncodeToString(rootFingerprint2)] = &accountDiscovery{
		cancel: func() {},
		wake:   map[coinpkg.Code]chan struct{}{coinpkg.CodeBTC: otherWalletWake},
	}
	unlock()

	account.(*accountsMocks.InterfaceMock).NotifierFunc = func() accounts.Notifier { return nil }
	syncDone := func() {
		backend.handleAccountRegistryEvent(observable.Event{
			Subject: string(accountsTypes.EventSyncDone),
			Object:  accountmanager.Event{Account: account},
		})
	}
	// Sync completion directly wakes the matching worker, even inside a lifecycle callback.
	unlock = backend.accountsAndKeystoreLock.Lock()
	syncDone()
	unlock()
	require.Len(t, btcWake, 1)
	require.Empty(t, ltcWake)
	require.Empty(t, otherWalletWake)
	require.False(t, accountsSnapshot(t, backend).Lookup(account.Config().Code).Used)
	<-btcWake

	backend.emitAccountsStatusChanged()
	backend.Notify(observable.Event{Subject: "account/v0-55555555-btc-0/statusChanged"})
	require.Empty(t, btcWake)
	require.Empty(t, ltcWake)
	require.Empty(t, otherWalletWake)

	// New account membership is an explicit wakeup even before that account finishes syncing.
	_, err := backend.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "Second account", backend.keystore)
	require.NoError(t, err)
	require.Len(t, btcWake, 1)
	require.Empty(t, ltcWake)
	require.Empty(t, otherWalletWake)

	// Repeated signals are coalesced and never block the caller.
	syncDone()
	require.Len(t, btcWake, 1)
}

func TestDiscoveryChecksWatchOnlyUsageOnConnect(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02Multi()
	h.registerKeystore(ks)
	require.NoError(t, h.SetWatchonly(rootFingerprint1, true))
	h.DeregisterKeystore()
	h.discoveryWorkers.Wait()

	btcAccount := h.account(t, "v0-55555555-btc-0")
	btcAccount.finish(true)
	ethAccount := h.account(t, "v0-55555555-eth-0")
	ethAccount.finish(true)
	require.Zero(t, btcAccount.reads.Load())
	require.Zero(t, ethAccount.reads.Load())
	require.False(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-0").Used)
	h.noAccount(t, "v0-55555555-btc-1")

	// Starting discovery checks already-synced accounts without needing another sync event.
	h.registerKeystore(ks)
	h.account(t, "v0-55555555-btc-1")
	require.EqualValues(t, 1, btcAccount.reads.Load())
	require.True(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-0").Used)
	require.False(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-eth-0").Used)
	require.Zero(t, ethAccount.reads.Load())
	h.noAccount(t, "v0-55555555-eth-1")
}

func TestDiscoveryHistoryReadDoesNotBlockLifecycleOrPublishStaleResults(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.registerKeystore(makeBitBox02Multi())
	account := h.Accounts().lookup("v0-55555555-btc-0").Account.(*accountsMocks.InterfaceMock)
	state := h.account(t, "v0-55555555-btc-0")
	reading, release, checked := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	t.Cleanup(unblock)
	account.TransactionsFunc = func() (accounts.OrderedTransactions, error) {
		state.reads.Add(1)
		close(reading)
		<-release
		close(checked)
		return nil, nil
	}
	state.finish(false)
	select {
	case <-reading:
	case <-time.After(time.Second):
		t.Fatal("usage checking did not start")
	}
	// Further syncs queue a pass without starting overlapping history reads.
	state.finish(false)
	state.finish(false)
	require.EqualValues(t, 1, state.reads.Load())

	listed := make(chan struct{})
	go func() {
		h.Accounts()
		close(listed)
	}()
	select {
	case <-listed:
	case <-time.After(time.Second):
		t.Fatal("account listing blocked on a history read")
	}
	h.account(t, "v0-55555555-ltc-0").finish(false)
	h.account(t, "v0-55555555-ltc-1")

	cleared := make(chan error, 1)
	go func() { cleared <- h.ClearCache() }()
	select {
	case err := <-cleared:
		require.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("cache reset blocked on a history read")
	}
	require.True(t, state.closed.Load())
	unblock()
	select {
	case <-checked:
	case <-time.After(time.Second):
		t.Fatal("usage checking did not finish")
	}
	h.noAccount(t, "v0-55555555-btc-1")

	// The old runtime's successful empty check must not count for the replacement account.
	h.account(t, "v0-55555555-btc-0").finish(false)
	h.account(t, "v0-55555555-btc-1")
}

type blockedUsageUpdateDB struct {
	accountsDB
	armed            atomic.Bool
	entered, release chan struct{}
}

func (db *blockedUsageUpdateDB) Update(update func(*config.AccountsConfig) error) error {
	if db.armed.CompareAndSwap(true, false) {
		// Pause after the history read has finished, before taking the config lock.
		close(db.entered)
		<-db.release
	}
	return db.accountsDB.Update(update)
}

func TestDiscoveryWakesForUsagePersistedByReplacedAccount(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.tstDisableAccountDiscovery = true
	ks := makeBitBox02BTCOnly()
	h.registerKeystore(ks)
	old := h.Accounts().lookup("v0-55555555-btc-0").Account
	state := h.account(t, old.Config().Code)
	state.synced.Store(true)
	state.used.Store(true)

	db := &blockedUsageUpdateDB{
		accountsDB: h.accountsDB,
		entered:    make(chan struct{}),
		release:    make(chan struct{}),
	}
	db.armed.Store(true)
	h.accountsDB = db
	var once sync.Once
	unblock := func() { once.Do(func() { close(db.release) }) }
	t.Cleanup(unblock)
	unlock := h.accountsAndKeystoreLock.Lock()
	h.tstDisableAccountDiscovery = false
	h.startAccountDiscoveryLocked(ks)
	unlock()
	select {
	case <-db.entered:
	case <-time.After(time.Second):
		t.Fatal("usage checking did not reach persistence")
	}

	require.NoError(t, h.ClearCache())
	require.True(t, state.closed.Load())
	h.noAccount(t, "v0-55555555-btc-1")
	unblock()
	// The persisted usage must resume discovery even though the new runtime has not synced.
	h.account(t, "v0-55555555-btc-1")
	require.True(t, accountsSnapshot(t, h.Backend).Lookup(old.Config().Code).Used)
}

func TestDiscoveryScansSequentiallyWhileAccountsSyncIndependently(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02Multi()
	h.registerKeystore(ks)
	h.noAccount(t, "v0-55555555-btc-1")
	h.account(t, "v0-55555555-btc-0").finish(false)
	first := h.account(t, "v0-55555555-btc-1")
	h.noAccount(t, "v0-55555555-btc-2")
	h.noAccount(t, "v0-55555555-ltc-1")

	// One coin waiting for a hidden scan does not block the other coin.
	h.account(t, "v0-55555555-ltc-0").finish(false)
	h.account(t, "v0-55555555-ltc-1")

	// A sync notification with an unreadable history is not an empty account.
	first.fail.Store(true)
	first.finish(false)
	h.noAccount(t, "v0-55555555-btc-2")
	first.fail.Store(false)
	first.finish(false)
	second := h.account(t, "v0-55555555-btc-2")

	// Manually activate both hidden accounts, then create a new visible one while the second
	// scan is waiting. The visible account loads immediately, independently of the worker.
	for number := 1; number <= 3; number++ {
		code, err := h.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "Manually added", ks)
		require.NoError(t, err)
		require.Equal(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-btc-%d", number)), code)
	}
	visible := h.account(t, "v0-55555555-btc-3")
	second.finish(false)
	h.noAccount(t, "v0-55555555-btc-4")
	visible.finish(false)
	h.account(t, "v0-55555555-btc-4")
	record := accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-2")
	require.False(t, record.HiddenBecauseUnused)
	require.Equal(t, "Manually added", record.Name)
}

func TestDiscoveryUnhidesLaterAccountsWhileEarlierAccountNotReady(t *testing.T) {
	for _, failure := range []string{"syncing", "history error", "fatal sync error"} {
		t.Run(failure, func(t *testing.T) {
			h := newDiscoveryTestBackend(t)
			h.tstDisableAccountDiscovery = true
			ks := makeBitBox02BTCOnly()
			h.registerKeystore(ks)
			unlock := h.accountsAndKeystoreLock.Lock()
			err := h.createDiscoveryAccountLocked(ks, coinpkg.CodeBTC, 1)
			unlock()
			require.NoError(t, err)

			first := h.account(t, "v0-55555555-btc-0")
			first.synced.Store(failure != "syncing")
			first.fail.Store(failure == "history error")
			first.fatal.Store(failure == "fatal sync error")
			h.account(t, "v0-55555555-btc-1").finish(true)
			unlock = h.accountsAndKeystoreLock.Lock()
			h.tstDisableAccountDiscovery = false
			h.startAccountDiscoveryLocked(ks)
			unlock()

			require.Eventually(t, func() bool {
				record := accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-1")
				return record.Used && !record.HiddenBecauseUnused
			}, time.Second, time.Millisecond)
			h.noAccount(t, "v0-55555555-btc-2")

			first.fail.Store(false)
			first.fatal.Store(false)
			first.finish(false)
			h.account(t, "v0-55555555-btc-2")
		})
	}
}

func TestDiscoveryWaitsForAccountAddedDuringHistoryRead(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02BTCOnly()
	h.registerKeystore(ks)
	account := h.Accounts().lookup("v0-55555555-btc-0").Account.(*accountsMocks.InterfaceMock)
	reading, release := make(chan struct{}), make(chan struct{})
	var readOnce, releaseOnce sync.Once
	unblock := func() { releaseOnce.Do(func() { close(release) }) }
	t.Cleanup(unblock)
	account.TransactionsFunc = func() (accounts.OrderedTransactions, error) {
		readOnce.Do(func() { close(reading) })
		<-release
		return nil, nil
	}
	h.account(t, "v0-55555555-btc-0").finish(false)
	select {
	case <-reading:
	case <-time.After(time.Second):
		t.Fatal("usage checking did not start")
	}

	// Account creation and sync can proceed while the worker is reading another account.
	code, err := h.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "Manually added", ks)
	require.NoError(t, err)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-1"), code)
	added := h.account(t, code)
	unblock()
	h.noAccount(t, "v0-55555555-btc-2")
	added.finish(false)
	h.account(t, "v0-55555555-btc-2")
}

func TestDiscoveryRetainsSuccessfulChecksAfterLaterSyncFailure(t *testing.T) {
	for _, failure := range []string{"syncing", "history error", "fatal sync error"} {
		t.Run(failure, func(t *testing.T) {
			h := newDiscoveryTestBackend(t)
			h.registerKeystore(makeBitBox02BTCOnly())
			first := h.account(t, "v0-55555555-btc-0")
			first.finish(false)
			second := h.account(t, "v0-55555555-btc-1")

			first.synced.Store(failure != "syncing")
			first.fail.Store(failure == "history error")
			first.fatal.Store(failure == "fatal sync error")
			second.finish(false)
			h.account(t, "v0-55555555-btc-2")
		})
	}
}

func TestDiscoveryRetainsSuccessfulCheckDuringSyncStateChange(t *testing.T) {
	for _, change := range []string{"resync", "fatal error"} {
		t.Run(change, func(t *testing.T) {
			h := newDiscoveryTestBackend(t)
			h.tstDisableAccountDiscovery = true
			ks := makeBitBox02BTCOnly()
			h.registerKeystore(ks)
			account := h.Accounts().lookup("v0-55555555-btc-0").Account.(*accountsMocks.InterfaceMock)
			state := h.account(t, "v0-55555555-btc-0")
			account.TransactionsFunc = func() (accounts.OrderedTransactions, error) {
				// Sync state can change after the history read succeeds, before the worker
				// records its result. That does not invalidate the successful empty check.
				state.synced.Store(change != "resync")
				state.fatal.Store(change == "fatal error")
				return nil, nil
			}
			state.finish(false)
			checked := map[accounts.Interface]bool{}
			require.NoError(t, h.advanceAccountDiscovery(context.Background(), ks, coinpkg.CodeBTC, rootFingerprint1, checked))
			require.NotNil(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-1"))

			// The successful check must also remain usable on the next pass while the first
			// account is still unready or has a fatal error.
			h.account(t, "v0-55555555-btc-1").finish(false)
			require.NoError(t, h.advanceAccountDiscovery(context.Background(), ks, coinpkg.CodeBTC, rootFingerprint1, checked))
			require.NotNil(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-2"))
			require.Len(t, account.TransactionsCalls(), 1)
		})
	}
}

func TestDiscoveryWaitsAtUnusedBoundaryAndResumesOnUsage(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.registerKeystore(makeBitBox02Multi())
	for number := 0; number < accountsHardLimit(coinpkg.CodeBTC); number++ {
		h.account(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-btc-%d", number))).finish(false)
	}
	h.noAccount(t, "v0-55555555-btc-6")
	h.noAccount(t, "v0-55555555-ltc-1")
	h.noAccount(t, "v0-55555555-eth-1")
	for number := 0; number < accountsHardLimit(coinpkg.CodeBTC); number++ {
		account := h.account(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-btc-%d", number)))
		require.Positive(t, account.reads.Load(), "discovery must check all synced accounts")
	}
	h.account(t, "v0-55555555-btc-5").finish(true)
	h.account(t, "v0-55555555-btc-6").finish(false)
	h.noAccount(t, "v0-55555555-btc-7")
	record := accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-5")
	require.True(t, record.Used)
	require.False(t, record.HiddenBecauseUnused)
	require.GreaterOrEqual(t, h.account(t, "v0-55555555-btc-5").reads.Load(), int32(2))
}

func TestDiscoveryAdvancesPastKnownUsedAccount(t *testing.T) {
	for _, test := range []struct {
		name   string
		synced bool
		fatal  bool
	}{
		{name: "not synced"},
		{name: "fatal sync error", synced: true, fatal: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			h := newDiscoveryTestBackend(t)
			h.registerKeystore(makeBitBox02Multi())
			first := h.account(t, "v0-55555555-btc-0")
			first.fatal.Store(test.fatal)
			first.synced.Store(test.synced)
			h.noAccount(t, "v0-55555555-btc-1")

			// Another usage check can establish that this account is used while discovery waits.
			require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
				cfg.Lookup("v0-55555555-btc-0").Used = true
				cfg.Lookup("v0-55555555-btc-0").HiddenBecauseUnused = true
				return nil
			}))
			h.wakeAccountDiscovery(h.Accounts().lookup("v0-55555555-btc-0").Account)
			h.account(t, "v0-55555555-btc-1")
			require.Zero(t, first.reads.Load(), "persisted usage does not require another history read")
			require.False(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-0").HiddenBecauseUnused)
		})
	}
}

func TestDiscoveryStartsWithKnownUsageWithoutWaitingForSync(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.tstDisableAccountDiscovery = true
	ks := makeBitBox02Multi()
	h.registerKeystore(ks)
	require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
		record := cfg.Lookup("v0-55555555-btc-0")
		record.Used = true
		record.HiddenBecauseUnused = true
		return nil
	}))
	unlock := h.accountsAndKeystoreLock.Lock()
	h.tstDisableAccountDiscovery = false
	h.startAccountDiscoveryLocked(ks)
	unlock()
	h.account(t, "v0-55555555-btc-1")
	require.Zero(t, h.account(t, "v0-55555555-btc-0").reads.Load())
	require.False(t, accountsSnapshot(t, h.Backend).Lookup("v0-55555555-btc-0").HiddenBecauseUnused)
}

func TestDiscoveryReselectsAfterAccountIsUnloaded(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02Multi()
	_, record, err := h.accountBuilder.Build(coinpkg.CodeBTC, 0, false, "Taproot", ks, nil)
	require.NoError(t, err)
	index := record.SigningConfigurations.FindScriptType(signing.ScriptTypeP2TR)
	require.NotEqual(t, -1, index)
	record.SigningConfigurations = signing.Configurations{record.SigningConfigurations[index]}
	require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
		cfg.GetOrAddKeystore(rootFingerprint1).Watchonly = true
		return h.persistAccount(*record, cfg)
	}))
	// This persisted account is available only through watch-only mode on a device whose
	// firmware supports Bitcoin but not taproot. Its other Bitcoin script types remain supported.
	supportsAccount := ks.SupportsAccountFunc
	ks.SupportsAccountFunc = func(coin coinpkg.Coin, meta interface{}) bool {
		return meta != signing.ScriptTypeP2TR && supportsAccount(coin, meta)
	}
	h.registerKeystore(ks)
	first := h.account(t, "v0-55555555-btc-0")
	h.noAccount(t, "v0-55555555-btc-1")

	require.NoError(t, h.SetWatchonly(rootFingerprint1, false))
	require.True(t, first.closed.Load())
	h.account(t, "v0-55555555-btc-1").finish(false)
	h.account(t, "v0-55555555-btc-2")
}

func TestDiscoveryWaitsForPersistedAccountsAndCancelsOnDisconnect(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02Multi()
	// Persist in reverse order to check that discovery waits for every loaded account.
	for _, number := range []uint16{2, 1} {
		_, record, err := h.accountBuilder.Build(coinpkg.CodeBTC, number, true, "", ks, nil)
		require.NoError(t, err)
		require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
			return h.persistAccount(*record, cfg)
		}))
	}
	// Add visible defaults explicitly, as registering a wallet with existing records does not
	// create them automatically.
	defaults, err := h.buildDefaultAccountConfigs(ks)
	require.NoError(t, err)
	for _, record := range defaults {
		require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
			return h.persistAccount(record, cfg)
		}))
	}
	h.registerKeystore(ks)
	require.NoError(t, h.SetWatchonly(rootFingerprint1, true))
	first := h.account(t, "v0-55555555-btc-1")
	second := h.account(t, "v0-55555555-btc-2")
	// Existing runtime accounts sync independently. Discovery checks the later account even
	// while the earlier account is still syncing, but waits for both before adding another.
	second.finish(false)
	h.account(t, "v0-55555555-btc-0").finish(false)
	require.Eventually(t, func() bool { return second.reads.Load() > 0 }, time.Second, time.Millisecond)
	h.noAccount(t, "v0-55555555-btc-3")

	h.DeregisterKeystore()
	h.discoveryWorkers.Wait()
	require.True(t, first.closed.Load())
	first.finish(false)
	h.noAccount(t, "v0-55555555-btc-3")
	require.Len(t, h.Accounts(), 3)

	h.registerKeystore(ks)
	require.Eventually(t, func() bool {
		value, ok := h.created.Load(accountsTypes.Code("v0-55555555-btc-1"))
		return ok && value != first
	}, 5*time.Second, time.Millisecond)
	second = h.account(t, "v0-55555555-btc-2")
	second.finish(false)
	h.noAccount(t, "v0-55555555-btc-3")
	h.account(t, "v0-55555555-btc-1").finish(false)
	h.account(t, "v0-55555555-btc-3")
	require.Positive(t, second.reads.Load())
}

func TestDiscoveryLoadsPersistedAccountsWhileEarlierAccountSyncs(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.tstDisableAccountDiscovery = true
	ks := makeBitBox02Multi()
	h.registerKeystore(ks)
	// These records still need to be loaded, while account zero is already syncing.
	for _, number := range []uint16{2, 1} {
		_, record, err := h.accountBuilder.Build(coinpkg.CodeBTC, number, true, "", ks, nil)
		require.NoError(t, err)
		require.NoError(t, h.accountsDB.Update(func(cfg *config.AccountsConfig) error {
			return h.persistAccount(*record, cfg)
		}))
	}

	err := h.advanceAccountDiscovery(context.Background(), ks, coinpkg.CodeBTC, rootFingerprint1, map[accounts.Interface]bool{})
	require.NoError(t, err)
	// Every persisted account is loaded without waiting for account zero's sync to finish.
	for number := 0; number <= 2; number++ {
		account := h.account(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-btc-%d", number)))
		require.Zero(t, account.reads.Load())
	}
	_, created := h.created.Load(accountsTypes.Code("v0-55555555-btc-3"))
	require.False(t, created, "discovery must wait for the loaded accounts' usage checks")
}

func TestDiscoveryRestartsAfterClearCacheAndStopsOnClose(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.registerKeystore(makeBitBox02Multi())
	h.account(t, "v0-55555555-btc-0").finish(false)
	first := h.account(t, "v0-55555555-btc-1")
	require.NoError(t, h.ClearCache())
	require.True(t, first.closed.Load())
	first.finish(false)
	h.noAccount(t, "v0-55555555-btc-2")
	h.account(t, "v0-55555555-btc-0").finish(false)
	require.Eventually(t, func() bool {
		value, ok := h.created.Load(accountsTypes.Code("v0-55555555-btc-1"))
		return ok && value != first
	}, 5*time.Second, time.Millisecond)
	h.close()
	h.noAccount(t, "v0-55555555-btc-2")
}

type discoveryTestDeviceInfo struct {
	transport io.ReadWriteCloser
}

func (discoveryTestDeviceInfo) IsBluetooth() bool { return false }
func (discoveryTestDeviceInfo) VendorID() int     { return 0x03eb }
func (discoveryTestDeviceInfo) ProductID() int    { return 0x2403 }
func (discoveryTestDeviceInfo) UsagePage() int    { return 0xffff }
func (discoveryTestDeviceInfo) Interface() int    { return 0 }
func (discoveryTestDeviceInfo) Serial() string    { return "v9.24.0" }
func (discoveryTestDeviceInfo) Product() string   { return "BitBox02BTC" }
func (discoveryTestDeviceInfo) Identifier() string {
	return "discovery-test-device"
}
func (info discoveryTestDeviceInfo) Open() (io.ReadWriteCloser, error) {
	return info.transport, nil
}

func TestDiscoveryCloseUnblocksHardwareRequest(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	transport, peer := net.Pipe()
	registered := make(chan struct{})
	releaseRegistration := make(chan struct{})
	t.Cleanup(func() {
		// Also release the request if shutdown failed, so teardown cannot hang.
		_ = transport.Close()
		_ = peer.Close()
		h.close()
		close(releaseRegistration)
	})
	h.usbManager = usb.NewManager(t.TempDir(),
		func() []usb.DeviceInfo { return []usb.DeviceInfo{discoveryTestDeviceInfo{transport}} },
		func(device.Interface) error {
			close(registered)
			// Keep device registration stable while testing shutdown.
			<-releaseRegistration
			return nil
		},
		func(string) { h.DeregisterKeystore() },
	)
	h.usbManager.Start()
	select {
	case <-registered:
	case <-time.After(5 * time.Second):
		t.Fatal("device was not registered")
	}

	ks := makeBitBox02BTCOnly()
	requestStarted := make(chan struct{})
	var once sync.Once
	derive := ks.BTCXPubsFunc
	ks.BTCXPubsFunc = func(coin coinpkg.Coin, paths []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error) {
		if paths[0].ToUInt32()[2] == hdkeychain.HardenedKeyStart+1 {
			once.Do(func() { close(requestStarted) })
			// A pending device request must be interrupted by closing the transport.
			var response [1]byte
			_, err := peer.Read(response[:])
			return nil, err
		}
		return derive(coin, paths)
	}
	h.registerKeystore(ks)
	h.account(t, "v0-55555555-btc-0").finish(false)
	select {
	case <-requestStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("discovery did not request the next account's xpubs")
	}

	closed := make(chan struct{})
	go func() {
		h.close()
		close(closed)
	}()
	select {
	case <-closed:
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown did not close the transport to unblock discovery")
	}
	require.True(t, h.closed)
	require.Empty(t, h.accountDiscovery)
}

func TestDiscoveryFollowsReplacementKeystore(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.registerKeystore(makeBitBox02Multi())
	h.account(t, "v0-55555555-btc-0").finish(false)
	first := h.account(t, "v0-55555555-btc-1")

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) { return rootFingerprint2, nil }
	ks.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
	ks.BTCXPubsFunc = keystoreHelper2().BTCXPubs
	h.registerKeystore(ks)
	require.True(t, first.closed.Load())
	first.finish(false)
	h.noAccount(t, "v0-55555555-btc-2")
	h.noAccount(t, "v0-66666666-btc-1")
	h.account(t, "v0-66666666-btc-0").finish(false)
	h.account(t, "v0-66666666-btc-1")
}

func TestDiscoveryIsScopedToKeystoreFingerprint(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	firstKeystore := makeBitBox02Multi()
	secondKeystore := makeBitBox02Multi()
	secondKeystore.RootFingerprintFunc = func() ([]byte, error) { return rootFingerprint2, nil }
	secondKeystore.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
	secondKeystore.BTCXPubsFunc = keystoreHelper2().BTCXPubs

	// Start both sets of workers without a global backend keystore. Each worker must derive and
	// load accounts using the keystore it was given.
	unlock := h.accountsAndKeystoreLock.Lock()
	h.startAccountDiscoveryLocked(firstKeystore)
	h.startAccountDiscoveryLocked(secondKeystore)
	unlock()
	h.account(t, "v0-55555555-btc-0").finish(false)
	h.account(t, "v0-66666666-btc-0").finish(false)
	first := h.account(t, "v0-55555555-btc-1")
	second := h.account(t, "v0-66666666-btc-1")

	// Restarting one fingerprint must replace its workers and leave the other workers running.
	unlock = h.accountsAndKeystoreLock.Lock()
	h.startAccountDiscoveryLocked(firstKeystore)
	unlock()
	first.finish(false)
	second.finish(false)
	first = h.account(t, "v0-55555555-btc-2")
	second = h.account(t, "v0-66666666-btc-2")

	unlock = h.accountsAndKeystoreLock.Lock()
	h.stopAccountDiscoveryLocked(rootFingerprint1)
	h.stopAccountDiscoveryLocked(rootFingerprint1) // Stopping twice is harmless.
	unlock()
	first.finish(false)
	second.finish(false)
	h.noAccount(t, "v0-55555555-btc-3")
	h.account(t, "v0-66666666-btc-3")
}

func TestDiscoveryDisconnectUsesRegisteredFingerprint(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	ks := makeBitBox02Multi()
	var disconnected atomic.Bool
	ks.RootFingerprintFunc = func() ([]byte, error) {
		if disconnected.Load() {
			return nil, errors.New("device disconnected")
		}
		return rootFingerprint1, nil
	}
	h.registerKeystore(ks)
	disconnected.Store(true)
	h.DeregisterKeystore()
	h.discoveryWorkers.Wait()
	require.Empty(t, h.accountDiscovery)
	require.Empty(t, h.Accounts())
}

type discoverySnapshotFailure struct {
	accountsDB
	persisted bool
}

func (db *discoverySnapshotFailure) Snapshot() (config.AccountsConfig, error) {
	if db.persisted {
		db.persisted = false
		return config.AccountsConfig{}, errors.New("snapshot unavailable")
	}
	return db.accountsDB.Snapshot()
}

func (db *discoverySnapshotFailure) Update(update func(*config.AccountsConfig) error) error {
	if err := db.accountsDB.Update(update); err != nil {
		return err
	}
	db.persisted = true
	return nil
}

func TestDiscoveryRetriesAccountPersistedBeforeSnapshotFailure(t *testing.T) {
	h := newDiscoveryTestBackend(t)
	h.tstDisableAccountDiscovery = true
	h.registerKeystore(makeBitBox02Multi())
	h.account(t, "v0-55555555-btc-0").finish(false)
	h.accountsDB = &discoverySnapshotFailure{accountsDB: h.accountsDB}
	err := h.advanceAccountDiscovery(context.Background(), h.keystore, coinpkg.CodeBTC, rootFingerprint1, map[accounts.Interface]bool{})
	require.Error(t, err)
	err = h.advanceAccountDiscovery(context.Background(), h.keystore, coinpkg.CodeBTC, rootFingerprint1, map[accounts.Interface]bool{})
	require.NoError(t, err)
	var loaded bool
	for _, account := range h.accounts.Accounts() {
		if account.Config().Code == "v0-55555555-btc-1" {
			loaded = true
		}
	}
	require.True(t, loaded)
	snapshot, err := h.accountsDB.Snapshot()
	require.NoError(t, err)
	require.Nil(t, snapshot.Lookup("v0-55555555-btc-2"), "the loaded account still needs a usage check")
}
