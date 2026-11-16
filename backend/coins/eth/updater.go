// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/ethereum/go-ethereum/common"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

// pollInterval is the interval at which the account is polled for updates.
var pollInterval = 5 * time.Minute

var activeProbeInterval = time.Minute
var activeProbeLeaseDuration = 90 * time.Second
var activeProbeRetryDelay = 30 * time.Second
var activeProbeBackoffDuration = 5 * time.Minute

// BalanceAndBlockNumberFetcher fetches native and ERC20 balances together with the block number they belong to.
//
//go:generate moq -pkg mocks -out mocks/balanceandblocknumberfetcher.go . BalanceAndBlockNumberFetcher
type BalanceAndBlockNumberFetcher interface {
	// BalancesSnapshot returns the latest block number with the native balances of addresses and the
	// ERC20 balances of {token contract, holder} pairs at that block. Unreadable balances are omitted.
	BalancesSnapshot(
		ctx context.Context,
		addresses []common.Address,
		tokenHolders [][2]common.Address,
	) (*big.Int, map[common.Address]*big.Int, map[[2]common.Address]*big.Int, error)
}

// TokenTransactionsFetcher can prefetch token transactions for an address.
//
//go:generate moq -pkg mocks -out mocks/tokentransactionsfetcher.go . TokenTransactionsFetcher
type TokenTransactionsFetcher interface {
	BalanceAndBlockNumberFetcher
	TokenTransactionsByContract(
		blockTipHeight *big.Int,
		address common.Address,
		endBlock *big.Int,
	) (map[common.Address][]*accounts.TransactionData, error)
}

// Updater is a struct that takes care of updating ETH accounts.
type Updater struct {
	// quit is used to indicate to running goroutines that they should stop as the backend is being closed
	quit chan struct{}

	// enqueueUpdateForAccount is used to enqueue an update for a specific ETH account.
	enqueueUpdateForAccount chan *Account

	// updateETHAccountsCh is used to trigger an update of all ETH accounts.
	updateETHAccountsCh chan struct{}

	log *logrus.Entry

	etherscanClient      *http.Client
	etherscanRateLimiter *rate.Limiter

	// updateAccounts is a function that updates all ETH accounts.
	updateAccounts func() error

	activeAccountsLock      locker.Locker
	activeAccountLeases     map[*Account]time.Time
	activeProbeBackoffUntil time.Time
	timeNow                 func() time.Time
}

// NewUpdater creates a new Updater instance.
func NewUpdater(
	accountUpdate chan struct{},
	etherscanClient *http.Client,
	etherscanRateLimiter *rate.Limiter,
	updateETHAccounts func() error,
) *Updater {
	return &Updater{
		quit:                    make(chan struct{}),
		enqueueUpdateForAccount: make(chan *Account),
		updateETHAccountsCh:     accountUpdate,
		etherscanClient:         etherscanClient,
		etherscanRateLimiter:    etherscanRateLimiter,
		updateAccounts:          updateETHAccounts,
		log:                     logging.Get().WithGroup("ethupdater"),
		activeAccountLeases:     map[*Account]time.Time{},
		timeNow:                 time.Now,
	}
}

// Close closes the updater and its channels.
func (u *Updater) Close() {
	close(u.quit)
}

// EnqueueUpdateForAllAccounts enqueues an update for all ETH accounts.
func (u *Updater) EnqueueUpdateForAllAccounts() {
	select {
	case u.updateETHAccountsCh <- struct{}{}:
	default:
	}
}

// SetAccountActivity refreshes or clears the foreground activity lease for an ETH account.
func (u *Updater) SetAccountActivity(account *Account, active bool) {
	if account == nil {
		return
	}
	defer u.activeAccountsLock.Lock()()
	if !active || account.isClosed() {
		delete(u.activeAccountLeases, account)
		return
	}
	u.activeAccountLeases[account] = u.timeNow().Add(activeProbeLeaseDuration)
}

func (u *Updater) activeAccounts() []*Account {
	defer u.activeAccountsLock.Lock()()
	now := u.timeNow()
	accounts := []*Account{}
	for account, expiresAt := range u.activeAccountLeases {
		if !expiresAt.After(now) || account.isClosed() {
			delete(u.activeAccountLeases, account)
			continue
		}
		accounts = append(accounts, account)
	}
	return accounts
}

func (u *Updater) activeProbeBackoffActive() bool {
	defer u.activeAccountsLock.RLock()()
	return u.timeNow().Before(u.activeProbeBackoffUntil)
}

func (u *Updater) setActiveProbeBackoff() {
	defer u.activeAccountsLock.Lock()()
	u.activeProbeBackoffUntil = u.timeNow().Add(activeProbeBackoffDuration)
}

