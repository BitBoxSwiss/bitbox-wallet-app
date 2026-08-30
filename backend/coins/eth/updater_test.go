// SPDX-License-Identifier: Apache-2.0

package eth_test

import (
	"context"
	"math/big"
	"net/http"
	"os"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/mocks"
	rpcclientmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

type noopNotifier struct{}

func (noopNotifier) Put(id []byte) error { return nil }
func (noopNotifier) Delete(id []byte) error {
	return nil
}
func (noopNotifier) UnnotifiedCount() (int, error) { return 0, nil }
func (noopNotifier) MarkAllNotified() error        { return nil }

type transactionsSourceMock struct {
	calls int
	txs   []*accounts.TransactionData
}

func (m *transactionsSourceMock) Transactions(
	ctx context.Context,
	blockTipHeight *big.Int,
	address common.Address,
	startBlock, endBlock *big.Int,
	erc20Token *erc20.Token,
) ([]*accounts.TransactionData, *big.Int, error) {
	m.calls++
	return m.txs, nil, nil
}

func newAccount(t *testing.T, erc20Token *erc20.Token, erc20error bool) *eth.Account {
	t.Helper()

	log := logging.Get().WithGroup("updater_test")
	dbFolder := test.TstTempDir("eth-dbfolder")
	defer func() { _ = os.RemoveAll(dbFolder) }()

	net := &chaincfg.TestNet3Params

	keypath, err := signing.NewAbsoluteKeypath("m/60'/1'/0'/0")
	require.NoError(t, err)
	seed := make([]byte, 32)
	if erc20Token != nil {
		// For ERC20 tokens, we use a different seed to ensure the final address is
		// different.
		// We need this because in the test we check which addresses are passed to the
		// balanceFetcher, but if the seed is the same, a test case in which we
		// have both erc20 and non-erc20 accounts would have the same addresses.
		for i := range seed {
			seed[i] = byte(i + 1) // just something deterministic
		}
	}
	xpub, err := hdkeychain.NewMaster(seed, net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{signing.NewEthereumConfiguration(
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}
	client := &rpcclientmocks.InterfaceMock{
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
		ERC20BalanceFunc: func(address common.Address, token *erc20.Token) (*big.Int, error) {
			if erc20error {
				return nil, errp.New("failed to fetch ERC20 balance")
			}
			return big.NewInt(1e16), nil // Mock balance for ERC20 token
		},
	}

	coin := eth.NewCoin(client, coin.CodeSEPETH, "Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig, "", nil, erc20Token)
	acct := eth.NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: signingConfigurations,
			},
			GetNotifier: func(signing.Configurations) accounts.Notifier { return noopNotifier{} },
			DBFolder:    dbFolder,
		},
		coin,
		&http.Client{},
		log,
		make(chan *eth.Account),
	)

	require.NoError(t, acct.Initialize())
	require.NoError(t, acct.Update(big.NewInt(0), big.NewInt(100), nil))
	require.Eventually(t, acct.Synced, time.Second, time.Millisecond*200)
	return acct
}

func assertAccountBalance(t *testing.T, acct *eth.Account, expected *big.Int) {
	t.Helper()
	balance, err := acct.Balance()
	require.NoError(t, err)
	require.Equal(t, expected, balance.Available().BigInt())
}

func TestUpdateBalances(t *testing.T) {
	testCases := []struct {
		name             string
		accounts         []*eth.Account
		expectedBalances []*big.Int
		accountsToClose  []int
	}{
		{
			name:             "Single account - non erc20",
			accounts:         []*eth.Account{newAccount(t, nil, false)},
			expectedBalances: []*big.Int{big.NewInt(1000)},
		},
		{
			name:             "Single account - erc20",
			accounts:         []*eth.Account{newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false)},
			expectedBalances: []*big.Int{big.NewInt(1e16)},
		},
		{
			name: "Multiple accounts - one erc20",
			accounts: []*eth.Account{
				newAccount(t, nil, false),
				newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false),
			},
			expectedBalances: []*big.Int{big.NewInt(1000), big.NewInt(1e16)}, // 1e16 is the balance for the erc20 token
		},
		{
			name: "Multiple accounts - the nonerc20 account is closed",
			accounts: []*eth.Account{
				newAccount(t, nil, false),
				newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false),
			},
			expectedBalances: []*big.Int{big.NewInt(1000), big.NewInt(1e16)},
			accountsToClose:  []int{0},
		},
	}

	updatedBalances := []common.Address{}
	balanceFetcher := mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			updatedBalances = addresses
			// We mock the balanceFetcher to always return a balance of 1000.
			balances := make(map[common.Address]*big.Int)
			for _, address := range addresses {
				balances[address] = big.NewInt(1000)
			}
			return balances, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			for _, acct := range tc.accounts {
				defer acct.Close()
			}
			for _, idx := range tc.accountsToClose {
				tc.accounts[idx].Close()
			}

			updater.UpdateBalancesAndBlockNumber(tc.accounts, &balanceFetcher)

			for i, acct := range tc.accounts {
				accountWasClosed := slices.Contains(tc.accountsToClose, i)
				address, err := acct.Address()
				require.NoError(t, err)
				if accountWasClosed {
					// If the account was closed, it must not have its balance updated.
					require.NotContains(t, updatedBalances, address.Address)
					continue
				}
				assertAccountBalance(t, acct, tc.expectedBalances[i])
				if eth.IsERC20(acct) {
					// ERC20 accounts should not have their balances updated by the balanceFetcher
					// since they have their own balance fetching logic.
					require.NotContains(t, updatedBalances, address.Address)
				} else {
					// Non-closed, non-erc20 accounts should have their balances updated
					// by the balanceFetcher.
					require.Contains(t, updatedBalances, address.Address)
				}
			}
		})
	}

}

