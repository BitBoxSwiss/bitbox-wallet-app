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

// TestUpdateAddressHistoryDuplicateTxs exercises every branch of the switch
// inside UpdateAddressHistory that handles a tx hash appearing twice in the
// server-returned history, plus the downstream dedup that decides what
// actually gets persisted. The switch has four arms:
//
//  1. Both copies confirmed (Height > 0):                error / logrus.Panic
//  2. Mempool first (Height <= 0), then confirmed:       upgrade to confirmed
//  3. Confirmed first, then mempool (Height <= 0):       ignore the mempool copy
//  4. Default (no prior entry, only add):                store the entry
//
// For non-error cases the test additionally pins down the *observable* outcome:
// after the call, Transactions() must return exactly one entry with the
// expected Height, and Balance() must classify that entry as Available (for
// confirmed) or Incoming (for mempool / unconfirmed-parent). This guards the
// downstream-loop dedup contract: case 3 in particular previously appeared
// correct from the switch's perspective while the unfiltered txs slice was
// still being persisted, silently overwriting the confirmed entry with the
// mempool one.
func (s *transactionsSuite) TestUpdateAddressHistoryDuplicateTxs() {
	cases := []struct {
		name string
		// heights is the sequence of Height values returned by the
		// (mock) server for one address — all sharing the same tx hash
		// in the duplicate cases.
		heights []int
		// wantHeight is the Height the test expects to find indexed
		// after UpdateAddressHistory returns. Unused when wantPanic.
		wantHeight int
		wantPanic  bool
	}{
		{
			// Default branch: single new mempool tx, no duplicate.
			name:       "default branch (single mempool tx)",
			heights:    []int{0},
			wantHeight: 0,
		},
		{
			// Default branch: single new confirmed tx, no duplicate.
			name:       "default branch (single confirmed tx)",
			heights:    []int{10},
			wantHeight: 10,
		},
		{
			// Case 2: dedup must upgrade the mempool entry to
			// confirmed.
			name:       "mempool then confirmed",
			heights:    []int{0, 10},
			wantHeight: 10,
		},
		{
			// Case 3: dedup must keep the confirmed entry and
			// discard the mempool one. Before the slice-level
			// dedup, the downstream processTxForAddress loop
			// silently overwrote the confirmed Height with 0.
			name:       "confirmed then mempool",
			heights:    []int{10, 0},
			wantHeight: 10,
		},
		{
			// Case 2 variant: Electrum can return Height == -1 for
			// "unconfirmed with unconfirmed parents". The switch
			// treats Height <= 0 as mempool so the confirmed entry
			// must still win.
			name:       "unconfirmed-parent then confirmed",
			heights:    []int{-1, 10},
			wantHeight: 10,
		},
		{
			// Case 3 variant: same as above with order reversed.
			name:       "confirmed then unconfirmed-parent",
			heights:    []int{10, -1},
			wantHeight: 10,
		},
		{
			// Case 1: two confirmed entries with the same hash is
			// a real server bug; the switch returns an error from
			// DBUpdate, which UpdateAddressHistory turns into a
			// logrus.Panic.
			name:      "two confirmed duplicates panics",
			heights:   []int{10, 11},
			wantPanic: true,
		},
		{
			// Case 1b: same-hash, same-height mempool entries are
			// also rejected. The switch arm that catches this is
			// the "both <= 0" arm, distinct from the "both > 0"
			// arm above.
			name:      "two identical mempool entries panic",
			heights:   []int{0, 0},
			wantPanic: true,
		},
		{
			// Case 1b variant: an unconfirmed-with-parent pair is
			// also a server bug (a tx can't simultaneously be
			// "in mempool, parents confirmed" and "in mempool,
			// parents unconfirmed").
			name:      "mempool then unconfirmed-parent panics",
			heights:   []int{0, -1},
			wantPanic: true,
		},
	}

	for _, tc := range cases {
		s.Run(tc.name, func() {
			// Reset the suite's DB / mocks / transactions instance
			// so each case runs against a clean slate.
			s.SetupTest()

			addressList, err := s.addressChain.EnsureAddresses()
			s.Require().NoError(err)
			address := addressList[0]

			const amount = btcutil.Amount(1000)
			tx := newTx(chainhash.HashH(nil), 0, address, amount)
			s.blockchainMock.RegisterTxs(tx)

			entries := make([]*blockchainpkg.TxInfo, len(tc.heights))
			for i, h := range tc.heights {
				entries[i] = &blockchainpkg.TxInfo{
					TXHash: blockchainpkg.TXHash(tx.TxHash()),
					Height: h,
				}
			}

			// After dedup, processTxForAddress is called once with
			// wantHeight (or once per element in the panic case,
			// but the panic happens first so nothing fires).
			// Register one VerifiedHeaderByHeight return per
			// confirmed entry the dedup might still process; .Once
			// expectations that aren't consumed don't fail the
			// test.
			for _, h := range tc.heights {
				if h > 0 {
					s.headersMock.
						On("VerifiedHeaderByHeight", h).
						Return(nil, nil).Once()
				}
			}

			if tc.wantPanic {
				// In the panic case, DBUpdate returns the
				// "duplicate tx ids" error before reaching the
				// notifier.Put loop, so we bypass the helper
				// (which would register Put expectations that
				// never fire) and call the API directly.
				s.Require().Panics(func() {
					s.transactions.UpdateAddressHistory(
						address.PubkeyScriptHashHex(), entries,
					)
				})
				return
			}

			// All non-error branches must complete without panicking.
			s.updateAddressHistory(address, entries)

			// Exactly one indexed tx, at the height the dedup chose.
			indexed, err := s.transactions.Transactions(
				func(blockchainpkg.ScriptHashHex) bool { return false },
			)
			s.Require().NoError(err)
			s.Require().Len(indexed, 1)
			s.Require().Equal(tc.wantHeight, indexed[0].Height,
				"final stored height after dedup")

			// notifier.Put fires once per processTxForAddress call;
			// the dedup must collapse all occurrences of a single
			// hash into one downstream call. Counting Put calls
			// catches dedup bugs that the per-hash-keyed PutTx
			// happens to hide.
			putCalls := 0
			for _, c := range s.notifierMock.Calls {
				if c.Method == "Put" {
					putCalls++
				}
			}
			s.Require().Equalf(1, putCalls,
				"expected one notifier.Put per unique tx hash, got %d", putCalls)

			// Balance reflects the chosen height. A positive height
			// means the tx is confirmed and its output spendable;
			// any other height (0 or -1) classifies the output as
			// incoming because the tx's inputs aren't ours either.
			balance, err := s.transactions.Balance()
			s.Require().NoError(err)
			if tc.wantHeight > 0 {
				s.Require().Equal(newBalance(amount, 0), balance,
					"confirmed tx must contribute to available balance")
			} else {
				s.Require().Equal(newBalance(0, amount), balance,
					"unconfirmed tx must contribute to incoming balance")
			}
		})
	}
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
