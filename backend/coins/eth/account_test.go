// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	gethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	test.TstSetupLogging()
	os.Exit(m.Run())
}

func newAccountWithOptions(t *testing.T, skipInitialSync bool, enqueueUpdateCh chan *Account) *Account {
	t.Helper()
	log := logging.Get().WithGroup("account_test")

	net := &chaincfg.TestNet3Params

	dbFolder := test.TstTempDir("eth-dbfolder")
	defer func() { _ = os.RemoveAll(dbFolder) }()

	keypath, err := signing.NewAbsoluteKeypath("m/60'/1'/0'/0")
	require.NoError(t, err)
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{signing.NewEthereumConfiguration(
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}

	client := &mocks.InterfaceMock{
		EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
			return 21000, nil
		},
		BalanceFunc: func(ctx context.Context, account common.Address) (*big.Int, error) {
			return big.NewInt(1e18), nil
		},
		PendingNonceAtFunc: func(ctx context.Context, account common.Address) (uint64, error) {
			return 0, nil
		},
	}
	coin := NewCoin(client, coin.CodeSEPETH, "Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig, "", nil, nil)
	acct := NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: signingConfigurations,
			},
			DBFolder:        dbFolder,
			SkipInitialSync: skipInitialSync,
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
			ConnectKeystore: func() (keystore.Keystore, error) {
				ks := &keystoremock.KeystoreMock{
					SupportsEIP1559Func: func() bool {
						return true
					},
				}
				return ks, nil
			},
		},
		coin,
		&http.Client{},
		log,
		enqueueUpdateCh,
	)
	require.NoError(t, acct.Initialize())
	return acct
}

func newAccount(t *testing.T) *Account {
	t.Helper()
	return newAccountWithOptions(t, false, make(chan *Account))
}

func TestInitializeEnqueueUpdate(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		enqueueUpdateCh := make(chan *Account, 1)
		acct := newAccountWithOptions(t, false, enqueueUpdateCh)
		defer acct.Close()

		require.Eventually(t, func() bool {
			select {
			case <-enqueueUpdateCh:
				return true
			default:
				return false
			}
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("skip-initial-sync", func(t *testing.T) {
		enqueueUpdateCh := make(chan *Account, 1)
		acct := newAccountWithOptions(t, true, enqueueUpdateCh)
		defer acct.Close()

		assert.Never(t, func() bool {
			select {
			case <-enqueueUpdateCh:
				return true
			default:
				return false
			}
		}, 200*time.Millisecond, 10*time.Millisecond)
	})
}

func TestTxProposal(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil))
	require.Eventually(t, acct.Synced, time.Second, time.Millisecond*200)

	t.Run("valid", func(t *testing.T) {
		value, fee, total, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021BF4C139D03Dff59ae763AC73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
		require.Equal(t, coin.NewAmountFromInt64(100000000000000000), value)
		require.Equal(t, coin.NewAmountFromInt64(420000000000000), fee)
		require.Equal(t, coin.NewAmountFromInt64(100420000000000000), total)
	})
	t.Run("valid-address-lowercase", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021bf4c139d03dff59ae763ac73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
	})
	t.Run("valid-address-uppercase", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0XA29163852021BF4C139D03DFF59AE763AC73E84E",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
	})
	t.Run("invalid-address-checksum", func(t *testing.T) {
		// EIP-55 checksum wrong
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xA29163852021BF4C139D03Dff59ae763AC73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.Error(t, err)
	})

	t.Run("invalid-address", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021BF4C1",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.Equal(t, errors.ErrInvalidAddress, errp.Cause(err))
	})
}

func newTestOutgoingTx() *gethtypes.Transaction {
	to := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	return gethtypes.NewTx(&gethtypes.LegacyTx{
		Nonce:    0,
		GasPrice: big.NewInt(1),
		Gas:      21000,
		To:       &to,
		Value:    big.NewInt(1),
	})
}

func putOutgoingTx(t *testing.T, account *Account, tx *ethtypes.TransactionWithMetadata) {
	t.Helper()
	dbTx, err := account.db.Begin()
	require.NoError(t, err)
	defer dbTx.Rollback()
	require.NoError(t, dbTx.PutOutgoingTransaction(tx))
	require.NoError(t, dbTx.Commit())
}

