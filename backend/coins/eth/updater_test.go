// SPDX-License-Identifier: Apache-2.0

package eth_test

import (
	"context"
	"math/big"
	"os"
	"slices"
	"testing"
	"testing/synctest"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/mocks"
	rpcclientmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg/v2"
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
	blockTipHeight *big.Int,
	address common.Address,
	endBlock *big.Int,
	erc20Token *erc20.Token,
) ([]*accounts.TransactionData, error) {
	m.calls++
	return m.txs, nil
}

func newAccount(t *testing.T, erc20Token *erc20.Token) *eth.Account {
	t.Helper()

	log := logging.Get().WithGroup("updater_test")
	dbFolder := test.TstTempDir("eth-dbfolder")
	t.Cleanup(func() { _ = os.RemoveAll(dbFolder) })

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
	}

	coin := eth.NewCoin(client, coin.CodeSEPETH, "Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig, "", nil, erc20Token)
	outgoing, err := eth.NewOutgoingTransactions(dbFolder)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, outgoing.Close()) })
	acct := eth.NewAccount(
		&accounts.AccountConfig{
			Code:                  "accountcode",
			SigningConfigurations: signingConfigurations,
			GetNotifier:           func(signing.Configurations) accounts.Notifier { return noopNotifier{} },
			DBFolder:              dbFolder,
		},
		coin,
		outgoing,
		log,
		make(chan struct{}),
	)

	require.NoError(t, acct.Initialize())
	require.NoError(t, acct.Update(big.NewInt(0), big.NewInt(100), nil, nil))
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
			accounts:         []*eth.Account{newAccount(t, nil)},
			expectedBalances: []*big.Int{big.NewInt(1000)},
		},
		{
			name:             "Single account - erc20",
			accounts:         []*eth.Account{newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12))},
			expectedBalances: []*big.Int{big.NewInt(1e16)},
		},
		{
			name: "Multiple accounts - one erc20",
			accounts: []*eth.Account{
				newAccount(t, nil),
				newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12)),
			},
			expectedBalances: []*big.Int{big.NewInt(1000), big.NewInt(1e16)}, // 1e16 is the balance for the erc20 token
		},
		{
			name: "Multiple accounts - the nonerc20 account is closed",
			accounts: []*eth.Account{
				newAccount(t, nil),
				newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12)),
			},
			expectedBalances: []*big.Int{big.NewInt(1000), big.NewInt(1e16)},
			accountsToClose:  []int{0},
		},
	}

	updatedBalances := []common.Address{}
	updatedTokenHolders := [][2]common.Address{}
	balanceFetcher := mocks.BalanceAndBlockNumberFetcherMock{
		BalancesSnapshotFunc: func(
			ctx context.Context, addresses []common.Address, tokenHolders [][2]common.Address,
		) (*big.Int, map[common.Address]*big.Int, map[[2]common.Address]*big.Int, error) {
			updatedBalances = addresses
			updatedTokenHolders = tokenHolders
			balances := make(map[common.Address]*big.Int)
			for _, address := range addresses {
				balances[address] = big.NewInt(1000)
			}
			tokenBalances := make(map[[2]common.Address]*big.Int)
			for _, tokenHolder := range tokenHolders {
				tokenBalances[tokenHolder] = big.NewInt(1e16)
			}
			return big.NewInt(100), balances, tokenBalances, nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil)
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
				var tokenHolder [2]common.Address
				if eth.IsERC20(acct) {
					tokenHolder = [2]common.Address{acct.ETHCoin().ERC20Token().ContractAddress(), address.Address}
				}
				if accountWasClosed {
					// If the account was closed, it must not have its balance updated.
					require.NotContains(t, updatedBalances, address.Address)
					require.NotContains(t, updatedTokenHolders, tokenHolder)
					continue
				}
				assertAccountBalance(t, acct, tc.expectedBalances[i])
				if eth.IsERC20(acct) {
					// ERC20 balances are fetched per token contract, not as native balances.
					require.NotContains(t, updatedBalances, address.Address)
					require.Contains(t, updatedTokenHolders, tokenHolder)
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
		BalancesSnapshotFunc: func(
			ctx context.Context, addresses []common.Address, tokenHolders [][2]common.Address,
		) (*big.Int, map[common.Address]*big.Int, map[[2]common.Address]*big.Int, error) {
			// No balance could be read, which should set the accounts offline.
			return big.NewInt(100), map[common.Address]*big.Int{}, map[[2]common.Address]*big.Int{}, nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil)
	account := newAccount(t, nil)
	defer account.Close()

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, balanceFetcher)
	require.Error(t, account.Offline())

	erc20Account := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12))
	defer erc20Account.Close()

	updater.UpdateBalancesAndBlockNumber([]*eth.Account{erc20Account}, balanceFetcher)
	require.Error(t, erc20Account.Offline())

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
	accountA := newAccount(t, tokenA)
	accountB := newAccount(t, tokenB)
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
		BalancesSnapshotFunc: func(
			ctx context.Context, addresses []common.Address, tokenHolders [][2]common.Address,
		) (*big.Int, map[common.Address]*big.Int, map[[2]common.Address]*big.Int, error) {
			require.Len(t, addresses, 0)
			tokenBalances := make(map[[2]common.Address]*big.Int)
			for _, tokenHolder := range tokenHolders {
				tokenBalances[tokenHolder] = big.NewInt(1e16)
			}
			return blockNumber, map[common.Address]*big.Int{}, tokenBalances, nil
		},
		TokenTransactionsByContractFunc: func(
			blockTipHeight *big.Int,
			address common.Address,
			endBlock *big.Int,
		) (map[common.Address][]*accounts.TransactionData, error) {
			tokenTxCalls++
			require.Equal(t, blockNumber, blockTipHeight)
			require.Equal(t, blockNumber, endBlock)
			require.Equal(t, addrA.Address, address)
			return map[common.Address][]*accounts.TransactionData{
				tokenA.ContractAddress(): {makeConfirmedTx("tx-a")},
				tokenB.ContractAddress(): {makeConfirmedTx("tx-b")},
			}, nil
		},
	}

	updater := eth.NewUpdater(nil, nil, nil, nil)
	updater.UpdateBalancesAndBlockNumber([]*eth.Account{accountA, accountB}, fetcher)

	require.Equal(t, 1, tokenTxCalls)
	require.Equal(t, 0, txSource.calls)
}

