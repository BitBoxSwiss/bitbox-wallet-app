// SPDX-License-Identifier: Apache-2.0

package transactions_test

import (
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	addressesTest "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	blockchainpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	headersMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/headers/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

func TestMain(m *testing.M) {
	test.TstSetupLogging()
	os.Exit(m.Run())
}

type BlockchainMock struct {
	blockchainMock.Interface
	transactions map[chainhash.Hash]*wire.MsgTx
}

func NewBlockchainMock() *BlockchainMock {
	blockchainMock := &BlockchainMock{
		transactions: map[chainhash.Hash]*wire.MsgTx{},
	}
	return blockchainMock
}

func (blockchain *BlockchainMock) RegisterTxs(txs ...*wire.MsgTx) {
	for _, tx := range txs {
		blockchain.transactions[tx.TxHash()] = tx
	}
}

// TransactionGet by default automatically calls the callback which processes the tx. Overwrite
// default behavior by setting the TransactionGetFunc var.
func (blockchain *BlockchainMock) TransactionGet(txHash chainhash.Hash) (*wire.MsgTx, error) {
	tx, ok := blockchain.transactions[txHash]
	if !ok {
		panic("you need to first register the transaction with the mock backend")
	}
	return tx, nil
}

func (blockchain *BlockchainMock) Headers(startHeight int, count int) (*blockchainpkg.HeadersResult, error) {
	headers := make([]*wire.BlockHeader, 0, count)
	for i := 0; i < count; i++ {
		headers = append(headers, &wire.BlockHeader{
			Timestamp: time.Unix(int64(startHeight+i), 0),
		})
	}
	return &blockchainpkg.HeadersResult{
		Headers: headers,
		Max:     count,
	}, nil
}

func (blockchain *BlockchainMock) ConnectionError() error {
	return nil
}

type transactionsSuite struct {
	suite.Suite

	net            *chaincfg.Params
	addressChain   *addresses.AddressChain
	synchronizer   *synchronizer.Synchronizer
	blockchainMock *BlockchainMock
	headersMock    *headersMock.Interface
	notifierMock   *accountsMock.Notifier
	transactions   *transactions.Transactions

	log *logrus.Entry
}

func (s *transactionsSuite) SetupTest() {
	s.net = &chaincfg.TestNet3Params
	s.log = logging.Get().WithGroup("transactions_test")

	_, s.addressChain = addressesTest.NewAddressChain(
		func(address *addresses.AccountAddress) (bool, error) {
			return false, nil
		},
	)
	s.synchronizer = synchronizer.NewSynchronizer(func() {}, s.log)
	s.blockchainMock = NewBlockchainMock()
	db, err := transactionsdb.NewDB(test.TstTempFile("bitbox-wallet-db-"))
	if err != nil {
		panic(err)
	}
	s.headersMock = &headersMock.Interface{}
	s.headersMock.On("SubscribeEvent", mock.AnythingOfType("func(headers.Event)")).Return(func() {})
	s.headersMock.On("TipHeight").Return(15).Once()
	s.headersMock.On("HeaderByHeight", mock.Anything).Return((*wire.BlockHeader)(nil), nil)
	s.notifierMock = &accountsMock.Notifier{}
	s.transactions = transactions.NewTransactions(
		s.net,
		db,
		s.headersMock,
		s.synchronizer,
		s.blockchainMock,
		s.notifierMock,
		s.log,
	)
}

func TestTransactionsSuite(t *testing.T) {
	suite.Run(t, &transactionsSuite{})
}

func (s *transactionsSuite) updateAddressHistory(
	address *addresses.AccountAddress, txs []*blockchainpkg.TxInfo) {
	for _, tx := range txs {
		s.notifierMock.On("Put", tx.TXHash[:]).Return(nil).Once()
	}

	s.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), txs)
}

func newTx(
	fromTxHash chainhash.Hash,
	fromTxIndex uint32,
	toAddress *addresses.AccountAddress,
	amount btcutil.Amount) *wire.MsgTx {
	return &wire.MsgTx{
		Version: wire.TxVersion,
		TxIn: []*wire.TxIn{
			wire.NewTxIn(&wire.OutPoint{Hash: fromTxHash, Index: fromTxIndex}, nil, nil),
		},
		TxOut:    []*wire.TxOut{wire.NewTxOut(int64(amount), toAddress.PubkeyScript())},
		LockTime: 0,
	}
}

