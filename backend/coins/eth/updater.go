// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/ethereum/go-ethereum/common"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

// pollInterval is the interval at which the account is polled for updates.
var pollInterval = 5 * time.Minute

// BalanceAndBlockNumberFetcher is an interface that defines a method to fetch balances for a list of addresses,
// as well as the block number for a chain.
//
//go:generate moq -pkg mocks -out mocks/balanceandblocknumberfetcher.go . BalanceAndBlockNumberFetcher
type BalanceAndBlockNumberFetcher interface {
	// Balances returns the balances for a list of addresses.
	Balances(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error)
	// BlockNumber returns the current latest block number.
	BlockNumber(ctx context.Context) (*big.Int, error)
}

// TokenTransactionsFetcher can prefetch token transactions for an address.
//
//go:generate moq -pkg mocks -out mocks/tokentransactionsfetcher.go . TokenTransactionsFetcher
type TokenTransactionsFetcher interface {
	BalanceAndBlockNumberFetcher
	TokenTransactionsByContract(
		ctx context.Context,
		blockTipHeight *big.Int,
		address common.Address,
		startBlock, endBlock *big.Int,
	) (map[common.Address][]*accounts.TransactionData, *big.Int, error)
}

type tipEntry struct {
	tip       *big.Int
	fetchedAt time.Time
}

// Updater is a struct that takes care of updating ETH accounts.
type Updater struct {
	// quit is used to indicate to running goroutines that they should stop as the backend is being closed
	quit chan struct{}

	// enqueueUpdateForAccount is used to enqueue an update for a specific ETH account.
	enqueueUpdateForAccount <-chan *Account

	// updateETHAccountsCh is used to trigger an update of all ETH accounts.
	updateETHAccountsCh chan struct{}

	log *logrus.Entry

	// Timings for the PollBalances coalescing loop. Defaults are set in NewUpdater; tests override
	// them via TstSetTimings.
	pollInterval    time.Duration
	sweepDebounce   time.Duration
	accountDebounce time.Duration
	tipTTL          time.Duration

	etherscanClient      *http.Client
	etherscanRateLimiter *rate.Limiter

	// updateAccounts is a function that updates all ETH accounts.
	updateAccounts func() error
	// listETHAccounts returns all loaded ETH accounts. Backend-provided; it takes backend locks, so
	// it (and expandBatch, which calls it) must only run in spawned worker goroutines, never in the
	// PollBalances select loop.
	listETHAccounts func() []*Account
	// makeFetcher builds a fetcher for a chain. Defaults to etherscan.NewEtherScan; injectable in
	// tests.
	makeFetcher func(chainID string) BalanceAndBlockNumberFetcher

	// tipCache briefly caches the chain tip so a poll and a concurrent single-account enqueue do not
	// both fetch it.
	tipCache struct {
		sync.Mutex
		byChain map[string]tipEntry
	}
}

// NewUpdater creates a new Updater instance.
func NewUpdater(
	accountUpdate chan *Account,
	etherscanClient *http.Client,
	etherscanRateLimiter *rate.Limiter,
	updateETHAccounts func() error,
	listETHAccounts func() []*Account,
) *Updater {
	u := &Updater{
		quit:                    make(chan struct{}),
		enqueueUpdateForAccount: accountUpdate,
		updateETHAccountsCh:     make(chan struct{}),
		etherscanClient:         etherscanClient,
		etherscanRateLimiter:    etherscanRateLimiter,
		updateAccounts:          updateETHAccounts,
		listETHAccounts:         listETHAccounts,
		log:                     logging.Get().WithGroup("ethupdater"),
		pollInterval:            pollInterval,
		sweepDebounce:           300 * time.Millisecond,
		accountDebounce:         250 * time.Millisecond,
		tipTTL:                  10 * time.Second,
	}
	u.tipCache.byChain = map[string]tipEntry{}
	u.makeFetcher = func(chainID string) BalanceAndBlockNumberFetcher {
		return etherscan.NewEtherScan(chainID, u.etherscanClient, u.etherscanRateLimiter)
	}
	return u
}

// TstSetTimings overrides the poll/debounce/tip-ttl intervals for unit tests.
func (u *Updater) TstSetTimings(poll, sweepDebounce, accountDebounce, tipTTL time.Duration) {
	u.pollInterval = poll
	u.sweepDebounce = sweepDebounce
	u.accountDebounce = accountDebounce
	u.tipTTL = tipTTL
}

