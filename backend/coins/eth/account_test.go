// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	ethdb "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
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
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg/v2"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	gethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
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
	return newAccountWithChainClientProvider(
		t,
		skipInitialSync,
		enqueueUpdateCh,
		func(chainID uint64) rpcclient.Interface {
			t.Fatalf("unexpected request for chain client %d", chainID)
			return nil
		},
	)
}

func newAccountWithChainClientProvider(
	t *testing.T,
	skipInitialSync bool,
	enqueueUpdateCh chan *Account,
	chainClientProvider ChainClientProvider,
) *Account {
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
	acct := NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: signingConfigurations,
			},
			DBFolder:        dbFolder,
			NotesFolder:     notesFolder,
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
		chainClientProvider,
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

func TestERC20TxProposalRejectsAmountOverflow(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()
	acct.coin.erc20Token = erc20.NewToken("0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7", 0)
	require.NoError(t, acct.Update(big.NewInt(1e18), big.NewInt(100), nil))
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

func TestSignTypedMsgForwardsSupportedRequestChainAndRawData(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()

	const requestChainID = uint64(10)
	const data = `{"types":{"EIP712Domain":[{"name":"chainId","type":"uint256"}],"Message":[{"name":"contents","type":"string"}]},"primaryType":"Message","domain":{"chainId":1},"message":{"contents":"Hello"}}`
	firmwareErr := errp.New("firmware rejected typed data")
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		return &keystoremock.KeystoreMock{
			SignETHTypedMessageFunc: func(chainID uint64, gotData []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
				require.Equal(t, requestChainID, chainID)
				require.Equal(t, data, string(gotData))
				return nil, firmwareErr
			},
		}, nil
	}

	_, err := acct.SignTypedMsg(requestChainID, data)
	require.Equal(t, firmwareErr, err)
}

func TestSignTypedMsgRejectsUnsupportedRequestChainBeforeConnectingKeystore(t *testing.T) {
	for _, chainID := range []uint64{0, 2} {
		t.Run(new(big.Int).SetUint64(chainID).String(), func(t *testing.T) {
			acct := newAccount(t)
			defer acct.Close()

			connected := false
			acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
				connected = true
				return nil, nil
			}

			_, err := acct.SignTypedMsg(chainID, "{}")
			require.EqualError(t, err, "unsupported EVM network")
			require.False(t, connected)
		})
	}
}

func validTransactionRequest(account *Account) TransactionRequest {
	nonce := uint64(0)
	return TransactionRequest{
		From:             account.address.Address,
		Recipient:        common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e"),
		RecipientAddress: "0xa29163852021BF4C139D03Dff59ae763AC73e84e",
		Data:             []byte{},
		Value:            big.NewInt(0),
		Nonce:            &nonce,
	}
}

func signTransaction(
	account *Account,
	chainID uint64,
	broadcast bool,
	transaction TransactionRequest,
) (*gethtypes.Transaction, error) {
	return account.SignTransaction(SignTransactionArgs{
		ChainID:     chainID,
		Broadcast:   broadcast,
		Transaction: transaction,
	})
}

func setTransactionSigningKeystore(t *testing.T, account *Account, expectedChainID uint64) {
	t.Helper()
	privateKey, err := crypto.HexToECDSA(strings.Repeat("1", 64))
	require.NoError(t, err)

	account.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		return &keystoremock.KeystoreMock{
			SignTransactionFunc: func(value interface{}) error {
				proposal, ok := value.(*TxProposal)
				require.True(t, ok)
				require.Equal(t, expectedChainID, proposal.ChainID)
				require.Equal(t, new(big.Int).SetUint64(expectedChainID), proposal.Signer().ChainID())

				signedTx, err := gethtypes.SignTx(proposal.Tx, proposal.Signer(), privateKey)
				require.NoError(t, err)
				proposal.Tx = signedTx
				return nil
			},
		}, nil
	}
}

func newTransactionRPCClient(
	nonce uint64,
	gasLimit uint64,
	gasPrice *big.Int,
	sendErr error,
) *mocks.InterfaceMock {
	return &mocks.InterfaceMock{
		PendingNonceAtFunc: func(ctx context.Context, account common.Address) (uint64, error) {
			return nonce, nil
		},
		EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
			return gasLimit, nil
		},
		FeeTargetsFunc: func(ctx context.Context) ([]*ethtypes.FeeTarget, error) {
			return []*ethtypes.FeeTarget{{
				TargetCode: accounts.FeeTargetCodeNormal,
				GasFeeCap:  new(big.Int).Set(gasPrice),
				GasTipCap:  new(big.Int).Set(gasPrice),
			}}, nil
		},
		SuggestGasPriceFunc: func(ctx context.Context) (*big.Int, error) {
			return new(big.Int).Set(gasPrice), nil
		},
		SendTransactionFunc: func(ctx context.Context, tx *gethtypes.Transaction) error {
			return sendErr
		},
	}
}

