// SPDX-License-Identifier: Apache-2.0

package eth_test

import (
	"context"
	"math/big"
	"net/http"
	"os"
	"slices"
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
	blockTipHeight *big.Int,
	address common.Address,
	endBlock *big.Int,
	erc20Token *erc20.Token,
) ([]*accounts.TransactionData, error) {
	m.calls++
	return m.txs, nil
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

	updater := eth.NewUpdater(nil, nil, nil, nil)
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
		BalancesFunc: func(ctx context.Context, addresses []common.Address) (map[common.Address]*big.Int, error) {
			require.Len(t, addresses, 0)
			return map[common.Address]*big.Int{}, nil
		},
		BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
			return blockNumber, nil
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
		account := newAccount(t, erc20.NewToken("0x0000000000000000000000000000000000000001", 12), false)
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

		updater := eth.NewUpdater(nil, nil, nil, nil)
		updater.UpdateBalancesAndBlockNumber([]*eth.Account{accountA, accountB}, fetcher)

		require.Equal(t, 1, tokenTxCalls)
		require.Equal(t, 0, txSource.calls)
	})
}
