package transactions_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	addressesTest "github.com/shiftdevices/godbb/deterministicwallet/addresses/test"
	blockchainMock "github.com/shiftdevices/godbb/deterministicwallet/blockchain/mocks"
	"github.com/shiftdevices/godbb/deterministicwallet/synchronizer"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type BlockchainMock struct {
	blockchainMock.InterfaceMock
	transactions            map[chainhash.Hash]*wire.MsgTx
	transactionGetCallbacks []func()
}

func NewBlockchainMock() *BlockchainMock {
	blockchainMock := &BlockchainMock{
		transactions:            map[chainhash.Hash]*wire.MsgTx{},
		transactionGetCallbacks: []func(){},
	}
	return blockchainMock
}

func (blockchain *BlockchainMock) CallTransactionGetCallbacks() {
	callbacks := blockchain.transactionGetCallbacks
	blockchain.transactionGetCallbacks = []func(){}
	for _, callback := range callbacks {
		callback()
	}
}

func (blockchain *BlockchainMock) RegisterTxs(txs ...*wire.MsgTx) {
	for _, tx := range txs {
		blockchain.transactions[tx.TxHash()] = tx
	}
}

// TransactionGet by default automatically calls the callback which processes the tx. Overwrite
// default behavior by setting the TransactionGetFunc var.
func (blockchain *BlockchainMock) TransactionGet(
	txHash chainhash.Hash,
	success func(*wire.MsgTx) error,
	cleanup func(error)) error {
	if blockchain.InterfaceMock.TransactionGetFunc != nil {
		return blockchain.InterfaceMock.TransactionGet(txHash, success, cleanup)
	}
	tx, ok := blockchain.transactions[txHash]
	if !ok {
		panic("you need to first register the transaction with the mock backend")
	}
	blockchain.transactionGetCallbacks = append(blockchain.transactionGetCallbacks,
		func() {
			cleanup(success(tx))
		})
	return nil
}

type transactionsSuite struct {
	suite.Suite

	net            *chaincfg.Params
	addressChain   *addresses.AddressChain
	synchronizer   *synchronizer.Synchronizer
	blockchainMock *BlockchainMock
	transactions   *transactions.Transactions
}

func (s *transactionsSuite) SetupTest() {
	s.net = &chaincfg.TestNet3Params

	s.addressChain = addressesTest.NewAddressChain()
	s.synchronizer = synchronizer.NewSynchronizer(func() {}, func() {})
	s.blockchainMock = NewBlockchainMock()
	s.transactions = transactions.NewTransactions(
		s.net,
		s.synchronizer,
		s.blockchainMock,
	)
}

func TestTransactionsSuite(t *testing.T) {
	suite.Run(t, &transactionsSuite{})
}

func (s *transactionsSuite) updateAddressHistory(address btcutil.Address, txs []*client.TxInfo) {
	s.transactions.UpdateAddressHistory(address, txs)
	s.blockchainMock.CallTransactionGetCallbacks()
}

func newTx(
	fromTxHash chainhash.Hash,
	fromTxIndex uint32,
	toAddress *addresses.Address,
	amount btcutil.Amount) *wire.MsgTx {
	return &wire.MsgTx{
		Version:  wire.TxVersion,
		TxIn:     []*wire.TxIn{wire.NewTxIn(&wire.OutPoint{fromTxHash, fromTxIndex}, nil, nil)},
		TxOut:    []*wire.TxOut{wire.NewTxOut(int64(amount), toAddress.PkScript())},
		LockTime: 0,
	}
}

// TestUpdateAddressHistorySyncStatus checks that the synchronizer is calling the
// syncStart/syncFinished callbacks once in the beginning and once after all transactions have
// processed.
func (s *transactionsSuite) TestUpdateAddressHistorySyncStatus() {
	addresses := s.addressChain.EnsureAddresses()
	address := addresses[0]
	expectedAmount := btcutil.Amount(123)
	tx1 := newTx(chainhash.HashH(nil), 0, address, expectedAmount)
	tx2 := newTx(chainhash.HashH(nil), 1, address, expectedAmount)
	txs := map[chainhash.Hash]*wire.MsgTx{
		tx1.TxHash(): tx1,
		tx2.TxHash(): tx2,
	}
	txCallbacks := map[chainhash.Hash]func(){}
	s.blockchainMock.TransactionGetFunc = func(
		txHash chainhash.Hash,
		success func(*wire.MsgTx) error,
		cleanup func(error)) error {
		txCallbacks[txHash] = func() {
			cleanup(success(txs[txHash]))
		}
		return nil
	}
	var syncStarted, syncFinished bool
	onSyncStarted := func() {
		if syncStarted {
			require.FailNow(s.T(), "sync started twice")
		}
		syncStarted = true
	}
	onSyncFinished := func() {
		if syncFinished {
			require.FailNow(s.T(), "sync finished twice")
		}
		syncFinished = true
	}
	*s.synchronizer = *synchronizer.NewSynchronizer(onSyncStarted, onSyncFinished)
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 10},
	})
	require.True(s.T(), syncStarted)
	require.False(s.T(), syncFinished)
	txCallbacks[tx1.TxHash()]()
	require.True(s.T(), syncStarted)
	require.False(s.T(), syncFinished)
	txCallbacks[tx2.TxHash()]()
	require.True(s.T(), syncStarted)
	require.True(s.T(), syncFinished)
}

