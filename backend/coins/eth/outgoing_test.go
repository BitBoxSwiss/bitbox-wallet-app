// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func sharedAccounts(t *testing.T) (*Account, *Account) {
	t.Helper()
	native := newAccountWithOptions(t, true, make(chan struct{}, 1))
	token := newAccountWithOptions(t, true, make(chan struct{}, 1))
	t.Cleanup(native.Close)
	t.Cleanup(token.Close)
	token.outgoing = native.outgoing
	token.coin.erc20Token = erc20.NewToken("0x0000000000000000000000000000000000000001", 6)
	return native, token
}

func erc20TransferData(t *testing.T, recipient common.Address, amount int64) []byte {
	t.Helper()
	parsed, err := erc20.IERC20MetaData.GetAbi()
	require.NoError(t, err)
	data, err := parsed.Pack("transfer", recipient, big.NewInt(amount))
	require.NoError(t, err)
	return data
}

func TestSharedOutgoingNonces(t *testing.T) {
	native, token := sharedAccounts(t)
	client := newTransactionRPCClient(0, 21000, big.NewInt(2), nil)
	for _, account := range []*Account{native, token} {
		account.coin.client = client
		setTransactionSigningKeystore(t, account, account.coin.ChainID())
		account.activeTxProposal = &pendingTxProposal{txData: newTestOutgoingTxData()}
	}
	contract := token.coin.erc20Token.ContractAddress()
	token.activeTxProposal.txData = &types.LegacyTx{
		To: &contract, Gas: 21000, GasPrice: big.NewInt(2), Data: erc20TransferData(t, common.Address{2}, 0),
	}
	results := make(chan error, 3)
	for _, account := range []*Account{native, token, native} {
		go func() {
			_, err := account.SendTx("")
			results <- err
		}()
	}
	var failures int
	for range 3 {
		if err := <-results; err != nil {
			require.EqualError(t, err, "No active tx proposal")
			failures++
		}
	}
	require.Equal(t, 1, failures)
	require.Len(t, client.SendTransactionCalls(), 2)
	require.Equal(t, uint64(0), client.SendTransactionCalls()[0].Tx.Nonce())
	require.Equal(t, uint64(1), client.SendTransactionCalls()[1].Tx.Nonce())
	require.Len(t, outgoingTxs(t, token), 2)

	request := validTransactionRequest(native)
	request.Nonce = nil
	signed, err := signTransaction(native, native.coin.ChainID(), true, request)
	require.NoError(t, err)
	require.Equal(t, uint64(2), signed.Nonce())
	request.Nonce = new(uint64)
	request.Value = big.NewInt(42)
	_, err = signTransaction(native, native.coin.ChainID(), true, request)
	require.NoError(t, err)
	require.Len(t, outgoingTxs(t, token), 4)
	nonce, err := token.nextNonce()
	require.NoError(t, err)
	require.Equal(t, uint64(3), nonce)
	for _, key := range []senderKey{{1, native.address.Address}, {native.coin.ChainID(), common.Address{2}}} {
		sender, unlock, err := native.outgoing.lock(key.chainID, key.address)
		require.NoError(t, err)
		nonce, err := sender.nextNonce(client, 0)
		unlock()
		require.NoError(t, err)
		require.Zero(t, nonce)
	}
}