func TestUpdateBalancesPrefetchNilVsEmptyFallback(t *testing.T) {
	blockNumber := big.NewInt(100)
	tokenTxCalls := 0
	var tokenTxResult map[common.Address][]*accounts.TransactionData
	fetcher := &mocks.TokenTransactionsFetcherMock{
		BalancesSnapshotFunc: func(
			ctx context.Context, addresses []common.Address, tokenHolders [][2]common.Address,
		) (*big.Int, map[common.Address]*big.Int, map[[2]common.Address]*big.Int, error) {
			require.Len(t, addresses, 0)
			tokenBalances := make(map[[2]common.Address]*big.Int)
			for _, tokenHolder := range tokenHolders {
				tokenBalances[tokenHolder] = big.NewInt(1e16)
			}
			return blockNumber, map[common.Address]*big.Int{}, tokenBalances, nil
		},
		TokenTransactionsByContractFunc: func(
			blockTipHeight *big.Int,
			_ common.Address,
			endBlock *big.Int,
		) (map[common.Address][]*accounts.TransactionData, error) {
			tokenTxCalls++
			require.Equal(t, blockNumber, blockTipHeight)
			require.Equal(t, blockNumber, endBlock)
			return tokenTxResult, nil
		},
	}

	t.Run("no-prefetch-falls-back-to-nil", func(t *testing.T) {
		account := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12))
		defer account.Close()
		txSource := &transactionsSourceMock{}
		account.ETHCoin().TstSetTransactionsSource(txSource)

		tokenTxCalls = 0
		tokenTxResult = map[common.Address][]*accounts.TransactionData{}

		updater := eth.NewUpdater(nil, nil, nil, nil)
		updater.UpdateBalancesAndBlockNumber([]*eth.Account{account}, fetcher)

		// With a single token account, updater should skip prefetch entirely.
		require.Equal(t, 0, tokenTxCalls)
		// No prefetch entry means Update receives nil and falls back once.
		require.Equal(t, 1, txSource.calls)
	})

	t.Run("missing-contract-is-empty-no-fallback", func(t *testing.T) {
		accountA := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12))
		accountB := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000002", 12))
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

		updater := eth.NewUpdater(nil, nil, nil, nil)
		updater.UpdateBalancesAndBlockNumber([]*eth.Account{accountA, accountB}, fetcher)

		require.Equal(t, 1, tokenTxCalls)
		require.Equal(t, 0, txSource.calls)
	})
}

func TestUpdaterCloseDuringUpdate(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		started := make(chan struct{})
		finish := make(chan struct{})
		updater := eth.NewUpdater(nil, nil, nil, func() error {
			close(started)
			<-finish
			return nil
		})
		go updater.PollBalances()
		<-started
		updater.Close()
		close(finish)
	})
}