func TestUpdateBalancesWithError(t *testing.T) {
	balanceFetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			// We mock the balanceFetcher to always return an error.
			// This simulates a failure in fetching balances which should set the account to offline.
			return nil, errp.New("balance fetch error")
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	account := newAccount(t, nil, false)
	defer account.Close()

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.Error(t, account.Offline())

	// We create an ERC20 account and pass "true" to the "erc20error" parameter to simulate an error.
	// This way we expect the account to be set offline as well.
	erc20Account := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), true)
	defer erc20Account.Close()

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{erc20Account}, balanceFetcher)
	require.Error(t, erc20Account.Offline())

}

func TestUpdateBalancesRecoversAfterTransientOffline(t *testing.T) {
	shouldFail := true
	balanceFetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			if shouldFail {
				return nil, errp.New("transient balance fetch error")
			}
			balances := make(map[common.Address]*big.Int)
			for _, address := range addresses {
				balances[address] = big.NewInt(1000)
			}
			return balances, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	account := newAccount(t, nil, false)
	defer account.Close()

	// First sweep fails: the account goes offline.
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.Error(t, account.Offline())

	// Second sweep succeeds: the account must recover. Before the iteration-local failure flag,
	// the gate read the persistent Offline() flag from the failed sweep, so the account stayed
	// offline forever (until a ReinitializeAccounts) even though the fetch now succeeds.
	shouldFail = false
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.NoError(t, account.Offline())
	assertAccountBalance(t, account, big.NewInt(1000))
}

func TestUpdateBalancesSkipsInactiveAccounts(t *testing.T) {
	updatedAddresses := []common.Address{}
	balanceFetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			updatedAddresses = addresses
			balances := make(map[common.Address]*big.Int)
			for _, address := range addresses {
				balances[address] = big.NewInt(1000)
			}
			return balances, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	account := newAccount(t, nil, false)
	defer account.Close()
	address, err := account.Address()
	require.NoError(t, err)

	// Inactive: the sweep must not fetch the account's balance.
	account.SetInactiveFlag(true)
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.NotContains(t, updatedAddresses, address.Address)

	// Re-activated: the sweep includes it again.
	account.SetInactiveFlag(false)
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.Contains(t, updatedAddresses, address.Address)
}

func TestPollBalancesCoalescesIdleTriggers(t *testing.T) {
	var sweeps atomic.Int32
	updater := eth.NewUpdater(make(chan *eth.Account), nil, nil, func() error {
		sweeps.Add(1)
		return nil
	}, func() []*eth.Account { return nil })
	// Long poll so only the initial poll + manual triggers matter; short debounce so the test is fast.
	updater.TstSetTimings(10*time.Second, 50*time.Millisecond, 50*time.Millisecond, time.Millisecond)
	go updater.PollBalances()
	defer updater.Close()

	// Several all-accounts triggers within the debounce window must coalesce with the initial poll
	// into a single sweep.
	for i := 0; i < 5; i++ {
		updater.EnqueueUpdateForAllAccounts()
	}

	require.Eventually(t, func() bool { return sweeps.Load() == 1 }, time.Second, 5*time.Millisecond)
	time.Sleep(150 * time.Millisecond) // ensure no extra sweep fires
	require.Equal(t, int32(1), sweeps.Load())
}