func TestAmbiguousSendReservesAcrossAccounts(t *testing.T) {
	for _, test := range []struct {
		name string
		err  error
	}{
		{"account", context.DeadlineExceeded},
		{"WalletConnect", context.DeadlineExceeded},
		{"server timeout", rpcclient.RPCError{Code: -32002, Message: "request timed out"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			native, token := sharedAccounts(t)
			client := newTransactionRPCClient(0, 21000, big.NewInt(2), nil)
			for _, account := range []*Account{native, token} {
				account.coin.client = client
				setTransactionSigningKeystore(t, account, account.coin.ChainID())
			}
			nativeTx := newTestOutgoingTxData()
			nativeTx.GasPrice = big.NewInt(2)
			native.activeTxProposal = &pendingTxProposal{txData: nativeTx}
			contract := token.coin.erc20Token.ContractAddress()
			token.activeTxProposal = &pendingTxProposal{txData: &types.LegacyTx{
				To: &contract, Gas: 50000, GasPrice: big.NewInt(1), Data: erc20TransferData(t, common.Address{2}, 1),
			}}
			sendNative := func() error {
				if test.name == "WalletConnect" {
					_, err := signTransaction(native, native.coin.ChainID(), true, validTransactionRequest(native))
					return err
				}
				_, err := native.SendTx("")
				return err
			}
			var sent []*types.Transaction
			client.SendTransactionFunc = func(_ context.Context, tx *types.Transaction) error {
				sent = append(sent, tx)
				if len(sent) == 1 {
					return test.err
				}
				return nil
			}
			client.TransactionByHashFunc = func(context.Context, common.Hash) (*types.Transaction, bool, error) {
				return nil, false, ethereum.NotFound
			}
			require.ErrorIs(t, sendNative(), ErrBroadcastUncertain)
			require.Len(t, outgoingTxs(t, native), 1)

			// The node has no transaction, but the unresolved send still reserves its funds.
			client.BalanceFunc = func(context.Context, common.Address, *big.Int) (*big.Int, error) {
				return new(big.Int).Add(sent[0].Cost(), big.NewInt(49999)), nil
			}
			_, err := token.SendTx("")
			require.ErrorIs(t, err, errors.ErrERC20InsufficientGasFunds)
			client.BalanceFunc = func(context.Context, common.Address, *big.Int) (*big.Int, error) {
				return big.NewInt(1000000), nil
			}
			_, err = token.SendTx("")
			require.NoError(t, err)
			require.Equal(t, uint64(1), sent[1].Nonce())
			require.NoError(t, sendNative())
			require.Len(t, sent, 3)
			require.Equal(t, sent[0].Hash(), sent[2].Hash())
		})
	}
}

func TestRejectedSendCanChooseFreshNonce(t *testing.T) {
	for _, rejected := range []error{
		rpcclient.RPCError{Code: -32000, Message: "insufficient funds for gas * price + value"},
		rpcclient.ErrRequestRejected,
	} {
		t.Run(rejected.Error(), func(t *testing.T) {
			account := newAccountWithOptions(t, true, make(chan struct{}, 1))
			defer account.Close()
			client := newTransactionRPCClient(0, 21000, big.NewInt(2), rejected)
			account.coin.client = client
			setTransactionSigningKeystore(t, account, account.coin.ChainID())
			account.activeTxProposal = &pendingTxProposal{txData: newTestOutgoingTxData()}
			_, err := account.SendTx("")
			require.ErrorIs(t, err, rejected)
			require.Empty(t, outgoingTxs(t, account))
			// Another payment can take the rejected nonce before this proposal is retried.
			client.PendingNonceAtFunc = func(context.Context, common.Address) (uint64, error) { return 1, nil }
			client.SendTransactionFunc = func(context.Context, *types.Transaction) error { return nil }
			_, err = account.SendTx("")
			require.NoError(t, err)
			require.Equal(t, uint64(1), client.SendTransactionCalls()[1].Tx.Nonce())
		})
	}
}

func TestSendTxRechecksFunds(t *testing.T) {
	for _, name := range []string{"ETH", "ERC20"} {
		t.Run(name, func(t *testing.T) {
			native, token := sharedAccounts(t)
			account := native
			client := newTransactionRPCClient(0, 21000, big.NewInt(2), nil)
			ethBalance, tokenBalance := int64(30000), int64(100)
			// Funds are checked at reconciliation block 100; any other block would have enough.
			atBlock := func(block *big.Int, balance int64) *big.Int {
				if block == nil || block.Int64() != 100 {
					return big.NewInt(1e9)
				}
				return big.NewInt(balance)
			}
			client.BalanceFunc = func(_ context.Context, _ common.Address, block *big.Int) (*big.Int, error) {
				return atBlock(block, ethBalance), nil
			}
			client.ERC20BalanceFunc = func(_ common.Address, _ *erc20.Token, block *big.Int) (*big.Int, error) {
				return atBlock(block, tokenBalance), nil
			}
			txData := newTestOutgoingTxData()
			if name == "ERC20" {
				account = token
				ethBalance = 1000000
				contract := token.coin.erc20Token.ContractAddress()
				txData = &types.LegacyTx{
					To: &contract, Value: big.NewInt(0), Gas: 21000, GasPrice: big.NewInt(2), Data: erc20TransferData(t, common.Address{2}, 60),
				}
			}
			account.coin.client = client
			setTransactionSigningKeystore(t, account, account.coin.ChainID())
			// A sibling send arrived after this proposal was prepared.
			account.activeTxProposal = &pendingTxProposal{txData: txData}
			tx := types.NewTx(txData)
			putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: tx})
			_, err := account.SendTx("")
			require.ErrorIs(t, err, errors.ErrInsufficientFunds)
			require.Empty(t, client.SendTransactionCalls())
			require.Same(t, txData, account.activeTxProposal.txData)

			// An explicit replacement needs funds for one candidate at this nonce.
			request := validTransactionRequest(account)
			request.Recipient, request.Data, request.Value = *tx.To(), tx.Data(), tx.Value()
			client.SuggestGasPriceFunc = func(context.Context) (*big.Int, error) { return tx.GasPrice(), nil }
			_, err = signTransaction(account, account.coin.ChainID(), true, request)
			require.NoError(t, err)
			require.Len(t, client.SendTransactionCalls(), 1)
		})
	}
}

