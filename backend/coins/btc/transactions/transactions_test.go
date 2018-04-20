package transactions_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	addressesTest "github.com/shiftdevices/godbb/backend/coins/btc/addresses/test"
	blockchainMock "github.com/shiftdevices/godbb/backend/coins/btc/blockchain/mocks"
	"github.com/shiftdevices/godbb/backend/coins/btc/db"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	headersMock "github.com/shiftdevices/godbb/backend/coins/btc/headers/mocks"
	"github.com/shiftdevices/godbb/backend/coins/btc/synchronizer"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/test"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type BlockchainMock struct {
	blockchainMock.Interface
	transactions            map[chainhash.Hash]*wire.MsgTx
	transactionGetCallbacks map[chainhash.Hash][]func()
}

func NewBlockchainMock() *BlockchainMock {
	blockchainMock := &BlockchainMock{
		transactions:            map[chainhash.Hash]*wire.MsgTx{},
		transactionGetCallbacks: map[chainhash.Hash][]func(){},
	}
	return blockchainMock
}

func (blockchain *BlockchainMock) CallTransactionGetCallbacks(txHash chainhash.Hash) {
	callbacks := blockchain.transactionGetCallbacks[txHash]
	delete(blockchain.transactionGetCallbacks, txHash)
	for _, callback := range callbacks {
		callback()
	}
}

func (blockchain *BlockchainMock) CallAllTransactionGetCallbacks() {
	for txHash := range blockchain.transactionGetCallbacks {
		blockchain.CallTransactionGetCallbacks(txHash)
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
	cleanup func()) error {
	tx, ok := blockchain.transactions[txHash]
	if !ok {
		panic("you need to first register the transaction with the mock backend")
	}
	callbacks, ok := blockchain.transactionGetCallbacks[txHash]
	if !ok {
		callbacks = []func(){}
	}
	blockchain.transactionGetCallbacks[txHash] = append(callbacks,
		func() {
			defer cleanup()
			if err := success(tx); err != nil {
				panic(err)
			}
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

	log *logrus.Entry
}

func (s *transactionsSuite) SetupTest() {
	s.net = &chaincfg.TestNet3Params
	s.log = logging.Log.WithGroup("transactions_test")

	s.addressChain = addressesTest.NewAddressChain()
	s.synchronizer = synchronizer.NewSynchronizer(func() {}, func() {}, s.log)
	s.blockchainMock = NewBlockchainMock()
	db, err := db.NewDB(test.TstTempFile("godbb-db-"))
	if err != nil {
		panic(err)
	}
	headersMock := &headersMock.Interface{}
	headersMock.On("SubscribeEvent", mock.AnythingOfType("func(headers.Event)")).Return()
	s.transactions = transactions.NewTransactions(
		s.net,
		db.SubDB("test", s.log),
		headersMock,
		s.synchronizer,
		s.blockchainMock,
		s.log,
	)
}

func TestTransactionsSuite(t *testing.T) {
	suite.Run(t, &transactionsSuite{})
}

func (s *transactionsSuite) updateAddressHistory(address btcutil.Address, txs []*client.TxInfo) {
	s.transactions.UpdateAddressHistory(address, txs)
	s.blockchainMock.CallAllTransactionGetCallbacks()
}

func newTx(
	fromTxHash chainhash.Hash,
	fromTxIndex uint32,
	toAddress *addresses.Address,
	amount btcutil.Amount) *wire.MsgTx {
	return &wire.MsgTx{
		Version: wire.TxVersion,
		TxIn: []*wire.TxIn{
			wire.NewTxIn(&wire.OutPoint{Hash: fromTxHash, Index: fromTxIndex}, nil, nil),
		},
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
	s.blockchainMock.RegisterTxs(tx1, tx2)
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
	*s.synchronizer = *synchronizer.NewSynchronizer(onSyncStarted, onSyncFinished, s.log)
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 10},
	})
	require.True(s.T(), syncStarted)
	require.False(s.T(), syncFinished)
	s.blockchainMock.CallTransactionGetCallbacks(tx1.TxHash())
	require.True(s.T(), syncStarted)
	require.False(s.T(), syncFinished)
	s.blockchainMock.CallTransactionGetCallbacks(tx2.TxHash())
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
		&transactions.Balance{Available: expectedAmount, Incoming: 0},
		s.transactions.Balance(),
	)
	utxo := &transactions.TxOut{
		TxOut: wire.NewTxOut(int64(expectedAmount), address.PkScript()),
	}
	require.Equal(s.T(),
		map[wire.OutPoint]*transactions.TxOut{
			wire.OutPoint{Hash: tx1.TxHash(), Index: 0}: utxo,
		},
		s.transactions.SpendableOutputs(),
	)
	transactions := s.transactions.Transactions(func(client.ScriptHashHex) bool { return false })
	require.Len(s.T(), transactions, 1)
	require.Equal(s.T(), tx1, transactions[0].Tx)
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
	s.blockchainMock.RegisterTxs(tx1, tx2)
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
	})
	// Process tx2 (the spend) before tx1 (the funding). This should result in a zero balance, as
	// the received funds are spent.
	s.blockchainMock.CallTransactionGetCallbacks(tx2.TxHash())
	s.blockchainMock.CallTransactionGetCallbacks(tx1.TxHash())
	require.Equal(s.T(),
		&transactions.Balance{Available: 0, Incoming: 0},
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

func (s *transactionsSuite) TestBalance() {
	require.Equal(s.T(), &transactions.Balance{Available: 0, Incoming: 0}, s.transactions.Balance())
	addresses := s.addressChain.EnsureAddresses()
	address1 := addresses[0]
	otherAddress := addresses[2]
	expectedAmount := btcutil.Amount(123)
	tx1 := newTx(chainhash.HashH(nil), 0, address1, expectedAmount)
	tx1_spend := newTx(tx1.TxHash(), 0, otherAddress, expectedAmount)
	expectedAmount2 := btcutil.Amount(456)
	tx2 := newTx(chainhash.HashH(nil), 1, address1, expectedAmount2)
	tx2_spend := newTx(tx2.TxHash(), 0, address1, expectedAmount2)
	s.blockchainMock.RegisterTxs(tx1, tx1_spend, tx2, tx2_spend)
	// Incoming.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 0},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 0, Incoming: expectedAmount},
		s.transactions.Balance())
	// Confirm it, plus another one incoming.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: expectedAmount, Incoming: expectedAmount2},
		s.transactions.Balance())
	// Spend funds that came from tx1, first unconfirmed. Available balance decreases.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx1_spend.TxHash()), Height: 0},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 0, Incoming: expectedAmount2},
		s.transactions.Balance())
	// Confirm it.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx1_spend.TxHash()), Height: 10},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 0, Incoming: expectedAmount2},
		s.transactions.Balance())
	// Spend the unconfirmed incoming tx to an internal address, unconfirmed (can't confirm until
	// the first one is). The funds are still available as we own the unconfirmed output.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx1_spend.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx2_spend.TxHash()), Height: 0},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: expectedAmount2, Incoming: 0},
		s.transactions.Balance())
}