func outgoingTxs(t *testing.T, account *Account) []*ethtypes.TransactionWithMetadata {
	t.Helper()
	dbTx, err := account.db.Begin()
	require.NoError(t, err)
	defer dbTx.Rollback()
	txs, err := dbTx.OutgoingTransactions()
	require.NoError(t, err)
	return txs
}

func TestOutgoingTransactionIsFinal(t *testing.T) {
	tx := newTestOutgoingTx()
	tests := []struct {
		name                   string
		height                 uint64
		tipHeight              uint64
		lastReceiptCheckHeight uint64
		expected               bool
	}{
		{
			name:                   "pending",
			height:                 0,
			tipHeight:              100,
			lastReceiptCheckHeight: 100,
			expected:               false,
		},
		{
			name:                   "eleven confirmations",
			height:                 90,
			tipHeight:              100,
			lastReceiptCheckHeight: 100,
			expected:               false,
		},
		{
			name:                   "twelve confirmations but not checked at finality",
			height:                 89,
			tipHeight:              100,
			lastReceiptCheckHeight: 99,
			expected:               false,
		},
		{
			name:                   "twelve confirmations checked at finality",
			height:                 89,
			tipHeight:              100,
			lastReceiptCheckHeight: 100,
			expected:               true,
		},
		{
			name:                   "future height",
			height:                 101,
			tipHeight:              100,
			lastReceiptCheckHeight: 100,
			expected:               false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.expected, outgoingTransactionIsFinal(
				&ethtypes.TransactionWithMetadata{
					Transaction:            tx,
					Height:                 test.height,
					LastReceiptCheckHeight: test.lastReceiptCheckHeight,
				},
				test.tipHeight,
			))
		})
	}
}

func TestUpdateOutgoingTransactionsSkipsFinalTransactions(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer account.Close()
	putOutgoingTx(t, account, &ethtypes.TransactionWithMetadata{
		Transaction:            newTestOutgoingTx(),
		Height:                 89,
		GasUsed:                21000,
		Success:                true,
		LastReceiptCheckHeight: 100,
	})

	var receiptCalls int
	account.ETHCoin().TstSetClient(&mocks.InterfaceMock{
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
			receiptCalls++
			return nil, errp.New("receipt should not be fetched")
		},
	})

	account.updateOutgoingTransactions(100)
	require.Equal(t, 0, receiptCalls)
}

func TestUpdateOutgoingTransactionsPollsFinalTransactionUntilFinalityChecked(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer account.Close()
	tx := newTestOutgoingTx()
	putOutgoingTx(t, account, &ethtypes.TransactionWithMetadata{
		Transaction:            tx,
		Height:                 89,
		GasUsed:                21000,
		Success:                true,
		LastReceiptCheckHeight: 99,
	})

	var receiptCalls int
	account.ETHCoin().TstSetClient(&mocks.InterfaceMock{
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return &rpcclient.RPCTransactionReceipt{
				Receipt: gethtypes.Receipt{
					Status:  gethtypes.ReceiptStatusSuccessful,
					GasUsed: 21000,
				},
				BlockNumber: 89,
			}, nil
		},
	})

	account.updateOutgoingTransactions(100)
	require.Equal(t, 1, receiptCalls)
	txs := outgoingTxs(t, account)
	require.Len(t, txs, 1)
	require.Equal(t, uint64(100), txs[0].LastReceiptCheckHeight)
}

func TestUpdateOutgoingTransactionsPollsRecentConfirmedTransactions(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer account.Close()
	tx := newTestOutgoingTx()
	putOutgoingTx(t, account, &ethtypes.TransactionWithMetadata{
		Transaction: tx,
		Height:      90,
		GasUsed:     21000,
		Success:     false,
	})

	var receiptCalls int
	account.ETHCoin().TstSetClient(&mocks.InterfaceMock{
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return &rpcclient.RPCTransactionReceipt{
				Receipt: gethtypes.Receipt{
					Status:  gethtypes.ReceiptStatusSuccessful,
					GasUsed: 42000,
				},
				BlockNumber: 90,
			}, nil
		},
	})

	account.updateOutgoingTransactions(100)
	require.Equal(t, 1, receiptCalls)
	txs := outgoingTxs(t, account)
	require.Len(t, txs, 1)
	require.True(t, txs[0].Success)
	require.Equal(t, uint64(42000), txs[0].GasUsed)
}