func TestPendingSelfTransfers(t *testing.T) {
	native, token := sharedAccounts(t)
	native.blockNumber, token.blockNumber = big.NewInt(100), big.NewInt(100)
	data := erc20TransferData(t, native.address.Address, 100)
	for _, tx := range []*types.Transaction{
		types.NewTransaction(0, native.address.Address, big.NewInt(100000), 21000, big.NewInt(2), nil),
		types.NewTransaction(1, token.coin.erc20Token.ContractAddress(), big.NewInt(0), 42000, big.NewInt(3), data),
	} {
		putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: tx})
	}
	transactions, pending, err := native.outgoingTransactions(nil, outgoingTxs(t, native))
	require.NoError(t, err)
	require.Len(t, transactions, 2)
	require.Equal(t, big.NewInt(168000), pending)
	transactions, pending, err = token.outgoingTransactions(nil, outgoingTxs(t, token))
	require.NoError(t, err)
	require.Len(t, transactions, 1)
	require.Equal(t, accounts.TxTypeSendSelf, transactions[0].Type)
	require.Zero(t, pending.Sign())
}

func TestSharedReplacementsAndReorg(t *testing.T) {
	native, token := sharedAccounts(t)
	client := newTransactionRPCClient(0, 21000, big.NewInt(2), nil)
	native.coin.client, token.coin.client = client, client
	notifier := &accountmocks.Notifier{}
	notifier.On("Put", mock.Anything).Return(nil)
	native.notifier, token.notifier = notifier, notifier
	contract := token.coin.erc20Token.ContractAddress()
	a := types.NewTransaction(7, contract, big.NewInt(0), 50000, big.NewInt(2), erc20TransferData(t, common.Address{2}, 100))
	b := types.NewTransaction(7, contract, big.NewInt(0), 40000, big.NewInt(3), erc20TransferData(t, common.Address{2}, 150))
	c := types.NewTransaction(7, contract, big.NewInt(50), 50000, big.NewInt(3), []byte{1, 2, 3})
	d := types.NewTransaction(8, common.Address{3}, big.NewInt(100), 21000, big.NewInt(1), nil)
	for _, tx := range []*types.Transaction{a, b, c, d} {
		putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: tx})
	}
	checkBalances := func(height int64, nativePending, tokenPending int64) {
		t.Helper()
		require.NoError(t, native.Update(big.NewInt(1000000), big.NewInt(height), []*accounts.TransactionData{}, outgoingTxs(t, native)))
		require.NoError(t, token.Update(big.NewInt(1000), big.NewInt(height), []*accounts.TransactionData{}, outgoingTxs(t, token)))
		require.Equal(t, big.NewInt(1000000-nativePending), native.balance.BigInt())
		require.Equal(t, big.NewInt(1000-tokenPending), token.balance.BigInt())
	}
	checkBalances(99, 171150, 150)
	require.Len(t, token.transactions, 2)

	confirmedNonce := uint64(9)
	minedHeight := uint64(100)
	nonceAt := func(_ context.Context, _ common.Address, block *big.Int) (uint64, error) {
		if block.Uint64() < minedHeight {
			return 0, nil
		}
		if block.Uint64() == minedHeight {
			return 8, nil
		}
		return confirmedNonce, nil
	}
	client.NonceAtFunc = nonceAt
	mined := true
	client.TransactionReceiptWithBlockNumberFunc = func(_ context.Context, hash common.Hash) (*types.Receipt, error) {
		if mined && hash == b.Hash() {
			return &types.Receipt{
				Status: types.ReceiptStatusFailed, GasUsed: 30000, BlockNumber: new(big.Int).SetUint64(minedHeight),
			}, nil
		}
		return nil, nil
	}
	reconcileOutgoing(t, native, 101)
	checkBalances(101, 0, 0)
	require.Len(t, token.transactions, 1)
	require.Equal(t, accounts.TxStatusFailed, token.transactions[0].Status)
	require.Empty(t, client.SendTransactionCalls())

	// A transferFrom debit can have another sender's nonce in token history.
	foreignNonce := uint64(7)
	require.NoError(t, token.Update(big.NewInt(1000), big.NewInt(101), []*accounts.TransactionData{{
		TxID: "foreign-sender", Type: accounts.TxTypeSend, Nonce: &foreignNonce, NumConfirmations: 50,
	}}, outgoingTxs(t, token)))
	require.Len(t, outgoingTxs(t, native), 4)

	mined, confirmedNonce = false, 0
	reconcileOutgoing(t, native, 102)
	checkBalances(102, 171150, 150)
	require.Len(t, token.transactions, 2)
	mined, confirmedNonce = true, 9
	reconcileOutgoing(t, native, 103)
	checkBalances(103, 0, 0)
	client.NonceAtFunc = func(context.Context, common.Address, *big.Int) (uint64, error) {
		return 0, errp.New("offline")
	}
	_, reconcileErr := native.updateOutgoingTransactions(104)
	require.Error(t, reconcileErr)
	checkBalances(104, 0, 0)
	_, err := native.nextNonce()
	require.Error(t, err)
	client.NonceAtFunc = nonceAt
	mined, confirmedNonce = false, 0
	nonce, err := native.nextNonce()
	require.NoError(t, err)
	require.Equal(t, uint64(9), nonce)
	mined, confirmedNonce = true, 9
	minedHeight = 110
	reconcileOutgoing(t, native, 114)
	require.Len(t, outgoingTxs(t, native), 4)
	reconcileOutgoing(t, native, 121)
	require.Len(t, outgoingTxs(t, native), 2)
	confirmed := (&ethtypes.TransactionWithMetadata{Transaction: b, Height: minedHeight}).TransactionData(
		121, token.coin.erc20Token, token.address.Hex())
	require.NoError(t, token.Update(big.NewInt(1000), big.NewInt(121), []*accounts.TransactionData{confirmed}, outgoingTxs(t, token)))
	require.Len(t, token.transactions, 1)
	require.Len(t, outgoingTxs(t, native), 1)

	// Both replacement pruning and confirmed-history pruning must survive a restart.
	require.NoError(t, native.outgoing.Close())
	native.outgoing, err = NewOutgoingTransactions(native.Config().DBFolder)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, native.outgoing.Close()) })
	records := outgoingTxs(t, native)
	require.Len(t, records, 1)
	require.Equal(t, d.Hash(), records[0].Transaction.Hash())
}