func (u *Updater) scheduleAccountUpdate(account *Account, delay time.Duration) {
	go func() {
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-u.quit:
			return
		case <-timer.C:
		}
		select {
		case <-u.quit:
		case u.enqueueUpdateForAccount <- account:
		}
	}()
}

func (u *Updater) probeActiveAccounts() {
	if u.activeProbeBackoffActive() {
		return
	}
	accountsByChainID := map[string][]*Account{}
	for _, account := range u.activeAccounts() {
		chainID := account.ETHCoin().ChainIDstr()
		accountsByChainID[chainID] = append(accountsByChainID[chainID], account)
	}
	for chainID, ethAccounts := range accountsByChainID {
		etherScanClient := etherscan.NewEtherScan(chainID, u.etherscanClient, u.etherscanRateLimiter)
		u.probeActiveAccountBalances(ethAccounts, etherScanClient)
	}
}

// PollBalances keeps ETH account balances and block heights up to date.
// It does that in four different cases:
// - When a timer triggers an update of all accounts.
// - When the signal to update all accounts is sent through updateETHAccountsCh.
// - When a specific account is updated through enqueueUpdateForAccount.
// - When foreground activity triggers a cheap active-account balance probe.
func (u *Updater) PollBalances() {
	timer := time.After(0)
	activeProbeTimer := time.After(activeProbeInterval)
	retryDelay := activeProbeRetryDelay

	for {
		select {
		case <-u.quit:
			return
		default:
			select {
			case <-u.quit:
				return
			case account := <-u.enqueueUpdateForAccount:
				etherScanClient := etherscan.NewEtherScan(account.ETHCoin().ChainIDstr(), u.etherscanClient, u.etherscanRateLimiter)
				_ = u.UpdateBalancesAndBlockNumber([]*Account{account}, etherScanClient)
				continue
			case <-u.updateETHAccountsCh:
			case <-timer:
			case <-activeProbeTimer:
				u.probeActiveAccounts()
				activeProbeTimer = time.After(activeProbeInterval)
				continue
			}
			if err := u.updateAccounts(); err != nil {
				timer = time.After(retryDelay)
				retryDelay = min(2*retryDelay, pollInterval)
			} else {
				retryDelay = activeProbeRetryDelay
				timer = time.After(pollInterval)
			}
		}
	}

}

func (account *Account) remoteBalance() *big.Int {
	defer account.updateLock.RLock()()
	return account.rawBalance.BigInt()
}

func (u *Updater) probeActiveAccountBalances(
	ethAccounts []*Account,
	etherScanClient BalanceAndBlockNumberFetcher,
) {
	if len(ethAccounts) == 0 || u.activeProbeBackoffActive() {
		return
	}

	probedAccounts := []*Account{}
	addresses := []common.Address{}
	tokenHolders := [][2]common.Address{}
	for _, account := range ethAccounts {
		if account.isClosed() {
			u.SetAccountActivity(account, false)
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Code)
			continue
		}
		probedAccounts = append(probedAccounts, account)
		if IsERC20(account) {
			tokenHolders = append(tokenHolders, [2]common.Address{account.coin.erc20Token.ContractAddress(), address.Address})
		} else {
			addresses = append(addresses, address.Address)
		}
	}
	if len(probedAccounts) == 0 {
		return
	}

	_, balances, tokenBalances, err := etherScanClient.BalancesSnapshot(context.TODO(), addresses, tokenHolders)
	if err != nil {
		u.log.WithError(err).Error("Could not probe ETH account balances")
		u.setActiveProbeBackoff()
		return
	}
	changedAccounts := []*Account{}
	for _, account := range probedAccounts {
		var balance *big.Int
		var ok bool
		if IsERC20(account) {
			balance, ok = tokenBalances[[2]common.Address{account.coin.erc20Token.ContractAddress(), account.address.Address}]
		} else {
			balance, ok = balances[account.address.Address]
		}
		if !ok {
			u.log.Errorf("Could not find probed balance for address %s", account.address.Address.Hex())
			continue
		}
		if account.remoteBalance().Cmp(balance) != 0 {
			changedAccounts = append(changedAccounts, account)
		}
	}

	if len(changedAccounts) == 0 {
		return
	}
	// The probe only reads balances, the full update also refreshes the transactions.
	_ = u.UpdateBalancesAndBlockNumber(changedAccounts, etherScanClient)
}

