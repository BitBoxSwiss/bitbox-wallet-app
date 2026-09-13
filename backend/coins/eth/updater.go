// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/ethereum/go-ethereum/common"
	"github.com/sirupsen/logrus"
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
		blockTipHeight *big.Int,
		address common.Address,
		endBlock *big.Int,
	) (map[common.Address][]*accounts.TransactionData, error)
}

// Updater is a struct that takes care of updating ETH accounts.
type Updater struct {
	// quit is used to indicate to running goroutines that they should stop as the backend is being closed
	quit   chan struct{}
	mu     sync.Mutex
	closed bool

	// updateETHAccountsCh is used to trigger an update of all ETH accounts.
	updateETHAccountsCh chan struct{}

	log *logrus.Entry

	// updateAccounts is a function that updates all ETH accounts.
	updateAccounts func() error
}

// NewUpdater creates a new Updater instance.
func NewUpdater(
	accountUpdate chan struct{},
	updateETHAccounts func() error,
) *Updater {
	return &Updater{
		quit:                make(chan struct{}),
		updateETHAccountsCh: accountUpdate,
		updateAccounts:      updateETHAccounts,
		log:                 logging.Get().WithGroup("ethupdater"),
	}
}

// Close closes the updater and its channels.
func (u *Updater) Close() {
	u.mu.Lock()
	if !u.closed {
		u.closed = true
		close(u.quit)
	}
	u.mu.Unlock()
}

// EnqueueUpdateForAllAccounts enqueues an update for all ETH accounts.
func (u *Updater) EnqueueUpdateForAllAccounts() {
	select {
	case u.updateETHAccountsCh <- struct{}{}:
	case <-u.quit:
	default:
	}
}

// PollBalances updates the balances of all ETH accounts.
// It does that in two different cases:
// - When a timer triggers the update.
// - When an update is requested through updateETHAccountsCh.
func (u *Updater) PollBalances() {
	timer := time.After(0)

	for {
		select {
		case <-u.quit:
			return
		default:
			select {
			case <-u.quit:
				return
			case <-u.updateETHAccountsCh:
			case <-timer:
			}
			u.runUpdate()
			timer = time.After(pollInterval)
		}
	}

}

func (u *Updater) runUpdate() {
	u.mu.Lock()
	defer u.mu.Unlock()
	if !u.closed {
		if err := u.updateAccounts(); err != nil {
			u.log.WithError(err).Error("could not update ETH accounts")
		}
	}
}

// UpdateBalancesAndBlockNumber updates the balances of the accounts in the provided slice.
func (u *Updater) UpdateBalancesAndBlockNumber(ethAccounts []*Account, etherScanClient BalanceAndBlockNumberFetcher) {
	if len(ethAccounts) == 0 {
		return
	}
	chainId := ethAccounts[0].ETHCoin().ChainID()
	for _, account := range ethAccounts {
		if account.ETHCoin().ChainID() != chainId {
			u.log.Error("Cannot update balances and block number for accounts with different chain IDs")
			return
		}
	}

	ethNonErc20Addresses := make([]common.Address, 0, len(ethAccounts))
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

	reconciled := make(map[senderKey]error)
	for _, account := range ethAccounts {
		if account.isClosed() || !account.isInitialized() {
			continue
		}
		key := senderKey{account.coin.ChainID(), account.address.Address}
		if _, exists := reconciled[key]; !exists {
			reconciled[key] = account.updateOutgoingTransactions(blockNumber.Uint64())
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
		if err := reconciled[senderKey{account.coin.ChainID(), account.address.Address}]; err != nil {
			account.SetOffline(err)
			continue
		}
		account.SetOffline(nil)
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