func newBalance(available, incoming btcutil.Amount) *accounts.Balance {
	return accounts.NewBalance(
		coin.NewAmountFromInt64(int64(available)),
		coin.NewAmountFromInt64(int64(incoming)),
	)
}

// TestUpdateAddressHistorySingleTxReceive receives a single confirmed tx for a single address.
func (s *transactionsSuite) TestUpdateAddressHistorySingleTxReceive() {
	addresses, err := s.addressChain.EnsureAddresses()
	s.Require().NoError(err)
	address := addresses[0]
	expectedAmount := btcutil.Amount(123)
	tx1 := newTx(chainhash.HashH(nil), 0, address, expectedAmount)
	s.blockchainMock.RegisterTxs(tx1)
	const expectedHeight = 10
	expectedTimestamp := time.Unix(expectedHeight, 0)
	s.headersMock.On("VerifiedHeaderByHeight", expectedHeight).Return(nil, nil).Once()
	s.updateAddressHistory(address, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: expectedHeight},
	})
	balance, err := s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(expectedAmount, 0), balance)
	utxo := &transactions.SpendableOutput{
		TxOut: wire.NewTxOut(int64(expectedAmount), address.PubkeyScript()),
	}
	spendableOutputs, err := s.transactions.SpendableOutputs()
	s.Require().NoError(err)
	expected := map[wire.OutPoint]*wire.TxOut{
		{Hash: tx1.TxHash(), Index: 0}: utxo.TxOut,
	}
	actual := make(map[wire.OutPoint]*wire.TxOut)
	for outpoint, spendable := range spendableOutputs {
		actual[outpoint] = spendable.TxOut
	}
	s.Require().Equal(expected, actual)
	outPoint := wire.OutPoint{Hash: tx1.TxHash(), Index: 0}
	s.Require().Contains(spendableOutputs, outPoint)
	s.Require().NotNil(spendableOutputs[outPoint].HeaderTimestamp)
	s.Require().Equal(expectedTimestamp.UnixNano(), spendableOutputs[outPoint].HeaderTimestamp.UnixNano())
	transactions, err := s.transactions.Transactions(func(blockchainpkg.ScriptHashHex) bool { return false })
	s.Require().NoError(err)
	s.Require().Len(transactions, 1)
	s.Require().Equal(expectedHeight, transactions[0].Height)
	s.Require().NotNil(transactions[0].Timestamp)
	s.Require().Equal(expectedTimestamp.UnixNano(), transactions[0].Timestamp.UnixNano())
}

// TestSpendableOutputs checks that the utxo set is correct. Only confirmed (or unconfirmed outputs
// we own) outputs can be spent.
func (s *transactionsSuite) TestSpendableOutputs() {
	// Starts out empty.
	spendableOutputs, err := s.transactions.SpendableOutputs()
	s.Require().NoError(err)
	s.Require().Empty(spendableOutputs)
	addresses, err := s.addressChain.EnsureAddresses()
	s.Require().NoError(err)
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
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Once()
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx11.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx12.TxHash()), Height: 10},
	})
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Once()
	s.updateAddressHistory(address2, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx21.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx22.TxHash()), Height: 10},
	})

	spendableOutputs, err = s.transactions.SpendableOutputs()
	s.Require().NoError(err)
	// Two confirmed txs.
	s.Require().Len(spendableOutputs, 2)
	s.Require().Contains(spendableOutputs, wire.OutPoint{Hash: tx12.TxHash(), Index: 0})
	s.Require().Contains(spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Spend output generated from tx12 to an external address, the spend being unconfirmed => the
	// output can't be spent anymore.
	tx12Spend := newTx(tx12.TxHash(), 0, otherAddress, 1000)
	s.blockchainMock.RegisterTxs(tx12Spend)
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx11.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx12.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx12Spend.TxHash()), Height: 0},
	})
	spendableOutputs, err = s.transactions.SpendableOutputs()
	s.Require().NoError(err)
	s.Require().Len(spendableOutputs, 1)
	s.Require().NotContains(spendableOutputs, wire.OutPoint{Hash: tx12.TxHash(), Index: 0})
	s.Require().Contains(spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Send output generated from tx22 to an internal address, unconfirmed. The new output needs to
	// be spendable, as it is our own.
	tx22Spend := newTx(tx22.TxHash(), 0, address2, 4000)
	s.blockchainMock.RegisterTxs(tx22Spend)
	s.updateAddressHistory(address2, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx21.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx22.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx22Spend.TxHash()), Height: 0},
	})
	spendableOutputs, err = s.transactions.SpendableOutputs()
	s.Require().NoError(err)
	s.Require().Len(spendableOutputs, 1)
	// tx22 spent, not available anymore
	s.Require().NotContains(spendableOutputs, wire.OutPoint{Hash: tx22.TxHash(), Index: 0})
	// Output from the spend tx address available.
	s.Require().Contains(spendableOutputs, wire.OutPoint{Hash: tx22Spend.TxHash(), Index: 0})
}

