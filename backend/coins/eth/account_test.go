// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg/v2"
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

func newAccountWithOptions(t *testing.T, skipInitialSync bool, enqueueUpdateCh chan struct{}) *Account {
	t.Helper()
	log := logging.Get().WithGroup("account_test")

	net := &chaincfg.TestNet3Params

	dbFolder := test.TstTempDir("eth-dbfolder")
	notesFolder := test.TstTempDir("eth-notesfolder")
	t.Cleanup(func() {
		_ = os.RemoveAll(dbFolder)
		_ = os.RemoveAll(notesFolder)
	})

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
		SuggestGasPriceFunc: func(ctx context.Context) (*big.Int, error) {
			return big.NewInt(1), nil
		},
	}
	coin := NewCoin(client, coin.CodeSEPETH, "Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig, "", nil, nil)
	outgoing, err := NewOutgoingTransactions(dbFolder)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, outgoing.Close()) })
	acct := NewAccount(
		&accounts.AccountConfig{
			Code:                  "accountcode",
			SigningConfigurations: signingConfigurations,
			DBFolder:              dbFolder,
			NotesFolder:           notesFolder,
			SkipInitialSync:       skipInitialSync,
			RateUpdater:           nil,
			GetNotifier:           func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename:       func(suggestedFilename string) string { return suggestedFilename },
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
		outgoing,
		log,
		enqueueUpdateCh,
	)
	require.NoError(t, acct.Initialize())
	return acct
}

func newAccount(t *testing.T) *Account {
	t.Helper()
	return newAccountWithOptions(t, false, make(chan struct{}))
}

func TestInitializeEnqueueUpdate(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		enqueueUpdateCh := make(chan struct{}, 1)
		acct := newAccountWithOptions(t, false, enqueueUpdateCh)
		defer acct.Close()

		require.Len(t, enqueueUpdateCh, 1)
	})

	t.Run("skip-initial-sync", func(t *testing.T) {
		enqueueUpdateCh := make(chan struct{}, 1)
		acct := newAccountWithOptions(t, true, enqueueUpdateCh)
		defer acct.Close()

		require.Empty(t, enqueueUpdateCh)
	})
}

func TestTxProposal(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil, outgoingTxs(t, acct)))
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
			RecipientAddress: "0xA29163852021BF4C139D03DFF59AE763AC73E84E",
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

func TestIsValidEthAddress(t *testing.T) {
	for _, address := range []string{
		"0xa29163852021BF4C139D03Dff59ae763AC73e84e",
		"0Xa29163852021BF4C139D03Dff59ae763AC73e84e",
		"a29163852021BF4C139D03Dff59ae763AC73e84e",
	} {
		require.True(t, IsValidEthAddress(address), address)
	}
	require.False(t, IsValidEthAddress("0xA29163852021BF4C139D03Dff59ae763AC73e84e"))
}

func TestERC20TxProposalRejectsAmountOverflow(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	acct.coin.erc20Token = erc20.NewToken("0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7", 0)
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil, outgoingTxs(t, acct)))
	require.Eventually(t, acct.Synced, time.Second, time.Millisecond*200)

	_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
		RecipientAddress: "0xa29163852021BF4C139D03Dff59ae763AC73e84e",
		Amount: coin.NewSendAmount(
			"115792089237316195423570985008687907853269984665640564039457584007913129639936"),
		FeeTargetCode: accounts.FeeTargetCodeCustom,
		CustomFee:     "20",
	})
	require.Equal(t, errors.ErrInvalidAmount, errp.Cause(err))
}

func (account *Account) nextNonce() (uint64, error) {
	sender, unlock, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	if err != nil {
		return 0, err
	}
	defer unlock()
	if err := sender.refresh(account.coin.client); err != nil {
		return 0, err
	}
	return sender.nextNonce(account.coin.client)
}

func newTestOutgoingTx() *gethtypes.Transaction {
	return gethtypes.NewTx(newTestOutgoingTxData())
}

func newTestOutgoingTxData() *gethtypes.LegacyTx {
	to := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	return &gethtypes.LegacyTx{
		Nonce:    0,
		GasPrice: big.NewInt(1),
		Gas:      21000,
		To:       &to,
		Value:    big.NewInt(1),
	}
}

