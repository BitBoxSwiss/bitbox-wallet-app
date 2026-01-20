// SPDX-License-Identifier: Apache-2.0

package transactions

import (
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	btcdBlockchain "github.com/btcsuite/btcd/blockchain"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
)

// SpendableOutput is an unspent coin.
type SpendableOutput struct {
	TxOut           *wire.TxOut
	HeaderTimestamp *time.Time
}

// ScriptHashHex returns the hash of the PkScript of the output, in hex format.
func (txOut *SpendableOutput) ScriptHashHex() blockchain.ScriptHashHex {
	return getScriptHashHex(txOut.TxOut)
}

func getScriptHashHex(txOut *wire.TxOut) blockchain.ScriptHashHex {
	return blockchain.NewScriptHashHex(txOut.PkScript)
}

// Interface is the interface for the Transactions struct.
//
//go:generate moq -pkg mocks -out mocks/transactions.go . Interface
type Interface interface {
	// Balance computes the confirmed and unconfirmed balance of the account.
	Balance() (*accounts.Balance, error)

	// Close cleans up when finished using.
	Close()

	// SpendableOutputs returns all unspent outputs of the wallet which are eligible to be spent. Those
	// include all unspent outputs of confirmed transactions, and unconfirmed outputs that we created
	// ourselves.
	SpendableOutputs() (map[wire.OutPoint]*SpendableOutput, error)

	// Transactions returns an ordered list of transactions.
	Transactions(isChange func(blockchain.ScriptHashHex) bool) (accounts.OrderedTransactions, error)

	// UpdateAddressHistory should be called when initializing a wallet address, or when the history of
	// an address changes (a new transaction that touches it appears or disappears). The transactions
	// are downloaded and indexed.
	UpdateAddressHistory(scriptHashHex blockchain.ScriptHashHex, txs []*blockchain.TxInfo)
}

// Transactions handles wallet transactions: keeping an index of the transactions, inputs, (unspent)
// outputs, etc.
type Transactions struct {
	net     *chaincfg.Params
	db      DBInterface
	headers headers.Interface

	// headersTipHeight is the current chain tip height, so we can compute the number of
	// confirmations of a transaction.
	headersTipHeight int

	unsubscribeHeadersEvent func()

	synchronizer *synchronizer.Synchronizer
	blockchain   blockchain.Interface
	notifier     accounts.Notifier
	log          *logrus.Entry

	closed     bool
	closedLock locker.Locker

	headerTimestampCacheLock locker.Locker
	// headerTimestampCache maps confirmed block heights to the corresponding header timestamp.
	headerTimestampCache map[int]*time.Time
}

// NewTransactions creates a new instance of Transactions.
func NewTransactions(
	net *chaincfg.Params,
	db DBInterface,
	headers headers.Interface,
	synchronizer *synchronizer.Synchronizer,
	blockchain blockchain.Interface,
	notifier accounts.Notifier,
	log *logrus.Entry,
) *Transactions {
	transactions := &Transactions{
		net:     net,
		db:      db,
		headers: headers,

		headersTipHeight: headers.TipHeight(),

		synchronizer: synchronizer,
		blockchain:   blockchain,
		notifier:     notifier,
		log:          log.WithFields(logrus.Fields{"group": "transactions", "net": net.Name}),

		headerTimestampCache: map[int]*time.Time{},
	}
	transactions.unsubscribeHeadersEvent = headers.SubscribeEvent(transactions.onHeadersEvent)
	return transactions
}

// Close cleans up when finished using.
func (transactions *Transactions) Close() {
	defer transactions.closedLock.Lock()()
	if transactions.closed {
		transactions.log.Debug("account aleady closed")
		return
	}
	transactions.closed = true
	transactions.unsubscribeHeadersEvent()
}

func (transactions *Transactions) isClosed() bool {
	defer transactions.closedLock.RLock()()
	return transactions.closed
}