type beginFailingDB struct {
	err        error
	beginCalls int
}

func (db *beginFailingDB) Begin() (ethdb.TxInterface, error) {
	db.beginCalls++
	return nil, db.err
}

func (db *beginFailingDB) Close() error {
	return nil
}

func TestSignTransactionRejectsMismatchedSenderBeforeSideEffects(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()

	rpcCalled := false
	acct.coin.client = &mocks.InterfaceMock{
		EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
			rpcCalled = true
			return 21000, nil
		},
	}
	connected := false
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		connected = true
		return nil, nil
	}

	transaction := validTransactionRequest(acct)
	transaction.From = common.HexToAddress("0x1111111111111111111111111111111111111111")
	_, err := signTransaction(acct, acct.ETHCoin().ChainID(), false, transaction)
	require.EqualError(t, err, "transaction from address does not match account")
	require.False(t, rpcCalled)
	require.False(t, connected)
}

func TestSignTransactionRejectsUnsupportedChainBeforeSideEffects(t *testing.T) {
	const unsupportedChainID = uint64(2)
	providerCalled := false
	acct := newAccountWithChainClientProvider(
		t,
		true,
		make(chan *Account, 1),
		func(chainID uint64) rpcclient.Interface {
			providerCalled = true
			return nil
		},
	)
	defer acct.Close()

	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{})
	connected := false
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		connected = true
		return nil, nil
	}

	_, err := signTransaction(acct, unsupportedChainID, false, validTransactionRequest(acct))
	require.EqualError(t, err, "unsupported EVM network")
	require.False(t, providerCalled)
	require.False(t, connected)
}

func TestSignTransactionRejectsUnavailableFeesBeforeConnectingKeystore(t *testing.T) {
	acct := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer acct.Close()

	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{
		EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
			return 21000, nil
		},
		SuggestGasPriceFunc: func(ctx context.Context) (*big.Int, error) {
			return nil, errp.New("fees unavailable")
		},
	})
	connected := false
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		connected = true
		return nil, nil
	}

	_, err := signTransaction(acct, acct.ETHCoin().ChainID(), false, validTransactionRequest(acct))
	require.Equal(t, errors.ErrFeesNotAvailable, errp.Cause(err))
	require.False(t, connected)
}

func TestSignTransactionUsesOnlyTargetChainClient(t *testing.T) {
	const (
		targetChainID = uint64(10)
		targetNonce   = uint64(7)
		gasLimit      = uint64(42000)
	)
	gasPrice := big.NewInt(4)
	targetClient := newTransactionRPCClient(targetNonce, gasLimit, gasPrice, nil)
	providerCalls := 0
	acct := newAccountWithChainClientProvider(
		t,
		true,
		make(chan *Account, 1),
		func(chainID uint64) rpcclient.Interface {
			providerCalls++
			require.Equal(t, targetChainID, chainID)
			return targetClient
		},
	)
	defer acct.Close()

	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{})
	setTransactionSigningKeystore(t, acct, targetChainID)

	transaction := validTransactionRequest(acct)
	transaction.Nonce = nil
	signedTx, err := signTransaction(acct, targetChainID, true, transaction)
	require.NoError(t, err)
	require.Equal(t, targetNonce, signedTx.Nonce())
	require.Equal(t, gasLimit, signedTx.Gas())
	require.Equal(t, gasPrice, signedTx.GasPrice())
	require.Equal(t, new(big.Int).SetUint64(targetChainID), signedTx.ChainId())
	require.Equal(t, 1, providerCalls)
	require.Len(t, targetClient.PendingNonceAtCalls(), 1)
	require.Len(t, targetClient.EstimateGasCalls(), 1)
	require.Len(t, targetClient.FeeTargetsCalls(), 1)
	require.Empty(t, targetClient.SuggestGasPriceCalls())
	require.Len(t, targetClient.SendTransactionCalls(), 1)
	require.Same(t, signedTx, targetClient.SendTransactionCalls()[0].Tx)
	require.Empty(t, outgoingTxs(t, acct))
}

func TestSignTransactionCrossChainNonceIgnoresNativePendingTransactions(t *testing.T) {
	const (
		targetChainID = uint64(10)
		targetNonce   = uint64(4)
	)
	targetClient := newTransactionRPCClient(targetNonce, 21000, big.NewInt(2), nil)
	acct := newAccountWithChainClientProvider(
		t,
		true,
		make(chan *Account, 1),
		func(chainID uint64) rpcclient.Interface {
			require.Equal(t, targetChainID, chainID)
			return targetClient
		},
	)
	defer acct.Close()

	nativePendingTx := gethtypes.NewTx(&gethtypes.LegacyTx{
		Nonce:    99,
		GasPrice: big.NewInt(1),
		Gas:      21000,
	})
	putOutgoingTx(t, acct, &ethtypes.TransactionWithMetadata{Transaction: nativePendingTx})
	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{})
	setTransactionSigningKeystore(t, acct, targetChainID)

	transaction := validTransactionRequest(acct)
	transaction.Nonce = nil
	signedTx, err := signTransaction(acct, targetChainID, false, transaction)
	require.NoError(t, err)
	require.Equal(t, targetNonce, signedTx.Nonce())
	require.Len(t, targetClient.PendingNonceAtCalls(), 1)
}