// TstSetMakeFetcher overrides the fetcher factory for unit tests.
func (u *Updater) TstSetMakeFetcher(makeFetcher func(chainID string) BalanceAndBlockNumberFetcher) {
	u.makeFetcher = makeFetcher
}

// Close closes the updater and its channels.
func (u *Updater) Close() {
	close(u.quit)
}

// EnqueueUpdateForAllAccounts enqueues an update for all ETH accounts.
func (u *Updater) EnqueueUpdateForAllAccounts() {
	select {
	case u.updateETHAccountsCh <- struct{}{}:
	case <-u.quit:
	}
}

// EnqueueUpdateForAllAccountsAsync enqueues an update for all ETH accounts without blocking the
// caller. This is useful when accounts are loaded while backend locks are held, as the update path
// reads the backend account list.
func (u *Updater) EnqueueUpdateForAllAccountsAsync() {
	go u.EnqueueUpdateForAllAccounts()
}

// PollBalances updates the balances of all ETH accounts. It coalesces the three trigger sources —
// the poll timer, the all-accounts channel, and single-account enqueues — so bursts do not spawn
// concurrent full sweeps.
//
// INVARIANT: this loop must never acquire accountsAndKeystoreLock, directly or transitively
// (backend.Accounts() takes it). All actual work — updateAccounts, expandBatch/listETHAccounts and
// UpdateBalancesAndBlockNumber — runs in spawned goroutines. This keeps the loop always
// receive-ready, so EnqueueUpdate never blocks a caller holding backend locks or a user-facing
// request (SendTx). All coalescing state below is confined to this single goroutine — no mutexes.
func (u *Updater) PollBalances() {
	var (
		sweepRunning      bool                     // in-flight guard
		sweepPending      bool                     // dirty bit: a trigger arrived mid-sweep
		sweepDone         = make(chan struct{}, 1) // buffered so the sweep goroutine never blocks
		sweepDebounceCh   <-chan time.Time         // nil = no sweep scheduled
		pendingAccounts   = map[*Account]struct{}{}
		accountDebounceCh <-chan time.Time // nil = no batch scheduled
		pollTimerCh       = time.After(0)
	)
	startSweep := func() {
		sweepRunning = true
		go func() {
			if err := u.updateAccounts(); err != nil {
				u.log.WithError(err).Error("could not update ETH accounts")
			}
			sweepDone <- struct{}{}
		}()
	}
	requestSweep := func() {
		// Next poll fires pollInterval after the last trigger (today's semantics).
		pollTimerCh = time.After(u.pollInterval)
		switch {
		case sweepRunning:
			sweepPending = true
		case sweepDebounceCh == nil:
			sweepDebounceCh = time.After(u.sweepDebounce)
		} // else: a debounce is already armed — coalesce.
	}
	for {
		select {
		case <-u.quit:
			return
		case account := <-u.enqueueUpdateForAccount:
			if sweepDebounceCh != nil || (sweepRunning && sweepPending) {
				// A full sweep is guaranteed to start strictly later and will cover this account.
				break
			}
			pendingAccounts[account] = struct{}{}
			if accountDebounceCh == nil {
				accountDebounceCh = time.After(u.accountDebounce)
			}
		case <-u.updateETHAccountsCh:
			requestSweep()
		case <-pollTimerCh:
			requestSweep()
		case <-sweepDebounceCh:
			sweepDebounceCh = nil
			// A full sweep subsumes any pending single-account work.
			pendingAccounts = map[*Account]struct{}{}
			accountDebounceCh = nil
			startSweep()
		case <-sweepDone:
			sweepRunning = false
			if sweepPending {
				sweepPending = false
				sweepDebounceCh = time.After(u.sweepDebounce)
			}
		case <-accountDebounceCh:
			accountDebounceCh = nil
			pending := pendingAccounts
			pendingAccounts = map[*Account]struct{}{}
			go func() {
				// expandBatch touches backend.Accounts() — must run off the loop (see invariant).
				for chainID, accts := range u.expandBatch(pending) {
					u.UpdateBalancesAndBlockNumber(accts, u.makeFetcher(chainID))
				}
			}()
		}
	}
}