// UpdateBalancesAndBlockNumber updates the balances of the accounts in the provided slice.
// It returns an error if the block number and balances could not be read, in which case no account
// was updated.
func (u *Updater) UpdateBalancesAndBlockNumber(ethAccounts []*Account, etherScanClient BalanceAndBlockNumberFetcher) error {
	if len(ethAccounts) == 0 {
		return nil
	}
	chainId := ethAccounts[0].ETHCoin().ChainID()
	for _, account := range ethAccounts {
		if account.ETHCoin().ChainID() != chainId {
			u.log.Error("Cannot update balances and block number for accounts with different chain IDs")
			return nil
		}
	}

	ethNonErc20Addresses := make([]common.Address, 0, len(ethAccounts))
	tokenHolders := [][2]common.Address{}
	for _, account := range ethAccounts {
		if account.isClosed() {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Code)
			account.SetOffline(err)
			continue
		}
		if IsERC20(account) {
			tokenHolders = append(tokenHolders, [2]common.Address{account.coin.erc20Token.ContractAddress(), address.Address})
		} else {
			ethNonErc20Addresses = append(ethNonErc20Addresses, address.Address)
		}
	}

	blockNumber, balances, tokenBalances, err := etherScanClient.BalancesSnapshot(context.TODO(), ethNonErc20Addresses, tokenHolders)
	if err != nil {
		u.log.WithError(err).Error("Could not get block number and balances")
		return err
	}

	reconciled := make(map[senderKey]error)
	outgoingRecords := make(map[senderKey][]*ethtypes.TransactionWithMetadata)
	for _, account := range ethAccounts {
		if account.isClosed() || !account.isInitialized() {
			continue
		}
		key := senderKey{account.coin.ChainID(), account.address.Address}
		if _, exists := reconciled[key]; !exists {
			outgoingRecords[key], reconciled[key] = account.updateOutgoingTransactions(blockNumber.Uint64())
		}
	}

	prefetchedTokenTxsByAccount := map[*Account][]*accounts.TransactionData{}
	if fetcher, ok := etherScanClient.(TokenTransactionsFetcher); ok {
		prefetchedTokenTxsByAccount = u.prefetchTokenTransactions(ethAccounts, fetcher, blockNumber)
	}

	for _, account := range ethAccounts {
		if account.isClosed() {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Code)
			account.SetOffline(err)
		}
		key := senderKey{account.coin.ChainID(), account.address.Address}
		if err := reconciled[key]; err != nil {
			account.SetOffline(err)
			continue
		}
		account.SetOffline(nil)
		var balance *big.Int
		var ok bool
		if IsERC20(account) {
			balance, ok = tokenBalances[[2]common.Address{account.coin.erc20Token.ContractAddress(), address.Address}]
		} else {
			balance, ok = balances[address.Address]
		}
		if !ok {
			errMsg := fmt.Sprintf("Could not find balance for address %s", address.Address.Hex())
			u.log.Error(errMsg)
			account.SetOffline(errp.Newf(errMsg))
		}

		if account.Offline() != nil {
			continue // Skip updating balance if the account is offline.
		}
		var confirmedTransactions []*accounts.TransactionData
		if prefetched, ok := prefetchedTokenTxsByAccount[account]; ok {
			// `nil` means "not prefetched"; use an explicit empty slice to mean "prefetched, no txs".
			if prefetched == nil {
				prefetched = []*accounts.TransactionData{}
			}
			confirmedTransactions = prefetched
		}
		wasSynced, previousBalance := account.Synced(), account.remoteBalance()
		if err := account.Update(balance, blockNumber, confirmedTransactions, outgoingRecords[key]); err != nil {
			u.log.WithError(err).Errorf("Could not update balance for address %s", address.Address.Hex())
			account.SetOffline(err)
		} else {
			account.SetOffline(nil)
			// Etherscan can report a new balance before indexing its transaction.
			if wasSynced && previousBalance.Cmp(balance) != 0 {
				u.scheduleAccountUpdate(account, activeProbeRetryDelay)
			}
		}
	}
	return nil
}

func (u *Updater) prefetchTokenTransactions(
	ethAccounts []*Account,
	etherScanClient TokenTransactionsFetcher,
	blockNumber *big.Int,
) map[*Account][]*accounts.TransactionData {
	tokenAccountsByAddress := map[common.Address][]*Account{}
	for _, account := range ethAccounts {
		if account.isClosed() || !IsERC20(account) {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Code)
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
		transactionsByContract, err := etherScanClient.TokenTransactionsByContract(
			blockNumber,
			address,
			blockNumber,
		)
		if err != nil {
			u.log.WithError(err).Errorf("Could not get token transactions for address %s", address.Hex())
			continue
		}
		for _, account := range tokenAccounts {
			contractAddress := account.coin.erc20Token.ContractAddress()
			prefetched[account] = transactionsByContract[contractAddress]
		}
	}
	return prefetched
}