func TestExternalReplacementAndReorg(t *testing.T) {
	native, _ := sharedAccounts(t)
	client := newTransactionRPCClient(1, 21000, big.NewInt(2), nil)
	native.coin.client = client
	old := newTestOutgoingTx()
	putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: old})
	consumedAt := uint64(100)
	historyUnavailable := false
	client.NonceAtFunc = func(_ context.Context, _ common.Address, block *big.Int) (uint64, error) {
		if historyUnavailable && block.Uint64() < 111 {
			return 0, errp.New("historical state unavailable")
		}
		if block.Uint64() >= consumedAt {
			return 1, nil
		}
		return 0, nil
	}
	for _, step := range []struct {
		height, consumedAt uint64
		consumed           bool
	}{
		{100, 100, true},
		{101, 102, false}, // Replacement reorged out; restore the pending reservation.
		{110, 102, true},
		{111, 102, true}, // Twelve blocks since first seen is not sufficient after a reorg.
	} {
		consumedAt = step.consumedAt
		native.blockNumber = new(big.Int).SetUint64(step.height)
		reconcileOutgoing(t, native, step.height)
		records := outgoingTxs(t, native)
		require.Len(t, records, 1)
		require.Equal(t, step.consumed, records[0].NonceConsumed)
		_, pending, err := native.outgoingTransactions(nil, outgoingTxs(t, native))
		require.NoError(t, err)
		if step.consumed {
			require.Zero(t, pending.Sign())
		} else {
			require.Positive(t, pending.Sign())
		}
	}
	historyUnavailable = true
	reconcileOutgoing(t, native, 113)
	require.Len(t, outgoingTxs(t, native), 1)
	historyUnavailable = false
	reconcileOutgoing(t, native, 113)
	require.Empty(t, outgoingTxs(t, native))
	receiptCalls := len(client.TransactionReceiptWithBlockNumberCalls())
	reconcileOutgoing(t, native, 114)
	require.Len(t, client.TransactionReceiptWithBlockNumberCalls(), receiptCalls)
	require.Empty(t, client.SendTransactionCalls())
}