// expandBatch groups the pending accounts by chain ID and folds in the parent ETH account for each
// ERC20 account (same chain and address, non-ERC20, loaded, not closed), so that a post-send token
// refresh also refreshes the parent's gas balance. It calls listETHAccounts, which takes backend
// locks, so it must only run in a worker goroutine.
func (u *Updater) expandBatch(pending map[*Account]struct{}) map[string][]*Account {
	byChain := map[string][]*Account{}
	seen := map[*Account]struct{}{}
	add := func(acct *Account) {
		if acct.isClosed() {
			return
		}
		if _, ok := seen[acct]; ok {
			return
		}
		seen[acct] = struct{}{}
		chainID := acct.ETHCoin().ChainIDstr()
		byChain[chainID] = append(byChain[chainID], acct)
	}

	var allAccounts []*Account // fetched lazily, only if a token account is pending
	for acct := range pending {
		add(acct)
		if !IsERC20(acct) {
			continue
		}
		address, err := acct.Address()
		if err != nil {
			continue
		}
		if allAccounts == nil {
			allAccounts = u.listETHAccounts()
		}
		for _, candidate := range allAccounts {
			if candidate.isClosed() || IsERC20(candidate) {
				continue
			}
			if candidate.ETHCoin().ChainIDstr() != acct.ETHCoin().ChainIDstr() {
				continue
			}
			candidateAddress, err := candidate.Address()
			if err != nil {
				continue
			}
			if candidateAddress.Address == address.Address {
				add(candidate)
			}
		}
	}
	return byChain
}

// blockNumber returns the chain tip, serving a cached value if it was fetched less than tipTTL ago
// and fetching (and caching) it otherwise. The returned value is a copy, safe for callers to store.
func (u *Updater) blockNumber(
	ctx context.Context, chainID string, fetcher BalanceAndBlockNumberFetcher) (*big.Int, error) {
	u.tipCache.Lock()
	if entry, ok := u.tipCache.byChain[chainID]; ok && time.Since(entry.fetchedAt) < u.tipTTL {
		tip := new(big.Int).Set(entry.tip)
		u.tipCache.Unlock()
		return tip, nil
	}
	u.tipCache.Unlock()

	tip, err := fetcher.BlockNumber(ctx)
	if err != nil {
		return nil, err
	}
	u.tipCache.Lock()
	u.tipCache.byChain[chainID] = tipEntry{tip: new(big.Int).Set(tip), fetchedAt: time.Now()}
	u.tipCache.Unlock()
	return tip, nil
}