func (transactions *Transactions) getCachedTimestampAtHeight(height int, txInfoHeaderTimestamp *time.Time) *time.Time {
	// Cache by height only works for confirmed txs.
	if height > 0 {
		unlock := transactions.headerTimestampCacheLock.RLock()
		if cached, ok := transactions.headerTimestampCache[height]; ok {
			unlock()
			return cached
		}
		unlock()
	}

	// If the tx timestamp is already known from the db, use it and populate the cache.
	if txInfoHeaderTimestamp != nil {
		if height > 0 {
			unlock := transactions.headerTimestampCacheLock.Lock()
			transactions.headerTimestampCache[height] = txInfoHeaderTimestamp
			unlock()
		}
		return txInfoHeaderTimestamp
	}

	if height <= 0 {
		return nil
	}

	// Try to get the header timestamp from already-synced headers.
	header, err := transactions.headers.HeaderByHeight(height)
	if err != nil {
		transactions.log.WithError(err).Error("HeaderByHeight")
	} else if header != nil {
		timestamp := header.Timestamp
		headerTimestamp := &timestamp
		unlock := transactions.headerTimestampCacheLock.Lock()
		transactions.headerTimestampCache[height] = headerTimestamp
		unlock()
		return headerTimestamp
	}

	headersResult, err := transactions.blockchain.Headers(height, 1)
	if err != nil {
		transactions.log.WithError(err).Error("blockchain.Headers")
		return nil
	}
	if len(headersResult.Headers) != 1 {
		transactions.log.WithFields(logrus.Fields{"height": height, "headers": len(headersResult.Headers)}).
			Error("unexpected headers result size")
		return nil
	}
	timestamp := headersResult.Headers[0].Timestamp
	headerTimestamp := &timestamp

	unlock := transactions.headerTimestampCacheLock.Lock()
	transactions.headerTimestampCache[height] = headerTimestamp
	unlock()
	return headerTimestamp
}

func (transactions *Transactions) processTxForAddress(
	dbTx DBTxInterface,
	scriptHashHex blockchain.ScriptHashHex,
	txHash chainhash.Hash,
	tx *wire.MsgTx,
	height int,
	headerTimestamp *time.Time,
) {
	txInfo, err := dbTx.TxInfo(txHash)
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to retrieve tx info")
	}

	if err := dbTx.PutTx(txHash, tx, height, headerTimestamp); err != nil {
		transactions.log.WithError(err).Panic("Failed to put tx")
	}

	if err := transactions.notifier.Put(txHash[:]); err != nil {
		transactions.log.WithError(err).Error("Failed notifier.Put")
	}

	// Newly confirmed tx. Try to verify it.
	if txInfo.Height <= 0 && height > 0 {
		transactions.log.Debug("Try to verify newly confirmed tx")
		go transactions.verifyTransaction(txHash, height)
	}

	if err := dbTx.AddAddressToTx(txHash, scriptHashHex); err != nil {
		transactions.log.WithError(err).Panic("Failed to add address to tx")
	}
	transactions.processInputsAndOutputsForAddress(dbTx, scriptHashHex, txHash, tx)
}

// Go through the tx and extract all inputs and outputs which touch the address.
func (transactions *Transactions) processInputsAndOutputsForAddress(
	dbTx DBTxInterface,
	scriptHashHex blockchain.ScriptHashHex,
	txHash chainhash.Hash,
	tx *wire.MsgTx) {
	// Gather transaction inputs that spend outputs of the given address.
	for _, txIn := range tx.TxIn {
		// Since transactions can be processed in any order, and we might process the same tx
		// multiple times for different addresses, we index all inputs, even those that didn't
		// originate from our wallet. At this stage we don't know if it is one of our own inputs,
		// since the output that it spends might be indexed later.
		txInTxHash, err := dbTx.Input(txIn.PreviousOutPoint)
		if err != nil {
			transactions.log.WithError(err).Panic("Failed to retrieve input from previous outpoint")
		}
		if txInTxHash != nil && *txInTxHash != txHash {
			transactions.log.WithFields(logrus.Fields{"txIn.PreviousOutPoint": txIn.PreviousOutPoint,
				"txInTxHash": txInTxHash, "txHash": txHash}).
				Warning("Double spend detected")
		}
		if err := dbTx.PutInput(txIn.PreviousOutPoint, txHash); err != nil {
			transactions.log.WithError(err).Panic("Failed to store the transaction input")
		}
	}
	// Gather transaction outputs that belong to us.
	for index, txOut := range tx.TxOut {
		// Check if output is ours.
		if getScriptHashHex(txOut) == scriptHashHex {
			err := dbTx.PutOutput(
				wire.OutPoint{Hash: txHash, Index: uint32(index)},
				txOut,
			)
			if err != nil {
				transactions.log.WithError(err).Panic("Failed to store the transaction output")
			}
		}
	}
}