func TestConsumedNonceReceiptErrorDoesNotBlockSend(t *testing.T) {
	for _, minedHeight := range []uint64{0, 99} {
		t.Run(new(big.Int).SetUint64(minedHeight).String(), func(t *testing.T) {
			native, _ := sharedAccounts(t)
			client := newTransactionRPCClient(1, 21000, big.NewInt(2), nil)
			native.coin.client = client
			setTransactionSigningKeystore(t, native, native.coin.ChainID())
			old := &ethtypes.TransactionWithMetadata{
				Transaction: newTestOutgoingTx(), Height: minedHeight, GasUsed: 21000,
				Success: true, LastReceiptCheckHeight: 99,
			}
			putOutgoingTx(t, native, old)
			client.NonceAtFunc = func(context.Context, common.Address, *big.Int) (uint64, error) { return 1, nil }
			receiptErr := errp.New("old receipt unavailable")
			client.TransactionReceiptWithBlockNumberFunc = func(context.Context, common.Hash) (*types.Receipt, error) {
				return nil, receiptErr
			}
			native.activeTxProposal = &pendingTxProposal{txData: newTestOutgoingTxData()}
			_, err := native.SendTx("")
			require.NoError(t, err)
			require.Equal(t, uint64(1), client.SendTransactionCalls()[0].Tx.Nonce())
			records := outgoingTxs(t, native)
			require.Len(t, records, 2)
			for _, record := range records {
				if record.Transaction.Hash() == old.Transaction.Hash() {
					require.True(t, record.NonceConsumed)
					require.Equal(t, old.Height, record.Height)
					require.Equal(t, old.GasUsed, record.GasUsed)
					require.Equal(t, old.Success, record.Success)
					require.Equal(t, old.LastReceiptCheckHeight, record.LastReceiptCheckHeight)
				}
			}
			// Receipt failures must still surface for transactions whose nonces remain outstanding.
			_, err = native.updateOutgoingTransactions(101)
			require.ErrorIs(t, err, receiptErr)
		})
	}
}

func TestReconciledNonceSelection(t *testing.T) {
	native, _ := sharedAccounts(t)
	client := newTransactionRPCClient(7, 21000, big.NewInt(1), nil)
	native.coin.client = client
	old := newTestOutgoingTxData()
	old.Nonce = 7
	putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: types.NewTx(old)})
	client.TransactionReceiptWithBlockNumberFunc = func(context.Context, common.Hash) (*types.Receipt, error) {
		return &types.Receipt{BlockNumber: big.NewInt(99), GasUsed: 21000, Status: types.ReceiptStatusSuccessful}, nil
	}
	// The confirmed nonce must override stale pending state, and can decrease after a reorg.
	for _, confirmed := range []uint64{10, 8} {
		client.NonceAtFunc = func(context.Context, common.Address, *big.Int) (uint64, error) { return confirmed, nil }
		nonce, err := native.nextNonce()
		require.NoError(t, err)
		require.Equal(t, confirmed, nonce)
	}
	setTransactionSigningKeystore(t, native, native.coin.ChainID())
	native.activeTxProposal = &pendingTxProposal{txData: newTestOutgoingTxData()}
	_, err := native.SendTx("")
	require.NoError(t, err)
	require.Equal(t, uint64(8), client.SendTransactionCalls()[0].Tx.Nonce())
}