func (s *transactionsSuite) TestRemoveTransaction() {
	addresses := s.addressChain.EnsureAddresses()
	address1 := addresses[0]
	address2 := addresses[1]
	tx1 := newTx(chainhash.HashH(nil), 0, address1, 12)
	tx2 := newTx(chainhash.HashH(nil), 1, address2, 34)
	// tx3 touches both address1 and address2. It also spends the output of tx1.
	tx3 := newTx(tx1.TxHash(), 0, address1, 2)
	tx3.TxOut = append(tx3.TxOut, wire.NewTxOut(10, address2.PkScript()))
	s.blockchainMock.RegisterTxs(tx1, tx2, tx3)
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx3.TxHash()), Height: 10},
	})
	s.updateAddressHistory(address2, []*client.TxInfo{
		{TXHash: client.TXHash(tx2.TxHash()), Height: 10},
		{TXHash: client.TXHash(tx3.TxHash()), Height: 10},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 2 + 10 + 34, Incoming: 0},
		s.transactions.Balance())
	// Remove tx3 from the history of address1. It is still referenced by address2, so the index
	// does not change.
	s.updateAddressHistory(address1, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 10},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 2 + 10 + 34, Incoming: 0},
		s.transactions.Balance())
	require.Len(s.T(),
		s.transactions.Transactions(func(client.ScriptHashHex) bool { return false }),
		3)
	// Remove tx3 from the history of address2. Now it's not referenced anymore and disappears.
	s.updateAddressHistory(address2, []*client.TxInfo{
		{TXHash: client.TXHash(tx2.TxHash()), Height: 10},
	})
	require.Equal(s.T(),
		&transactions.Balance{Available: 12 + 34, Incoming: 0},
		s.transactions.Balance())
	require.Len(s.T(),
		s.transactions.Transactions(func(client.ScriptHashHex) bool { return false }),
		2)
}

// TestRemoveTransactionPendingDownload tests that a tx can be removed from the address history
// while it is still pending to be indexed.
func (s *transactionsSuite) TestRemoveTransactionPendingDownload() {
	address := s.addressChain.EnsureAddresses()[0]
	tx := newTx(chainhash.HashH(nil), 0, address, 123)
	s.blockchainMock.RegisterTxs(tx)
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx.TxHash()), Height: 0},
	})
	// Callback for processing the tx is not called yet. We remove the tx.
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{})
	// Process the tx now. It should not be indexed anymore.
	s.blockchainMock.CallAllTransactionGetCallbacks()
	require.Equal(s.T(),
		&transactions.Balance{Available: 0, Incoming: 0},
		s.transactions.Balance())
	require.Empty(s.T(),
		s.transactions.Transactions(func(client.ScriptHashHex) bool { return false }))
}