func (transactions *Transactions) allInputsOurs(dbTx DBTxInterface, transaction *wire.MsgTx) bool {
	for _, txIn := range transaction.TxIn {
		txOut, err := dbTx.Output(txIn.PreviousOutPoint)
		if err != nil {
			transactions.log.WithError(err).Panic("Failed to retrieve output")
		}
		if txOut == nil {
			return false
		}
	}
	return true
}

// SpendableOutputs returns all unspent outputs of the wallet which are eligible to be spent. Those
// include all unspent outputs of confirmed transactions, and unconfirmed outputs that we created
// ourselves.
func (transactions *Transactions) SpendableOutputs() (map[wire.OutPoint]*SpendableOutput, error) {
	return DBView(transactions.db, func(dbTx DBTxInterface) (map[wire.OutPoint]*SpendableOutput, error) {
		outputs, err := dbTx.Outputs()
		if err != nil {
			return nil, err
		}
		result := map[wire.OutPoint]*SpendableOutput{}
		for outPoint, txOut := range outputs {
			spent := transactions.isInputSpent(dbTx, outPoint)
			if !spent {
				txInfo, err := dbTx.TxInfo(outPoint.Hash)
				if err != nil {
					return nil, err
				}
				confirmed := txInfo.Height > 0

				if confirmed || transactions.allInputsOurs(dbTx, txInfo.Tx) {
					result[outPoint] = &SpendableOutput{
						TxOut:           txOut,
						HeaderTimestamp: txInfo.HeaderTimestamp,
					}
				}
			}
		}
		return result, nil
	})
}

func (transactions *Transactions) isInputSpent(dbTx DBTxInterface, outPoint wire.OutPoint) bool {
	input, err := dbTx.Input(outPoint)
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to retrieve input for outPoint")
	}
	return input != nil
}

func (transactions *Transactions) removeTxForAddress(
	dbTx DBTxInterface, scriptHashHex blockchain.ScriptHashHex, txHash chainhash.Hash) {
	transactions.log.Debug("Remove transaction for address")
	txInfo, err := dbTx.TxInfo(txHash)
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to retrieve tx info")
	}
	if txInfo == nil {
		// Not yet indexed.
		transactions.log.Debug("Transaction hash not listed")
		return
	}

	transactions.log.Debug("Deleting transaction address")
	empty, err := dbTx.RemoveAddressFromTx(txHash, scriptHashHex)
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to remove address from tx")
	}
	if empty {
		// Tx is not touching any of our outputs anymore. Remove.

		for _, txIn := range txInfo.Tx.TxIn {
			transactions.log.Debug("Deleting transaction iput")
			dbTx.DeleteInput(txIn.PreviousOutPoint)
		}

		// Remove the outputs added by this tx.
		for index := range txInfo.Tx.TxOut {
			dbTx.DeleteOutput(wire.OutPoint{
				Hash:  txHash,
				Index: uint32(index),
			})
		}

		dbTx.DeleteTx(txHash)
		if err := transactions.notifier.Delete(txHash[:]); err != nil {
			transactions.log.WithError(err).Error("Failed notifier.Delete")
		}
	}
}