func (s *transactionsSuite) TestBalance() {
	balance, err := s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(0, 0), balance)
	addresses, err := s.addressChain.EnsureAddresses()
	s.Require().NoError(err)
	address1 := addresses[0]
	otherAddress := addresses[2]
	expectedAmount := btcutil.Amount(123)
	tx1 := newTx(chainhash.HashH(nil), 0, address1, expectedAmount)
	tx1Spend := newTx(tx1.TxHash(), 0, otherAddress, expectedAmount)
	expectedAmount2 := btcutil.Amount(456)
	tx2 := newTx(chainhash.HashH(nil), 1, address1, expectedAmount2)
	tx2Spend := newTx(tx2.TxHash(), 0, address1, expectedAmount2)
	s.blockchainMock.RegisterTxs(tx1, tx1Spend, tx2, tx2Spend)
	// Incoming.
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 0},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(0, expectedAmount), balance)
	// Confirm it, plus another one incoming.
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Once()
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 0},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(expectedAmount, expectedAmount2), balance)
	// Spend funds that came from tx1, first unconfirmed. Available balance decreases.
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx1Spend.TxHash()), Height: 0},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(0, expectedAmount2), balance)
	// Confirm it.
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Once()
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx1Spend.TxHash()), Height: 10},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(0, expectedAmount2), balance)
	// Spend the unconfirmed incoming tx to an internal address, unconfirmed (can't confirm until
	// the first one is). The funds are still available as we own the unconfirmed output.
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 0},
		{TXHash: blockchainpkg.TXHash(tx1Spend.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx2Spend.TxHash()), Height: 0},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(expectedAmount2, 0), balance)
}

func (s *transactionsSuite) TestRemoveTransaction() {
	addresses, err := s.addressChain.EnsureAddresses()
	s.Require().NoError(err)
	address1 := addresses[0]
	address2 := addresses[1]
	tx1 := newTx(chainhash.HashH(nil), 0, address1, 12)
	tx2 := newTx(chainhash.HashH(nil), 1, address2, 34)
	// tx3 touches both address1 and address2. It also spends the output of tx1.
	tx3 := newTx(tx1.TxHash(), 0, address1, 2)
	tx3.TxOut = append(tx3.TxOut, wire.NewTxOut(10, address2.PubkeyScript()))
	s.blockchainMock.RegisterTxs(tx1, tx2, tx3)
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Twice()
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx3.TxHash()), Height: 10},
	})
	s.headersMock.On("VerifiedHeaderByHeight", 10).Return(nil, nil).Once()
	tx1Hash := tx1.TxHash()
	s.notifierMock.On("Delete", tx1Hash[:]).Return(nil).Once()
	s.updateAddressHistory(address2, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 10},
		{TXHash: blockchainpkg.TXHash(tx3.TxHash()), Height: 10},
	})
	balance, err := s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(2+10+34, 0), balance)
	// Remove tx3 from the history of address1. It is still referenced by address2, so the index
	// does not change.
	tx3Hash := tx3.TxHash()
	s.notifierMock.On("Delete", tx3Hash[:]).Return(nil).Once()
	s.updateAddressHistory(address1, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx1.TxHash()), Height: 10},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(2+10+34, 0), balance)
	transactions, err := s.transactions.Transactions(func(blockchainpkg.ScriptHashHex) bool { return false })
	s.Require().NoError(err)
	s.Require().Len(transactions, 3)
	// Remove tx3 from the history of address2. Now it's not referenced anymore and disappears.
	s.updateAddressHistory(address2, []*blockchainpkg.TxInfo{
		{TXHash: blockchainpkg.TXHash(tx2.TxHash()), Height: 10},
	})
	balance, err = s.transactions.Balance()
	s.Require().NoError(err)
	s.Require().Equal(newBalance(12+34, 0), balance)
	transactions, err = s.transactions.Transactions(func(blockchainpkg.ScriptHashHex) bool { return false })
	s.Require().NoError(err)
	s.Require().Len(transactions, 2)
}