// TestUpdateAddressHistorySingleTxReceive receives a single confirmed tx for a single address.
func (s *transactionsSuite) TestUpdateAddressHistorySingleTxReceive() {
	addresses := s.addressChain.EnsureAddresses()
	address := addresses[0]
	expectedAmount := btcutil.Amount(123)
	tx1 := newTx(chainhash.HashH(nil), 0, address, expectedAmount)
	s.blockchainMock.RegisterTxs(tx1)
	expectedHeight := 10
	s.updateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: expectedHeight},
	})
	require.Equal(s.T(),
		&transactions.Balance{Confirmed: expectedAmount, Unconfirmed: 0},
		s.transactions.Balance(),
	)
	utxo := &transactions.TxOut{
		TxOut:   wire.NewTxOut(int64(expectedAmount), address.PkScript()),
		Address: address,
	}
	require.Equal(s.T(),
		map[wire.OutPoint]*transactions.TxOut{
			wire.OutPoint{Hash: tx1.TxHash(), Index: 0}: utxo,
		},
		s.transactions.SpendableOutputs(),
	)
	transactions := s.transactions.Transactions(func(btcutil.Address) bool { return false })
	require.Len(s.T(), transactions, 1)
	require.Equal(s.T(), tx1, transactions[0].TX)
	require.Equal(s.T(), expectedHeight, transactions[0].Height)
}

// TestUpdateAddressHistoryOppositeOrder checks that a spend is correctly recognized even if the
// transactions in the history of an address are processed in the wrong order. If the spending tx is
// processed before the funding tx, the output is unknown when processing the funds, but after the
// output has been added, the input spending it needs to be indexed correctly.
func (s *transactionsSuite) TestUpdateAddressHistoryOppositeOrder() {
	addresses := s.addressChain.EnsureAddresses()
	address := addresses[0]
	address2 := addresses[1]
	tx1 := newTx(chainhash.HashH(nil), 0, address, 123)
	tx2 := newTx(tx1.TxHash(), 0, address2, 123)
	txs := map[chainhash.Hash]*wire.MsgTx{
		tx1.TxHash(): tx1,
		tx2.TxHash(): tx2,
	}
	txCallbacks := map[chainhash.Hash]func(){}
	s.blockchainMock.TransactionGetFunc = func(
		txHash chainhash.Hash,
		success func(*wire.MsgTx) error,
		cleanup func(error)) error {
		txCallbacks[txHash] = func() {
			cleanup(success(txs[txHash]))
		}
		return nil
	}
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
	})
	f1 := txCallbacks[tx1.TxHash()]
	f2 := txCallbacks[tx2.TxHash()]
	// Process tx2 (the spend) before tx1 (the funding). This should result in a zero balance, as
	// the received funds are spent.
	f2()
	f1()
	require.Equal(s.T(),
		&transactions.Balance{Confirmed: 0, Unconfirmed: 0},
		s.transactions.Balance(),
	)
}

// TestSpendableOutputs checks that the utxo set is correct. Only confirmed (or unconfirmed outputs
// we own) outputs can be spent.
func (s *transactionsSuite) TestSpendableOutputs() {
	// Starts out empty.
	require.Empty(s.T(), s.transactions.SpendableOutputs())
	addresses := s.addressChain.EnsureAddresses()
	address1 := addresses[0]
	address2 := addresses[1]
	// address not belonging to the wallet.
	otherAddress := addresses[2]
	// Index a set of two funding tx (confirmed, unconfirmed) for two addresses.
	tx11 := newTx(chainhash.HashH(nil), 0, address1, 1000)
	tx12 := newTx(chainhash.HashH(nil), 1, address1, 2000)
	tx21 := newTx(chainhash.HashH(nil), 2, address2, 3000)
	tx22 := newTx(chainhash.HashH(nil), 3, address2, 4000)
	s.blockchainMock.RegisterTxs(tx11, tx12, tx21, tx22)
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx11.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx12.TxHash()), Height: 10},
	})
	s.updateAddressHistory(address2, []*client.TxInfo{
		{TXHash: client.TXHash(tx21.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx22.TxHash()), Height: 10},
	})

	spendableOutputs := s.transactions.SpendableOutputs()
	// Two confirmed txs.
	require.Len(s.T(), spendableOutputs, 2)
	require.Contains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx12.TxHash(), Index: 0})
	require.Contains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Spend output generated from tx12 to an external address, the spend being unconfirmed => the
	// output can't be spent anymore.
	tx12_spend := newTx(tx12.TxHash(), 0, otherAddress, 1000)
	s.blockchainMock.RegisterTxs(tx12_spend)
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx11.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx12.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx12_spend.TxHash()), Height: 0},
	})
	spendableOutputs = s.transactions.SpendableOutputs()
	require.Len(s.T(), spendableOutputs, 1)
	require.NotContains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx12.TxHash(), Index: 0})
	require.Contains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Send output generated from tx22 to an internal address, unconfirmed. The new output needs to
	// be spendable, as it is our own.
	tx22_spend := newTx(tx22.TxHash(), 0, address2, 4000)
	s.blockchainMock.RegisterTxs(tx22_spend)
	s.updateAddressHistory(address2, []*client.TxInfo{
		{TXHash: client.TXHash(tx21.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx22.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx22_spend.TxHash()), Height: 0},
	})
	spendableOutputs = s.transactions.SpendableOutputs()
	require.Len(s.T(), spendableOutputs, 1)
	// tx22 spent, not available anymore
	require.NotContains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Output from the spend tx address available.
	require.Contains(s.T(), spendableOutputs, wire.OutPoint{Hash: tx22_spend.TxHash(), Index: 0})
}