// UpdateAddressHistory should be called when initializing a wallet address, or when the history of
// an address changes (a new transaction that touches it appears or disappears). The transactions
// are downloaded and indexed.
func (transactions *Transactions) UpdateAddressHistory(scriptHashHex blockchain.ScriptHashHex, txs []*blockchain.TxInfo) {
	if transactions.isClosed() {
		transactions.log.Debug("UpdateAddressHistory after the instance was closed")
		return
	}
	err := DBUpdate(transactions.db, func(dbTx DBTxInterface) error {
		txsSet := map[chainhash.Hash]struct{}{}
		for _, txInfo := range txs {
			txsSet[txInfo.TXHash.Hash()] = struct{}{}
		}
		if len(txsSet) != len(txs) {
			return errp.New("duplicate tx ids in address history returned by server")
		}
		previousHistory, err := dbTx.AddressHistory(scriptHashHex)
		if err != nil {
			return err
		}
		for _, entry := range previousHistory {
			if _, txOK := txsSet[entry.TXHash.Hash()]; txOK {
				continue
			}
			// A tx was previously in the address history but is not anymore.  If the tx was already
			// downloaded and indexed, it will be removed.  If it is currently downloading (enqueued for
			// indexing), it will not be processed.
			transactions.removeTxForAddress(dbTx, scriptHashHex, entry.TXHash.Hash())
		}

		if err := dbTx.PutAddressHistory(scriptHashHex, txs); err != nil {
			return err
		}
		for _, txInfo := range txs {
			txHash := txInfo.TXHash.Hash()
			height := txInfo.Height
			tx, headerTimestamp := transactions.getTransactionCached(dbTx, txHash, height)
			transactions.processTxForAddress(dbTx, scriptHashHex, txHash, tx, height, headerTimestamp)
		}
		return nil
	})
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to update address history")
	}
}

// getTransactionCached requires transactions lock.
func (transactions *Transactions) getTransactionCached(
	dbTx DBTxInterface,
	txHash chainhash.Hash,
	height int,
) (*wire.MsgTx, *time.Time) {
	txInfo, err := dbTx.TxInfo(txHash)
	if err != nil {
		transactions.log.WithError(err).Panic("Failed to retrieve transaction info")
	}

	headerTimestamp := transactions.getCachedTimestampAtHeight(height, txInfo.HeaderTimestamp)

	if txInfo.Tx != nil {
		return txInfo.Tx, headerTimestamp
	}
	tx, err := transactions.blockchain.TransactionGet(txHash)
	if err != nil {
		transactions.log.WithError(err).Panic("TransactionGet failed")
	}
	return tx, headerTimestamp
}

// Balance computes the confirmed and unconfirmed balance of the account.
func (transactions *Transactions) Balance() (*accounts.Balance, error) {
	return DBView(transactions.db, func(dbTx DBTxInterface) (*accounts.Balance, error) {
		outputs, err := dbTx.Outputs()
		if err != nil {
			return nil, err
		}
		var available, incoming int64
		for outPoint, txOut := range outputs {
			// What is spent can not be available nor incoming.
			if spent := transactions.isInputSpent(dbTx, outPoint); spent {
				continue
			}
			txInfo, err := dbTx.TxInfo(outPoint.Hash)
			if err != nil {
				return nil, err
			}
			confirmed := txInfo.Height > 0
			if confirmed || transactions.allInputsOurs(dbTx, txInfo.Tx) {
				available += txOut.Value
			} else {
				incoming += txOut.Value
			}
		}
		return accounts.NewBalance(coin.NewAmountFromInt64(available), coin.NewAmountFromInt64(incoming)), nil
	})
}

func (transactions *Transactions) outputToAddress(pkScript []byte) string {
	extractedAddress, err := util.AddressFromPkScript(pkScript, transactions.net)
	// unknown addresses and multisig scripts ignored.
	if err != nil {
		return "<unknown address>"
	}
	return extractedAddress.String()
}