func TestNonceAfterPruningReorg(t *testing.T) {
	native, _ := sharedAccounts(t)
	client := newTransactionRPCClient(1, 21000, big.NewInt(1), nil)
	native.coin.client = client
	putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: newTestOutgoingTx()})
	client.NonceAtFunc = func(context.Context, common.Address, *big.Int) (uint64, error) { return 2, nil }
	client.TransactionReceiptWithBlockNumberFunc = func(context.Context, common.Hash) (*types.Receipt, error) {
		return &types.Receipt{BlockNumber: big.NewInt(90), GasUsed: 21000, Status: types.ReceiptStatusSuccessful}, nil
	}
	records, err := native.updateOutgoingTransactions(101)
	require.NoError(t, err)
	native.blockNumber = big.NewInt(101)
	confirmed := records[0].TransactionData(101, nil, native.address.Hex())
	_, _, err = native.outgoingTransactions([]*accounts.TransactionData{confirmed}, records)
	require.NoError(t, err)
	require.Empty(t, outgoingTxs(t, native))

	// A recent external payment is reorged out after the last local record was pruned.
	client.NonceAtFunc = func(context.Context, common.Address, *big.Int) (uint64, error) { return 1, nil }
	client.BlockNumberFunc = func(context.Context) (*big.Int, error) { return big.NewInt(102), nil }
	nonce, err := native.nextNonce()
	require.NoError(t, err)
	require.Equal(t, uint64(1), nonce)
}

func TestFinalRecordsSkipLookups(t *testing.T) {
	native, _ := sharedAccounts(t)
	// The pending nonce is stale and would reuse the final record's nonce.
	client := newTransactionRPCClient(7, 21000, big.NewInt(1), nil)
	native.coin.client = client
	tx := newTestOutgoingTxData()
	tx.Nonce = 7
	putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{
		Transaction: types.NewTx(tx), Height: 80, LastReceiptCheckHeight: 99,
	})
	nonce, err := native.nextNonce()
	require.NoError(t, err)
	require.Equal(t, uint64(8), nonce)
	require.Empty(t, client.NonceAtCalls())
	require.Empty(t, client.TransactionReceiptWithBlockNumberCalls())
}

type updaterBalanceFetcher struct {
	rpcclient.Interface
	balances func(context.Context, []common.Address, *big.Int) (map[common.Address]*big.Int, error)
}

func (fetcher updaterBalanceFetcher) Balances(ctx context.Context, addresses []common.Address, block *big.Int) (map[common.Address]*big.Int, error) {
	return fetcher.balances(ctx, addresses, block)
}

func TestUpdateBalanceAtConfirmation(t *testing.T) {
	native, token := sharedAccounts(t)
	client := newTransactionRPCClient(1, 21000, big.NewInt(1), nil)
	native.coin.client, token.coin.client = client, client
	notifier := &accountmocks.Notifier{}
	notifier.On("Put", mock.Anything).Return(nil)
	native.notifier, token.notifier = notifier, notifier
	tx := newTestOutgoingTxData()
	tx.Value = big.NewInt(59000) // 80000 debit including gas.
	putOutgoingTx(t, native, &ethtypes.TransactionWithMetadata{Transaction: types.NewTx(tx)})
	tip := int64(99)
	client.BlockNumberFunc = func(context.Context) (*big.Int, error) { return big.NewInt(tip), nil }
	client.NonceAtFunc = func(_ context.Context, _ common.Address, block *big.Int) (uint64, error) {
		if block.Int64() >= 100 {
			return 1, nil
		}
		return 0, nil
	}
	client.TransactionReceiptWithBlockNumberFunc = func(context.Context, common.Hash) (*types.Receipt, error) {
		return &types.Receipt{BlockNumber: big.NewInt(100), GasUsed: 21000, Status: types.ReceiptStatusSuccessful}, nil
	}
	fetcher := updaterBalanceFetcher{Interface: client, balances: func(_ context.Context, _ []common.Address, block *big.Int) (map[common.Address]*big.Int, error) {
		tip = 100 // The debit confirms between the tip and balance requests.
		balance := int64(100000)
		if block.Int64() >= 100 {
			balance = 20000
		}
		return map[common.Address]*big.Int{native.address.Address: big.NewInt(balance)}, nil
	}}
	client.ERC20BalanceFunc = func(common.Address, *erc20.Token, *big.Int) (*big.Int, error) {
		// A send-time refresh advances the shared state after the updater took its snapshot.
		reconcileOutgoing(t, native, 100)
		return big.NewInt(1000), nil
	}
	updater := NewUpdater(nil, nil, nil, nil)
	defer updater.Close()
	for range 2 {
		updater.UpdateBalancesAndBlockNumber([]*Account{token, native}, fetcher)
		require.NoError(t, native.Offline())
		balance, err := native.Balance()
		require.NoError(t, err)
		require.Equal(t, big.NewInt(20000), balance.Available().BigInt())
	}
}