func TestPollBalancesCoalescesTriggersDuringSweep(t *testing.T) {
	var sweeps atomic.Int32
	started := make(chan struct{}, 10)
	release := make(chan struct{})
	updater := eth.NewUpdater(make(chan *eth.Account), nil, nil, func() error {
		sweeps.Add(1)
		started <- struct{}{}
		<-release // block so triggers arrive while this sweep is running
		return nil
	}, func() []*eth.Account { return nil })
	updater.TstSetTimings(10*time.Second, 20*time.Millisecond, 20*time.Millisecond, time.Millisecond)
	go updater.PollBalances()
	defer updater.Close()

	<-started // sweep 1 (from the initial poll) is now running

	// Many triggers while sweep 1 runs must collapse to exactly one follow-up sweep (dirty bit).
	for i := 0; i < 5; i++ {
		updater.EnqueueUpdateForAllAccounts()
	}
	close(release) // let sweep 1 finish (and sweep 2 not block)

	<-started // sweep 2 (the single coalesced follow-up)
	require.Eventually(t, func() bool { return sweeps.Load() == 2 }, time.Second, 5*time.Millisecond)
	time.Sleep(100 * time.Millisecond) // ensure no third sweep fires
	require.Equal(t, int32(2), sweeps.Load())
}

func TestUpdateBalancesEmptySurvivorsSpendsNoCalls(t *testing.T) {
	var balanceCalls, blockNumberCalls atomic.Int32
	fetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			balanceCalls.Add(1)
			return map[common.Address]*big.Int{}, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			blockNumberCalls.Add(1)
			return big.NewInt(100), nil
		},
	}
	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	account := newAccount(t, nil, false)
	defer account.Close()
	account.SetInactiveFlag(true) // no surviving account

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, fetcher)
	require.Equal(t, int32(0), balanceCalls.Load())
	require.Equal(t, int32(0), blockNumberCalls.Load())
}

func TestUpdateBalancesTipCacheDedupes(t *testing.T) {
	var blockNumberCalls atomic.Int32
	fetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			balances := make(map[common.Address]*big.Int)
			for _, address := range addresses {
				balances[address] = big.NewInt(1000)
			}
			return balances, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			blockNumberCalls.Add(1)
			return big.NewInt(100), nil
		},
	}
	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	updater.TstSetTimings(10*time.Second, 50*time.Millisecond, 50*time.Millisecond, 10*time.Second) // long tip TTL
	account := newAccount(t, nil, false)
	defer account.Close()

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, fetcher)
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, fetcher)
	// The second sweep serves the tip from the cache.
	require.Equal(t, int32(1), blockNumberCalls.Load())
}

func TestPollBalancesSingleAccountEnqueueBatches(t *testing.T) {
	account := newAccount(t, nil, false)
	defer account.Close()
	address, err := account.Address()
	require.NoError(t, err)

	var mu sync.Mutex
	var updatedAddresses []common.Address
	fetcher := &mocks.BalanceAndBlockNumberFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			mu.Lock()
			updatedAddresses = append(updatedAddresses, addresses...)
			mu.Unlock()
			balances := make(map[common.Address]*big.Int)
			for _, a := range addresses {
				balances[a] = big.NewInt(1000)
			}
			return balances, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(100), nil
		},
	}

	initialSweepDone := make(chan struct{}, 10)
	accountCh := make(chan *eth.Account, 1)
	updater := eth.NewUpdater(accountCh, nil, nil, func() error {
		initialSweepDone <- struct{}{}
		return nil
	}, func() []*eth.Account { return []*eth.Account{account} })
	updater.TstSetTimings(10*time.Second, 20*time.Millisecond, 20*time.Millisecond, time.Millisecond)
	updater.TstSetMakeFetcher(func(chainID string) eth.BalanceAndBlockNumberFetcher { return fetcher })
	go updater.PollBalances()
	defer updater.Close()

	<-initialSweepDone // wait out the initial poll's sweep so the enqueue is not subsumed by it

	accountCh <- account
	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return slices.Contains(updatedAddresses, address.Address)
	}, 2*time.Second, 10*time.Millisecond)
}

func makeConfirmedTx(id string) *accounts.TransactionData {
	amount := coin.NewAmountFromInt64(1)
	return &accounts.TransactionData{
		TxID:       id,
		InternalID: id,
		Amount:     amount,
		Addresses: []accounts.AddressAndAmount{{
			Address: "0x0000000000000000000000000000000000000000",
			Amount:  amount,
		}},
		Type:   accounts.TxTypeReceive,
		Status: accounts.TxStatusComplete,
		Height: 1,
	}
}