// txInfo computes additional information to display to the user (type of tx, fee paid, etc.).
func (transactions *Transactions) txInfo(
	dbTx DBTxInterface,
	txInfo *DBTxInfo,
	isChange func(blockchain.ScriptHashHex) bool) *accounts.TransactionData {
	var sumOurInputs btcutil.Amount
	var result btcutil.Amount
	allInputsOurs := true
	for _, txIn := range txInfo.Tx.TxIn {
		spentOut, err := dbTx.Output(txIn.PreviousOutPoint)
		if err != nil {
			// TODO
			transactions.log.WithError(err).Panic("Output() failed")
		}
		if spentOut != nil {
			sumOurInputs += btcutil.Amount(spentOut.Value)
		} else {
			allInputsOurs = false
		}
	}
	var sumAllOutputs, sumOurReceive, sumOurChange btcutil.Amount
	receiveAddresses := []accounts.AddressAndAmount{}
	sendAddresses := []accounts.AddressAndAmount{}
	allOutputsOurs := true
	for index, txOut := range txInfo.Tx.TxOut {
		sumAllOutputs += btcutil.Amount(txOut.Value)
		output, err := dbTx.Output(wire.OutPoint{
			Hash:  txInfo.TxHash,
			Index: uint32(index),
		})
		if err != nil {
			// TODO
			transactions.log.WithError(err).Panic("Output() failed")
		}
		addressAndAmount := accounts.AddressAndAmount{
			Address: transactions.outputToAddress(txOut.PkScript),
			Amount:  coin.NewAmountFromInt64(txOut.Value),
			Ours:    output != nil,
		}
		if output != nil {
			receiveAddresses = append(receiveAddresses, addressAndAmount)
			if isChange(getScriptHashHex(output)) {
				sumOurChange += btcutil.Amount(txOut.Value)
			} else {
				sumOurReceive += btcutil.Amount(txOut.Value)
				sendAddresses = append(sendAddresses, addressAndAmount)
			}
		} else {
			allOutputsOurs = false
			sendAddresses = append(sendAddresses, addressAndAmount)
		}
	}

	btcutilTx := btcutil.NewTx(txInfo.Tx)
	vsize := mempool.GetTxVirtualSize(btcutilTx)

	var addresses []accounts.AddressAndAmount
	var txType accounts.TxType
	var feeP *coin.Amount
	var feeRatePerKbP *btcutil.Amount
	if allInputsOurs {
		feeValue := sumOurInputs - sumAllOutputs
		fee := coin.NewAmountFromInt64(int64(feeValue))
		feeP = &fee
		feeRatePerKb := feeValue * 1000 / btcutil.Amount(vsize)
		feeRatePerKbP = &feeRatePerKb
		addresses = sendAddresses
		if allOutputsOurs {
			txType = accounts.TxTypeSendSelf
			// Money sent from our wallet to our wallet
			result = sumOurReceive
		} else {
			// Money sent from our wallet to external address.
			txType = accounts.TxTypeSend
			result = sumAllOutputs - sumOurReceive - sumOurChange
		}
	} else {
		// If none of the inputs are ours, money was sent from external to our wallet.
		// If some input are ours, we determine the direction by whether the tx increases or
		// decreases our balance.
		result = sumOurReceive + sumOurChange - sumOurInputs
		if result >= 0 {
			txType = accounts.TxTypeReceive
			addresses = receiveAddresses
		} else {
			txType = accounts.TxTypeSend
			addresses = sendAddresses
			result = -result
		}

	}
	numConfirmations := 0
	if txInfo.Height > 0 && transactions.headersTipHeight > 0 {
		numConfirmations = transactions.headersTipHeight - txInfo.Height + 1
	}

	const numConfirmationsComplete = 6
	status := accounts.TxStatusPending
	if numConfirmations >= numConfirmationsComplete {
		status = accounts.TxStatusComplete
	}
	return &accounts.TransactionData{
		Fee:                      feeP,
		Timestamp:                txInfo.HeaderTimestamp,
		TxID:                     txInfo.TxHash.String(),
		InternalID:               txInfo.TxHash.String(),
		NumConfirmations:         numConfirmations,
		NumConfirmationsComplete: numConfirmationsComplete,
		Height:                   txInfo.Height,
		Status:                   status,
		Type:                     txType,
		Amount:                   coin.NewAmountFromInt64(int64(result)),
		Addresses:                addresses,

		FeeRatePerKb:     feeRatePerKbP,
		VSize:            vsize,
		Size:             int64(txInfo.Tx.SerializeSize()),
		Weight:           btcdBlockchain.GetTransactionWeight(btcutilTx),
		CreatedTimestamp: txInfo.CreatedTimestamp,
		IsErc20:          false,
	}
}

// Transactions returns an ordered list of transactions.
func (transactions *Transactions) Transactions(
	isChange func(blockchain.ScriptHashHex) bool) (accounts.OrderedTransactions, error) {
	return DBView(transactions.db, func(dbTx DBTxInterface) (accounts.OrderedTransactions, error) {
		txs := []*accounts.TransactionData{}
		txHashes, err := dbTx.Transactions()
		if err != nil {
			return nil, err
		}
		for _, txHash := range txHashes {
			txInfo, err := dbTx.TxInfo(txHash)
			if err != nil {
				return nil, err
			}
			txs = append(txs, transactions.txInfo(dbTx, txInfo, isChange))
		}
		return accounts.NewOrderedTransactions(txs), nil
	})
}
