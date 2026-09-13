// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	ethdb "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	gethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func TestSignTransactionNonce(t *testing.T) {
	zero, supplied := uint64(0), uint64(7)
	for _, test := range []struct {
		name     string
		nonce    *uint64
		expected uint64
	}{
		{name: "missing", expected: 4},
		{name: "supplied zero", nonce: &zero, expected: 0},
		{name: "supplied", nonce: &supplied, expected: 7},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := newTransactionRPCClient(4, 42000, big.NewInt(3), nil)
			account := newAccountWithOptions(t, true, make(chan struct{}, 1))
			defer account.Close()
			setTransactionSigningKeystore(t, account, 10)
			request := TransactionRequest{
				From:      account.address.Address,
				Recipient: common.HexToAddress("0x2222222222222222222222222222222222222222"),
				Value:     big.NewInt(42),
				Data:      []byte{0xde, 0xad, 0xbe, 0xef},
				Nonce:     test.nonce,
			}

			tx, err := SignTransaction(SignTransactionArgs{ChainID: 10, Transaction: request},
				client, account.signingConfiguration, account.Config().ConnectKeystore, nil, account.log)
			require.NoError(t, err)
			require.Equal(t, test.expected, tx.Nonce())
			require.Equal(t, request.Recipient, *tx.To())
			require.Equal(t, request.Value, tx.Value())
			require.Equal(t, request.Data, tx.Data())
			require.Equal(t, uint64(42000), tx.Gas())
			require.Equal(t, big.NewInt(3), tx.GasPrice())
			require.Len(t, client.EstimateGasCalls(), 1)
			require.Equal(t, request.From, client.EstimateGasCalls()[0].Call.From)
			if test.nonce == nil {
				require.Len(t, client.PendingNonceAtCalls(), 1)
				require.Equal(t, request.From, client.PendingNonceAtCalls()[0].Account)
			} else {
				require.Empty(t, client.PendingNonceAtCalls())
			}
		})
	}
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

	_, err := SignTypedMsg(requestChainID, data, acct.signingConfiguration, acct.Config().ConnectKeystore)
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

			_, err := SignTypedMsg(chainID, "{}", acct.signingConfiguration, acct.Config().ConnectKeystore)
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
	return SignTransaction(SignTransactionArgs{
		ChainID:     chainID,
		Broadcast:   broadcast,
		Transaction: transaction,
	}, account.coin.client, account.signingConfiguration, account.Config().ConnectKeystore, account.PendingTransactions(), account.log)
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
		BalanceFunc:                           func(context.Context, common.Address) (*big.Int, error) { return big.NewInt(1e18), nil },
		ERC20BalanceFunc:                      func(common.Address, *erc20.Token) (*big.Int, error) { return big.NewInt(1e18), nil },
		BlockNumberFunc:                       func(context.Context) (*big.Int, error) { return big.NewInt(100), nil },
		NonceAtFunc:                           func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
		TransactionReceiptWithBlockNumberFunc: func(context.Context, common.Hash) (*gethtypes.Receipt, error) { return nil, nil },
		TransactionByHashFunc:                 func(context.Context, common.Hash) (*gethtypes.Transaction, bool, error) { return nil, true, nil },
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
	ethdb.Interface
	err        error
	beginCalls int
}

func (db *beginFailingDB) BeginForSender(chainID uint64, sender common.Address) (ethdb.TxInterface, error) {
	db.beginCalls++
	if db.err != nil {
		return nil, db.err
	}
	return db.Interface.BeginForSender(chainID, sender)
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
	acct := newAccountWithOptions(t, true, make(chan struct{}, 1))
	defer acct.Close()

	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{})
	connected := false
	acct.Config().ConnectKeystore = func() (keystore.Keystore, error) {
		connected = true
		return nil, nil
	}

	_, err := signTransaction(acct, unsupportedChainID, false, validTransactionRequest(acct))
	require.EqualError(t, err, "unsupported EVM network")
	require.False(t, connected)
}

func TestSignTransactionRejectsUnavailableFeesBeforeConnectingKeystore(t *testing.T) {
	acct := newAccountWithOptions(t, true, make(chan struct{}, 1))
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
	acct := newAccountWithOptions(t, true, make(chan struct{}, 1))
	defer acct.Close()

	acct.ETHCoin().TstSetClient(&mocks.InterfaceMock{})
	setTransactionSigningKeystore(t, acct, targetChainID)

	transaction := validTransactionRequest(acct)
	transaction.Nonce = nil
	signedTx, err := SignTransaction(SignTransactionArgs{
		ChainID: targetChainID, Broadcast: true, Transaction: transaction,
	}, targetClient, acct.signingConfiguration, acct.Config().ConnectKeystore, nil, acct.log)
	require.NoError(t, err)
	require.Equal(t, targetNonce, signedTx.Nonce())
	require.Equal(t, gasLimit, signedTx.Gas())
	require.Equal(t, gasPrice, signedTx.GasPrice())
	require.Equal(t, new(big.Int).SetUint64(targetChainID), signedTx.ChainId())
	require.Len(t, targetClient.PendingNonceAtCalls(), 1)
	require.Len(t, targetClient.EstimateGasCalls(), 1)
	require.Len(t, targetClient.FeeTargetsCalls(), 1)
	require.Empty(t, targetClient.SuggestGasPriceCalls())
	require.Len(t, targetClient.SendTransactionCalls(), 1)
	require.Same(t, signedTx, targetClient.SendTransactionCalls()[0].Tx)
	require.Empty(t, outgoingTxs(t, acct))
}