func TestNextNonceForNativeChainUsesHigherPendingNonce(t *testing.T) {
	acct := newAccountWithOptions(t, true, make(chan *Account, 1))
	defer acct.Close()

	nativePendingTx := gethtypes.NewTx(&gethtypes.LegacyTx{
		Nonce:    9,
		GasPrice: big.NewInt(1),
		Gas:      21000,
	})
	putOutgoingTx(t, acct, &ethtypes.TransactionWithMetadata{Transaction: nativePendingTx})
	nativeClient := newTransactionRPCClient(4, 21000, big.NewInt(2), nil)
	acct.ETHCoin().TstSetClient(nativeClient)

	nonce, err := acct.nextNonceForChain(acct.ETHCoin().ChainID(), nativeClient)
	require.NoError(t, err)
	require.Equal(t, uint64(10), nonce)
	require.Len(t, nativeClient.PendingNonceAtCalls(), 1)
}

func TestSignTransactionStoresSuccessfulSameChainBroadcast(t *testing.T) {
	enqueueUpdateCh := make(chan *Account, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	defer acct.Close()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), nil)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())

	transaction := validTransactionRequest(acct)
	nonce := uint64(5)
	transaction.Nonce = &nonce
	signedTx, err := signTransaction(acct, acct.ETHCoin().ChainID(), true, transaction)
	require.NoError(t, err)
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Empty(t, nativeClient.PendingNonceAtCalls())
	require.Same(t, signedTx, nativeClient.SendTransactionCalls()[0].Tx)

	pendingTransactions := outgoingTxs(t, acct)
	require.Len(t, pendingTransactions, 1)
	require.Equal(t, signedTx.Hash(), pendingTransactions[0].Transaction.Hash())
	require.Equal(t, uint16(1), pendingTransactions[0].BroadcastAttempts)
	require.Same(t, acct, <-enqueueUpdateCh)
}

func TestSignTransactionDoesNotStoreFailedBroadcast(t *testing.T) {
	broadcastErr := errp.New("broadcast failed")
	enqueueUpdateCh := make(chan *Account, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	defer acct.Close()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), broadcastErr)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())

	_, err := signTransaction(acct, acct.ETHCoin().ChainID(), true, validTransactionRequest(acct))
	require.Equal(t, broadcastErr, errp.Cause(err))
	require.Empty(t, outgoingTxs(t, acct))
	select {
	case <-enqueueUpdateCh:
		t.Fatal("broadcast failure enqueued an account update")
	default:
	}
}

func TestSignTransactionSucceedsWhenPendingStorageFailsAfterBroadcast(t *testing.T) {
	storageErr := errp.New("pending storage failed")
	enqueueUpdateCh := make(chan *Account, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	originalDB := acct.db
	defer func() {
		acct.db = originalDB
		acct.Close()
	}()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), nil)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())
	failingDB := &beginFailingDB{err: storageErr}
	acct.db = failingDB

	signedTx, err := signTransaction(acct, acct.ETHCoin().ChainID(), true, validTransactionRequest(acct))
	require.NoError(t, err)
	require.NotNil(t, signedTx)
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Equal(t, 1, failingDB.beginCalls)
	require.Same(t, acct, <-enqueueUpdateCh)
}

func TestSendTxSucceedsWhenPendingStorageFailsAfterBroadcast(t *testing.T) {
	storageErr := errp.New("pending storage failed")
	enqueueUpdateCh := make(chan *Account, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	originalDB := acct.db
	defer func() {
		acct.db = originalDB
		acct.Close()
	}()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), nil)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())
	to := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	acct.activeTxProposal = &TxProposal{
		ChainID: acct.ETHCoin().ChainID(),
		Tx: gethtypes.NewTx(&gethtypes.LegacyTx{
			Nonce:    0,
			GasPrice: big.NewInt(3),
			Gas:      21000,
			To:       &to,
			Value:    big.NewInt(1),
		}),
		Keypath: acct.signingConfiguration.AbsoluteKeypath(),
	}
	failingDB := &beginFailingDB{err: storageErr}
	acct.db = failingDB

	txID, err := acct.SendTx("")
	require.NoError(t, err)
	require.Equal(t, acct.activeTxProposal.Tx.Hash().String(), txID)
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Equal(t, 1, failingDB.beginCalls)
	require.Same(t, acct, <-enqueueUpdateCh)
}