// UpdateBalancesAndBlockNumber updates the balances of the accounts in the provided slice.
func (u *Updater) UpdateBalancesAndBlockNumber(ethAccounts []*Account, fetcher BalanceAndBlockNumberFetcher) {
	if len(ethAccounts) == 0 {
		return
	}
	chainID := ethAccounts[0].ETHCoin().ChainIDstr()
	for _, account := range ethAccounts {
		if account.ETHCoin().ChainIDstr() != chainID {
			u.log.Error("Cannot update balances and block number for accounts with different chain IDs")
			return
		}
	}

	// Determine which accounts this sweep will actually touch (skip closed/inactive), collecting the
	// non-ERC20 addresses for the batched balance call along the way.
	survivors := make([]*Account, 0, len(ethAccounts))
	ethNonErc20Addresses := make([]common.Address, 0, len(ethAccounts))
	for _, account := range ethAccounts {
		if account.isClosed() || account.isInactive() {
			continue
		}
		survivors = append(survivors, account)
		if IsERC20(account) {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Config.Code)
			account.SetOffline(err)
			continue
		}
		ethNonErc20Addresses = append(ethNonErc20Addresses, address.Address)
	}
	// No active account: spend zero etherscan calls (closes the "deactivate everything still costs a
	// tip call per poll" gap).
	if len(survivors) == 0 {
		return
	}

	// Fetch the tip first (briefly cached) and abort before spending balancemulti on failure, so the
	// accounts keep their previous state rather than paying a call whose result gets discarded.
	blockNumber, err := u.blockNumber(context.TODO(), chainID, fetcher)
	if err != nil {
		u.log.WithError(err).Error("Could not get block number")
		return
	}

	updateNonERC20 := true
	balances, err := fetcher.Balances(context.TODO(), ethNonErc20Addresses)
	if err != nil {
		u.log.WithError(err).Error("Could not get balances for ETH accounts")
		updateNonERC20 = false
	}

	prefetchedTokenTxsByAccount := map[*Account][]*accounts.TransactionData{}
	if tokenFetcher, ok := fetcher.(TokenTransactionsFetcher); ok {
		prefetchedTokenTxsByAccount = u.prefetchTokenTransactions(survivors, tokenFetcher, blockNumber)
	}

	for _, account := range survivors {
		if account.isClosed() || account.isInactive() {
			continue
		}
		var iterationErr error
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Config.Code)
			account.SetOffline(err)
			iterationErr = err
		}
		var balance *big.Int
		if iterationErr == nil {
			switch {
			case IsERC20(account):
				var err error
				balance, err = account.coin.client.ERC20Balance(account.address.Address, account.coin.erc20Token)
				if err != nil {
					u.log.WithError(err).Errorf("Could not get ERC20 balance for address %s", address.Address.Hex())
					account.SetOffline(err)
					iterationErr = err
				}
			case updateNonERC20:
				var ok bool
				balance, ok = balances[address.Address]
				if !ok {
					errMsg := fmt.Sprintf("Could not find balance for address %s", address.Address.Hex())
					u.log.Error(errMsg)
					offlineErr := errp.Newf(errMsg)
					account.SetOffline(offlineErr)
					iterationErr = offlineErr
				}
			default:
				// If we get there, this is a non-erc20 account and we failed getting balances.
				// If we couldn't get the balances for non-erc20 accounts, we mark them as offline
				errMsg := fmt.Sprintf("Could not get balance for address %s", address.Address.Hex())
				u.log.Error(errMsg)
				offlineErr := errp.Newf(errMsg)
				account.SetOffline(offlineErr)
				iterationErr = offlineErr
			}
		}

		// Gate on this sweep's own failure, not the persistent account.Offline() flag: an account
		// that went offline in a previous sweep but fetched successfully now must reach
		// account.Update and the SetOffline(nil) below, otherwise it stays offline forever until a
		// ReinitializeAccounts.
		if iterationErr != nil {
			continue // Skip updating balance if this sweep failed for the account.
		}
		var confirmedTransactions []*accounts.TransactionData
		if prefetched, ok := prefetchedTokenTxsByAccount[account]; ok {
			// `nil` means "not prefetched"; use an explicit empty slice to mean "prefetched, no txs".
			if prefetched == nil {
				prefetched = []*accounts.TransactionData{}
			}
			confirmedTransactions = prefetched
		}
		if err := account.Update(balance, blockNumber, confirmedTransactions); err != nil {
			u.log.WithError(err).Errorf("Could not update balance for address %s", address.Address.Hex())
			account.SetOffline(err)
		} else {
			account.SetOffline(nil)
		}
	}
}

func (u *Updater) prefetchTokenTransactions(
	ethAccounts []*Account,
	etherScanClient TokenTransactionsFetcher,
	blockNumber *big.Int,
) map[*Account][]*accounts.TransactionData {
	tokenAccountsByAddress := map[common.Address][]*Account{}
	for _, account := range ethAccounts {
		if account.isClosed() || account.isInactive() || !IsERC20(account) {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Config.Code)
			account.SetOffline(err)
			continue
		}
		tokenAccountsByAddress[address.Address] = append(tokenAccountsByAddress[address.Address], account)
	}

	if len(tokenAccountsByAddress) == 0 {
		return nil
	}

	prefetched := map[*Account][]*accounts.TransactionData{}
	for address, tokenAccounts := range tokenAccountsByAddress {
		// Prefetch only when we can amortize a full-address scan across multiple token accounts
		// for the same address. Otherwise, let account.Update() use contract-filtered tokentx calls.
		if len(tokenAccounts) < 2 {
			continue
		}
		transactionsByContract, truncatedBelow, err := etherScanClient.TokenTransactionsByContract(
			context.TODO(),
			blockNumber,
			address,
			big.NewInt(0),
			blockNumber,
		)
		if err != nil {
			u.log.WithError(err).Errorf("Could not get token transactions for address %s", address.Hex())
			continue
		}
		if truncatedBelow != nil {
			u.log.Errorf("token transaction history for address %s is truncated below block %s", address.Hex(), truncatedBelow)
		}
		for _, account := range tokenAccounts {
			contractAddress := account.coin.erc20Token.ContractAddress()
			prefetched[account] = transactionsByContract[contractAddress]
		}
	}
	return prefetched
}