func TestUpdateOutgoingTransactionsStillChecksPendingTransactions(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer account.Close()
	tx := newTestOutgoingTx()
	putOutgoingTx(t, account, &ethtypes.TransactionWithMetadata{
		Transaction: tx,
		Height:      0,
	})

	var receiptCalls int
	var transactionByHashCalls int
	var sendCalls int
	account.ETHCoin().TstSetClient(&mocks.InterfaceMock{
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return nil, errp.New("not found")
		},
		TransactionByHashFunc: func(ctx context.Context, hash common.Hash) (*gethtypes.Transaction, bool, error) {
			transactionByHashCalls++
			require.Equal(t, tx.Hash(), hash)
			return tx, true, nil
		},
		SendTransactionFunc: func(ctx context.Context, tx *gethtypes.Transaction) error {
			sendCalls++
			return nil
		},
	})

	account.updateOutgoingTransactions(100)
	require.Equal(t, 1, receiptCalls)
	require.Equal(t, 1, transactionByHashCalls)
	require.Equal(t, 0, sendCalls)
}

func TestMatchesAddress(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil))
	require.Eventually(t, acct.Synced, time.Second, time.Millisecond*200)

	// Test invalid Ethereum address
	t.Run("Invalid Ethereum address", func(t *testing.T) {
		matches, err := acct.MatchesAddress("invalid_address")
		require.Error(t, err)
		require.False(t, matches)
		require.Equal(t, errp.Cause(err), errors.ErrInvalidAddress)
	})

	// Test invalid Ethereum address checksum
	t.Run("Invalid Ethereum address", func(t *testing.T) {
		matches, err := acct.MatchesAddress("0xA29163852021BF4C139D03Dff59ae763AC73e84E")
		require.Error(t, err)
		require.False(t, matches)
		assert.Contains(t, err.Error(), "invalidAddress")
	})

	// Test valid but not found
	t.Run("Valid but not found", func(t *testing.T) {
		matches, err := acct.MatchesAddress("0x0000000000000000000000000000000000000000")
		require.False(t, matches)
		require.NoError(t, err)
	})

	// Test existing address
	t.Run("Address found", func(t *testing.T) {
		addr, _ := acct.Address()
		matches, err := acct.MatchesAddress(addr.Hex())
		require.True(t, matches)
		require.NoError(t, err)
	})
}

func TestSignETHMessage(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil))
	require.Eventually(t, acct.Synced, time.Second, time.Millisecond*200)

	t.Run("empty message", func(t *testing.T) {
		_, _, err := acct.SignETHMessage("")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be empty")
	})

	t.Run("keystore cannot sign", func(t *testing.T) {
		acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
			return &keystoremock.KeystoreMock{
				CanSignMessageFunc: func(code coin.Code) bool {
					return false
				},
			}, nil
		}
		_, _, err := acct.SignETHMessage("hello")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot sign messages")
	})

	t.Run("successful signing", func(t *testing.T) {
		acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
			return &keystoremock.KeystoreMock{
				CanSignMessageFunc: func(code coin.Code) bool {
					return true
				},
				SignETHMessageFunc: func(chainID uint64, message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
					require.Equal(t, acct.ETHCoin().ChainID(), chainID)
					return []byte{0xde, 0xad, 0xbe, 0xef}, nil
				},
			}, nil
		}
		address, signature, err := acct.SignETHMessage("hello")
		require.NoError(t, err)
		assert.NotEmpty(t, address)
		assert.True(t, len(signature) > 2 && signature[:2] == "0x")
	})
}

func TestSignMsgUsesAccountChainID(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()

	expectedChainID := acct.ETHCoin().ChainID()
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		return &keystoremock.KeystoreMock{
			SignETHMessageFunc: func(chainID uint64, message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
				require.Equal(t, expectedChainID, chainID)
				require.Equal(t, []byte("hello"), message)
				return []byte{0xde, 0xad, 0xbe, 0xef}, nil
			},
		}, nil
	}

	signature, err := acct.SignMsg("0x68656c6c6f")
	require.NoError(t, err)
	require.Equal(t, "0xdeadbeef", signature)
}
