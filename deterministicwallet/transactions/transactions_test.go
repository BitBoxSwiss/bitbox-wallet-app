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
	transactionGetCallbacks map[chainhash.Hash]func()
}

func NewBlockchainMock() *BlockchainMock {
	return &BlockchainMock{
		transactions:            map[chainhash.Hash]*wire.MsgTx{},
		transactionGetCallbacks: map[chainhash.Hash]func(){},
	}
}

func (blockchain *BlockchainMock) RegisterTxs(txs ...*wire.MsgTx) {
	for _, tx := range txs {
		blockchain.transactions[tx.TxHash()] = tx
	}
}

func (blockchain *BlockchainMock) TransactionGet(
	txHash chainhash.Hash,
	success func(*wire.MsgTx) error,
	cleanup func(error)) error {
	tx, ok := blockchain.transactions[txHash]
	if !ok {
		panic("you need to first register the transaction with the mock backend")
	}
	_, ok = blockchain.transactionGetCallbacks[txHash]
	if ok {
		panic("TransactionGet() called twice for the same transaction; failure in caching in the production code")
	}
	called := false
	blockchain.transactionGetCallbacks[txHash] = func() {
		if called {
			panic("only one call allowed")
		}
		called = true
		cleanup(success(tx))
	}
	return nil
}

func (blockchain *BlockchainMock) TransactionGetCallback(tx *wire.MsgTx) func() {
	return blockchain.transactionGetCallbacks[tx.TxHash()]
}

type transactionsSuite struct {
	suite.Suite

	net            *chaincfg.Params
	synchronizer   *synchronizer.Synchronizer
	blockchainMock *BlockchainMock
	transactions   *transactions.Transactions
}

func (s *transactionsSuite) SetupTest() {
	s.net = &chaincfg.TestNet3Params

	s.synchronizer = synchronizer.NewSynchronizer(func() {}, func() {})
	s.blockchainMock = NewBlockchainMock()
	s.transactions = transactions.NewTransactions(
		s.net,
		s.synchronizer,
		s.blockchainMock,
		func(btcutil.Address) bool { return false },
	)
}

func TestTransactionsSuite(t *testing.T) {
	suite.Run(t, &transactionsSuite{})
}

func newTx(fromTxHash chainhash.Hash, fromTxIndex uint32, toAddress *addresses.Address) *wire.MsgTx {
	return &wire.MsgTx{
		Version:  wire.TxVersion,
		TxIn:     []*wire.TxIn{wire.NewTxIn(&wire.OutPoint{fromTxHash, fromTxIndex}, nil, nil)},
		TxOut:    []*wire.TxOut{wire.NewTxOut(123, toAddress.PkScript())},
		LockTime: 0,
	}
}

// TestUpdateAddressHistoryOppositeOrder checks that a spend is correctly recognized even if the
// transactions in the history of an address are processed in the wrong order. If the spending tx is
// processed before the funding tx, the output is unknown when processing the funds, but after the
// output has been added, the input spending it needs to be indexed correctly.
func (s *transactionsSuite) TestUpdateAddressHistoryOppositeOrder() {
	addresses := addressesTest.NewAddressChain().EnsureAddresses()
	address := addresses[0]
	address2 := addresses[1]
	tx1 := newTx(chainhash.HashH(nil), 0, address)
	tx2 := newTx(tx1.TxHash(), 0, address2)
	s.blockchainMock.RegisterTxs(tx1, tx2)
	s.transactions.UpdateAddressHistory(address, []*client.TxInfo{
		{TXHash: client.TXHash(tx1.TxHash()), Height: 0},
		{TXHash: client.TXHash(tx2.TxHash()), Height: 0},
	})
	f1 := s.blockchainMock.TransactionGetCallback(tx1)
	f2 := s.blockchainMock.TransactionGetCallback(tx2)
	// Process tx2 (the spend) before tx1 (the funding). This should result in a zero balance, as
	// the received funds are spent.
	go func() { f2(); f1() }()
	balance := s.transactions.Balance()
	require.Equal(s.T(), &transactions.Balance{Confirmed: 0, Unconfirmed: 0}, balance)
}