func TestSignTransactionNativeNonceUsesHigherPendingNonce(t *testing.T) {
	acct := newAccountWithOptions(t, true, make(chan struct{}, 1))
	defer acct.Close()

	nativePendingTx := gethtypes.NewTx(&gethtypes.LegacyTx{
		Nonce:    9,
		GasPrice: big.NewInt(1),
		Gas:      21000,
	})
	putOutgoingTx(t, acct, &ethtypes.TransactionWithMetadata{Transaction: nativePendingTx})
	nativeClient := newTransactionRPCClient(4, 21000, big.NewInt(2), nil)
	acct.ETHCoin().TstSetClient(nativeClient)

	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())
	transaction := validTransactionRequest(acct)
	transaction.Nonce = nil
	signedTx, err := signTransaction(acct, acct.ETHCoin().ChainID(), false, transaction)
	require.NoError(t, err)
	require.Equal(t, uint64(10), signedTx.Nonce())
	require.Len(t, nativeClient.PendingNonceAtCalls(), 1)
	require.Nil(t, transaction.Nonce)
}

func TestSignTransactionStoresSuccessfulSameChainBroadcast(t *testing.T) {
	enqueueUpdateCh := make(chan struct{}, 1)
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
	require.Equal(t, nonce, signedTx.Nonce())
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Empty(t, nativeClient.PendingNonceAtCalls())
	require.Same(t, signedTx, nativeClient.SendTransactionCalls()[0].Tx)

	pendingTransactions := outgoingTxs(t, acct)
	require.Len(t, pendingTransactions, 1)
	require.Equal(t, signedTx.Hash(), pendingTransactions[0].Transaction.Hash())
	<-enqueueUpdateCh
}

func TestSignTransactionDoesNotStoreFailedBroadcast(t *testing.T) {
	broadcastErr := errp.New("broadcast failed")
	enqueueUpdateCh := make(chan struct{}, 1)
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
	enqueueUpdateCh := make(chan struct{}, 1)
	acct := newAccountWithOptions(t, true, enqueueUpdateCh)
	defer acct.Close()

	nativeClient := newTransactionRPCClient(0, 21000, big.NewInt(3), nil)
	acct.ETHCoin().TstSetClient(nativeClient)
	setTransactionSigningKeystore(t, acct, acct.ETHCoin().ChainID())
	failingDB := &beginFailingDB{Interface: acct.outgoing.db}
	acct.outgoing.db = failingDB
	nativeClient.SendTransactionFunc = func(context.Context, *gethtypes.Transaction) error {
		failingDB.err = errp.New("pending storage failed")
		return nil
	}

	signedTx, err := signTransaction(acct, acct.ETHCoin().ChainID(), true, validTransactionRequest(acct))
	require.NoError(t, err)
	require.NotNil(t, signedTx)
	require.Equal(t, 2, failingDB.beginCalls) // Load records, then attempt to store the broadcast.
	require.Len(t, nativeClient.SendTransactionCalls(), 1)
	require.Len(t, outgoingTxs(t, acct), 1)
	require.Len(t, enqueueUpdateCh, 1)
}

func TestSignTransactionRejectsMismatchedPendingScope(t *testing.T) {
	acct := newAccountWithOptions(t, true, make(chan struct{}, 1))
	defer acct.Close()
	for _, field := range []string{"chain", "sender"} {
		t.Run(field, func(t *testing.T) {
			pending := acct.PendingTransactions()
			if field == "chain" {
				pending.chainID++
			} else {
				pending.sender = common.Address{}
			}
			_, err := SignTransaction(SignTransactionArgs{
				ChainID: acct.coin.ChainID(), Transaction: validTransactionRequest(acct),
			}, &mocks.InterfaceMock{}, acct.signingConfiguration, func() (keystore.Keystore, error) {
				t.Fatal("must validate pending scope before connecting")
				return nil, nil
			}, pending, acct.log)
			require.EqualError(t, err, "pending transactions do not match transaction chain and sender")
		})
	}
}