func TestUpdateBalancesPrefetchTokenTransactions(t *testing.T) {
	tokenA := erc20.NewToken("0x0000000000000000000000000000000000000001", 12)
	tokenB := erc20.NewToken("0x0000000000000000000000000000000000000002", 12)
	accountA := newAccount(t, tokenA, false)
	accountB := newAccount(t, tokenB, false)
	defer accountA.Close()
	defer accountB.Close()

	addrA, err := accountA.Address()
	require.NoError(t, err)
	addrB, err := accountB.Address()
	require.NoError(t, err)
	require.Equal(t, addrA.Address, addrB.Address)

	txSource := &transactionsSourceMock{}
	accountA.ETHCoin().TstSetTransactionsSource(txSource)
	accountB.ETHCoin().TstSetTransactionsSource(txSource)

	blockNumber := big.NewInt(100)
	tokenTxCalls := 0
	fetcher := &mocks.TokenTransactionsFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			require.Len(t, addresses, 0)
			return map[common.Address]*big.Int{}, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return blockNumber, nil
		},
		TokenTransactionsByContractFunc: func(
			ctx context.Context,
			blockTipHeight *big.Int,
			address common.Address,
			startBlock, endBlock *big.Int,
		) (map[common.Address][]*accounts.TransactionData, *big.Int, error) {
			tokenTxCalls++
			require.Equal(t, blockNumber, blockTipHeight)
			require.Equal(t, blockNumber, endBlock)
			require.Equal(t, addrA.Address, address)
			return map[common.Address][]*accounts.TransactionData{
				tokenA.ContractAddress(): {makeConfirmedTx("tx-a")},
				tokenB.ContractAddress(): {makeConfirmedTx("tx-b")},
			}, nil, nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil, nil)
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{accountA, accountB}, fetcher)

	require.Equal(t, 1, tokenTxCalls)
	require.Equal(t, 0, txSource.calls)
}

func TestUpdateBalancesPrefetchNilVsEmptyFallback(t *testing.T) {
	blockNumber := big.NewInt(100)
	tokenTxCalls := 0
	var tokenTxResult map[common.Address][]*accounts.TransactionData
	fetcher := &mocks.TokenTransactionsFetcherMock{
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			require.Len(t, addresses, 0)
			return map[common.Address]*big.Int{}, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return blockNumber, nil
		},
		TokenTransactionsByContractFunc: func(
			ctx context.Context,
			blockTipHeight *big.Int,
			_ common.Address,
			startBlock, endBlock *big.Int,
		) (map[common.Address][]*accounts.TransactionData, *big.Int, error) {
			tokenTxCalls++
			require.Equal(t, blockNumber, blockTipHeight)
			require.Equal(t, blockNumber, endBlock)
			return tokenTxResult, nil, nil
		},
	}

	t.Run("no-prefetch-falls-back-to-nil", func(t *testing.T) {
		account := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false)
		defer account.Close()
		txSource := &transactionsSourceMock{}
		account.ETHCoin().TstSetTransactionsSource(txSource)

		tokenTxCalls = 0
		tokenTxResult = map[common.Address][]*accounts.TransactionData{}

		updater := eth.NewUpdater(nil, nil, nil, nil, nil)
		updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, fetcher)

		// With a single token account, updater should skip prefetch entirely.
		require.Equal(t, 0, tokenTxCalls)
		// No prefetch entry means Update receives nil and falls back once.
		require.Equal(t, 1, txSource.calls)
	})

	t.Run("missing-contract-is-empty-no-fallback", func(t *testing.T) {
		accountA := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false)
		accountB := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000002", 12), false)
		defer accountA.Close()
		defer accountB.Close()
		txSource := &transactionsSourceMock{}
		accountA.ETHCoin().TstSetTransactionsSource(txSource)
		accountB.ETHCoin().TstSetTransactionsSource(txSource)

		addrA, err := accountA.Address()
		require.NoError(t, err)
		addrB, err := accountB.Address()
		require.NoError(t, err)
		require.Equal(t, addrA.Address, addrB.Address)

		tokenTxCalls = 0
		tokenA := accountA.ETHCoin().ERC20Token()
		require.NotNil(t, tokenA)
		// Contract for accountB is intentionally missing. Updater should pass
		// explicit empty slice (not nil), which must not trigger fallback calls.
		tokenTxResult = map[common.Address][]*accounts.TransactionData{
			tokenA.ContractAddress(): {makeConfirmedTx("tx-a")},
		}

		updater := eth.NewUpdater(nil, nil, nil, nil, nil)
		updater.UpdateBalancesAndBlockNumber([]*eth.Account{accountA, accountB}, fetcher)

		require.Equal(t, 1, tokenTxCalls)
		require.Equal(t, 0, txSource.calls)
	})
}
