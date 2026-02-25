// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"time"

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

// Updater is a struct that takes care of updating ETH accounts.
type Updater struct {
	// quit is used to indicate to running goroutines that they should stop as the backend is being closed
	quit chan struct{}

	// enqueueUpdateForAccount is used to enqueue an update for a specific ETH account.
	enqueueUpdateForAccount <-chan *Account

	// updateETHAccountsCh is used to trigger an update of all ETH accounts.
	updateETHAccountsCh chan struct{}

	log *logrus.Entry

	etherscanClient      *http.Client
	etherscanRateLimiter *rate.Limiter

	// updateAccounts is a function that updates all ETH accounts.
	updateAccounts func() error
}

// NewUpdater creates a new Updater instance.
func NewUpdater(
	accountUpdate chan *Account,
	etherscanClient *http.Client,
	etherscanRateLimiter *rate.Limiter,
	updateETHAccounts func() error,
) *Updater {
	return &Updater{
		quit:                    make(chan struct{}),
		enqueueUpdateForAccount: accountUpdate,
		updateETHAccountsCh:     make(chan struct{}),
		etherscanClient:         etherscanClient,
		etherscanRateLimiter:    etherscanRateLimiter,
		updateAccounts:          updateETHAccounts,
		log:                     logging.Get().WithGroup("ethupdater"),
	}
}

// Close closes the updater and its channels.
func (u *Updater) Close() {
	close(u.quit)
}

// EnqueueUpdateForAllAccounts enqueues an update for all ETH accounts.
func (u *Updater) EnqueueUpdateForAllAccounts() {
	u.updateETHAccountsCh <- struct{}{}
}

func (u *Updater) updateAccountsForChain(chainID string, accounts []*Account) {
	if len(accounts) == 0 {
		return
	}
	etherScanClient := etherscan.NewEtherScan(chainID, u.etherscanClient, u.etherscanRateLimiter)
	u.UpdateBalancesAndBlockNumber(accounts, etherScanClient)
}

func resetTimer(timer *time.Timer, duration time.Duration) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(duration)
}

// PollBalances updates the balances of all ETH accounts.
// It does that in three different cases:
// - When a timer triggers the update.
// - When the signanl to update all accounts is sent through UpdateETHAccountsCh.
// - When a specific account is updated through EnqueueUpdateForAccount.
func (u *Updater) PollBalances() {
	timer := time.NewTimer(0)
	defer timer.Stop()

	// High-level flow:
	// 1) Collect global update triggers (timer/manual) into one pending flag.
	// 2) Run at most one global update at a time.
	// 3) Execute per-account updates immediately in their own goroutines.
	// 4) When a global run finishes, start one more only if new global triggers came in meanwhile.
	//
	// This keeps the call reduction from coalescing duplicate global triggers while
	// preserving per-account responsiveness.

	// Buffered so the worker goroutine can always signal completion once, even if the
	// poll loop has not reached the receive case yet.
	updateDoneCh := make(chan struct{}, 1)
	pendingAllAccountsUpdate := false
	globalUpdateRunning := false

	for {
		if pendingAllAccountsUpdate && !globalUpdateRunning {
			pendingAllAccountsUpdate = false
			globalUpdateRunning = true
			go func() {
				if u.updateAccounts != nil {
					if err := u.updateAccounts(); err != nil {
						u.log.WithError(err).Error("could not update ETH accounts")
					}
				}
				select {
				case updateDoneCh <- struct{}{}:
				default:
				}
			}()
		}

		select {
		case <-u.quit:
			return
		case <-timer.C:
			pendingAllAccountsUpdate = true
			resetTimer(timer, pollInterval)
		case <-u.updateETHAccountsCh:
			pendingAllAccountsUpdate = true
			resetTimer(timer, pollInterval)
		case account := <-u.enqueueUpdateForAccount:
			if account == nil {
				continue
			}
			go func(account *Account) {
				// A single ETH account needs an update.
				if account.isClosed() {
					return
				}
				etherScanClient := etherscan.NewEtherScan(account.ETHCoin().ChainIDstr(), u.etherscanClient, u.etherscanRateLimiter)
				u.UpdateBalancesAndBlockNumber([]*Account{account}, etherScanClient)
			}(account)
		case <-updateDoneCh:
			globalUpdateRunning = false
		}
	}

}

// UpdateBalancesAndBlockNumber updates the balances of the accounts in the provided slice.
func (u *Updater) UpdateBalancesAndBlockNumber(accounts []*Account, etherScanClient BalanceAndBlockNumberFetcher) {
	if len(accounts) == 0 {
		return
	}
	chainId := accounts[0].ETHCoin().ChainID()
	for _, account := range accounts {
		if account.ETHCoin().ChainID() != chainId {
			u.log.Error("Cannot update balances and block number for accounts with different chain IDs")
			return
		}
	}

	ethNonErc20Addresses := make([]common.Address, 0, len(accounts))
	for _, account := range accounts {
		if account.isClosed() {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Config.Code)
			account.SetOffline(err)
			continue
		}
		if !IsERC20(account) {
			ethNonErc20Addresses = append(ethNonErc20Addresses, address.Address)
		}
	}

	updateNonERC20 := true
	balances, err := etherScanClient.Balances(context.TODO(), ethNonErc20Addresses)
	if err != nil {
		u.log.WithError(err).Error("Could not get balances for ETH accounts")
		updateNonERC20 = false
	}

	blockNumber, err := etherScanClient.BlockNumber(context.TODO())
	if err != nil {
		u.log.WithError(err).Error("Could not get block number")
		return
	}

	for _, account := range accounts {
		if account.isClosed() {
			continue
		}
		address, err := account.Address()
		if err != nil {
			u.log.WithError(err).Errorf("Could not get address for account %s", account.Config().Config.Code)
			account.SetOffline(err)
		}
		var balance *big.Int
		switch {
		case IsERC20(account):
			var err error
			balance, err = account.coin.client.ERC20Balance(account.address.Address, account.coin.erc20Token)
			if err != nil {
				u.log.WithError(err).Errorf("Could not get ERC20 balance for address %s", address.Address.Hex())
				account.SetOffline(err)
			}
		case updateNonERC20:
			var ok bool
			balance, ok = balances[address.Address]
			if !ok {
				errMsg := fmt.Sprintf("Could not find balance for address %s", address.Address.Hex())
				u.log.Error(errMsg)
				account.SetOffline(errp.Newf(errMsg))
			}
		default:
			// If we get there, this is a non-erc20 account and we failed getting balances.
			// If we couldn't get the balances for non-erc20 accounts, we mark them as offline
			errMsg := fmt.Sprintf("Could not get balance for address %s", address.Address.Hex())
			u.log.Error(errMsg)
			account.SetOffline(errp.Newf(errMsg))
		}

		if account.Offline() != nil {
			continue // Skip updating balance if the account is offline.
		}
		if err := account.Update(balance, blockNumber); err != nil {
			u.log.WithError(err).Errorf("Could not update balance for address %s", address.Address.Hex())
			account.SetOffline(err)
		} else {
			account.SetOffline(nil)
		}
	}
}