func putOutgoingTx(t *testing.T, account *Account, record *ethtypes.TransactionWithMetadata) {
	t.Helper()
	sender, unlock, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	require.NoError(t, err)
	defer unlock()
	require.NoError(t, sender.save(map[common.Hash]*ethtypes.TransactionWithMetadata{record.Transaction.Hash(): record}, nil))
}

func outgoingTxs(t *testing.T, account *Account) []*ethtypes.TransactionWithMetadata {
	t.Helper()
	sender, unlock, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	require.NoError(t, err)
	defer unlock()
	var records []*ethtypes.TransactionWithMetadata
	for _, record := range sender.records {
		snapshot := *record
		records = append(records, &snapshot)
	}
	return records
}

func reconcileOutgoing(t *testing.T, account *Account, height uint64) {
	t.Helper()
	_, err := account.updateOutgoingTransactions(height)
	require.NoError(t, err)
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
	account := newAccountWithOptions(t, true, make(chan struct{}, 1))
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
		NonceAtFunc: func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*gethtypes.Receipt, error) {
			receiptCalls++
			return nil, errp.New("receipt should not be fetched")
		},
	})

	reconcileOutgoing(t, account, 100)
	require.Equal(t, 0, receiptCalls)
}

func TestUpdateOutgoingTransactionsPollsFinalTransactionUntilFinalityChecked(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan struct{}, 1))
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
		NonceAtFunc: func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*gethtypes.Receipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return &gethtypes.Receipt{
				Status:      gethtypes.ReceiptStatusSuccessful,
				GasUsed:     21000,
				BlockNumber: big.NewInt(89),
			}, nil
		},
	})

	reconcileOutgoing(t, account, 100)
	require.Equal(t, 1, receiptCalls)
	txs := outgoingTxs(t, account)
	require.Len(t, txs, 1)
	require.Equal(t, uint64(100), txs[0].LastReceiptCheckHeight)
}

func TestUpdateOutgoingTransactionsPollsRecentConfirmedTransactions(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan struct{}, 1))
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
		NonceAtFunc: func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*gethtypes.Receipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return &gethtypes.Receipt{
				Status:      gethtypes.ReceiptStatusSuccessful,
				GasUsed:     42000,
				BlockNumber: big.NewInt(90),
			}, nil
		},
	})

	reconcileOutgoing(t, account, 100)
	require.Equal(t, 1, receiptCalls)
	txs := outgoingTxs(t, account)
	require.Len(t, txs, 1)
	require.True(t, txs[0].Success)
	require.Equal(t, uint64(42000), txs[0].GasUsed)
}

func TestUpdateOutgoingTransactionsStillChecksPendingTransactions(t *testing.T) {
	account := newAccountWithOptions(t, true, make(chan struct{}, 1))
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
		NonceAtFunc: func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
		TransactionReceiptWithBlockNumberFunc: func(ctx context.Context, hash common.Hash) (*gethtypes.Receipt, error) {
			receiptCalls++
			require.Equal(t, tx.Hash(), hash)
			return nil, nil
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

	reconcileOutgoing(t, account, 100)
	require.Equal(t, 1, receiptCalls)
	require.Equal(t, 1, transactionByHashCalls)
	require.Equal(t, 0, sendCalls)
}

func TestMatchesAddress(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil, outgoingTxs(t, acct)))
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
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil, outgoingTxs(t, acct)))
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

func TestSendTxSucceedsWhenPendingStorageFailsAfterBroadcast(t *testing.T) {
	enqueueUpdateCh := make(chan struct{}, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	defer acct.Close()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), nil)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())
	to := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	acct.activeTxProposal = &pendingTxProposal{
		txData: &gethtypes.LegacyTx{
			Nonce:    0,
			GasPrice: big.NewInt(3),
			Gas:      21000,
			To:       &to,
			Value:    big.NewInt(1),
		},
	}
	failingDB := &beginFailingDB{Interface: acct.outgoing.db}
	acct.outgoing.db = failingDB
	nativeClient.SendTransactionFunc = func(context.Context, *gethtypes.Transaction) error {
		failingDB.err = errp.New("pending storage failed")
		return nil
	}

	txID, err := acct.SendTx("")
	require.NoError(t, err)
	require.Equal(t, 2, failingDB.beginCalls) // Load records, then attempt to store the broadcast.
	require.Equal(t, outgoingTxs(t, acct)[0].Transaction.Hash().String(), txID)
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Len(t, outgoingTxs(t, acct), 1)
	require.Len(t, enqueueUpdateCh, 1)
}

func TestSendTxFinalNonceAndRetry(t *testing.T) {
	for _, txType := range []uint8{gethtypes.LegacyTxType, gethtypes.DynamicFeeTxType} {
		t.Run(new(big.Int).SetUint64(uint64(txType)).String(), func(t *testing.T) {
			account := newAccount(t)
			defer account.Close()
			client := newTransactionRPCClient(7, 21000, big.NewInt(1), context.DeadlineExceeded)
			account.coin.client = client
			require.NoError(t, account.Update(big.NewInt(1000000), big.NewInt(100), nil, outgoingTxs(t, account)))
			require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
			account.Config().ConnectKeystore = func() (keystore.Keystore, error) {
				return &keystoremock.KeystoreMock{
					SupportsEIP1559Func: func() bool { return txType == gethtypes.DynamicFeeTxType },
					SignTransactionFunc: func(interface{}) error { return keystore.ErrSigningAborted },
				}, nil
			}
			recipient := "0xa29163852021BF4C139D03Dff59ae763AC73e84e"
			value, fee, _, err := account.TxProposal(&accounts.TxProposalArgs{
				RecipientAddress: recipient, Amount: coin.NewSendAmountAll(), FeeTargetCode: accounts.FeeTargetCodeNormal,
			})
			require.NoError(t, err)
			require.Empty(t, client.PendingNonceAtCalls())
			pending := account.activeTxProposal
			_, err = account.SendTx("")
			require.ErrorIs(t, err, keystore.ErrSigningAborted)
			require.Same(t, pending, account.activeTxProposal)
			require.Empty(t, client.SendTransactionCalls())

			setTransactionSigningKeystore(t, account, account.coin.ChainID())
			// Only the nonce may change after the user reviewed the send-all proposal.
			require.NoError(t, account.Update(big.NewInt(2000000), big.NewInt(101), nil, outgoingTxs(t, account)))
			client.SuggestGasPriceFunc = func(context.Context) (*big.Int, error) { return big.NewInt(5), nil }
			client.PendingNonceAtFunc = func(context.Context, common.Address) (uint64, error) { return 9, nil }
			_, err = account.SendTx("")
			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.Len(t, client.SendTransactionCalls(), 1)
			signed := client.SendTransactionCalls()[0].Tx
			require.Equal(t, uint64(9), signed.Nonce())
			require.Equal(t, txType, signed.Type())
			require.Equal(t, recipient, signed.To().Hex())
			require.Equal(t, value.BigInt(), signed.Value())
			require.Equal(t, fee.BigInt(), new(big.Int).Sub(signed.Cost(), signed.Value()))
			require.Len(t, client.EstimateGasCalls(), 1)
			require.Len(t, client.SuggestGasPriceCalls(), 1)
			// Acceptance may advance the nonce and spend the balance before the response arrives.
			client.PendingNonceAtFunc = func(context.Context, common.Address) (uint64, error) { return 10, nil }
			client.BalanceFunc = func(context.Context, common.Address) (*big.Int, error) { return big.NewInt(0), nil }
			account.Config().ConnectKeystore = func() (keystore.Keystore, error) {
				return &keystoremock.KeystoreMock{SignTransactionFunc: func(interface{}) error {
					t.Fatal("a broadcast retry must not sign a new transaction")
					return nil
				}}, nil
			}
			// A still-ambiguous retry rebroadcasts the same bytes.
			_, err = account.SendTx("")
			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.Equal(t, signed.Hash(), client.SendTransactionCalls()[1].Tx.Hash())
			// Resolve a subsequent broadcast error using the original transaction hash.
			client.TransactionByHashFunc = func(_ context.Context, hash common.Hash) (*gethtypes.Transaction, bool, error) {
				require.Equal(t, signed.Hash(), hash)
				return signed, false, nil
			}
			txID, err := account.SendTx("")
			require.NoError(t, err)
			require.Equal(t, signed.Hash().Hex(), txID)
			require.Len(t, outgoingTxs(t, account), 1)
			require.Equal(t, signed.Hash(), client.SendTransactionCalls()[2].Tx.Hash())
			_, err = account.SendTx("")
			require.EqualError(t, err, "No active tx proposal")
			require.Len(t, client.SendTransactionCalls(), 3)
		})
	}
}
