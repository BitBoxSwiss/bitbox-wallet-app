package transactions

import (
	"sort"
	"time"

	btcdBlockchain "github.com/btcsuite/btcd/blockchain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	"github.com/shiftdevices/godbb/backend/coins/btc/synchronizer"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/sirupsen/logrus"
)

// TxOut is a transaction output which is part of the wallet.
type TxOut struct {
	*wire.TxOut
}

// ScriptHashHex returns the hash of the PkScript of the output, in hex format.
func (txOut *TxOut) ScriptHashHex() client.ScriptHashHex {
	return client.ScriptHashHex(chainhash.HashH(txOut.PkScript).String())
}

// Transactions handles wallet transactions: keeping an index of the transactions, inputs, (unspent)
// outputs, etc.
type Transactions struct {
	locker.Locker

	net          *chaincfg.Params
	db           DBInterface
	headers      headers.Interface
	requestedTXs map[chainhash.Hash][]func(DBTxInterface, *wire.MsgTx)

	// headersTipHeight is the current chain tip height, so we can compute the number of
	// confirmations of a transaction.
	headersTipHeight int

	unsubscribeHeadersEvent func()

	synchronizer *synchronizer.Synchronizer
	blockchain   blockchain.Interface
	log          *logrus.Entry
}

// NewTransactions creates a new instance of Transactions.
func NewTransactions(
	net *chaincfg.Params,
	db DBInterface,
	headers headers.Interface,
	synchronizer *synchronizer.Synchronizer,
	blockchain blockchain.Interface,
	log *logrus.Entry,
) *Transactions {
	transactions := &Transactions{
		net:          net,
		db:           db,
		headers:      headers,
		requestedTXs: map[chainhash.Hash][]func(DBTxInterface, *wire.MsgTx){},

		headersTipHeight: headers.TipHeight(),

		synchronizer: synchronizer,
		blockchain:   blockchain,
		log:          log.WithFields(logrus.Fields{"group": "transactions", "net": net.Name}),
	}
	transactions.unsubscribeHeadersEvent = headers.SubscribeEvent(transactions.onHeadersEvent)
	return transactions
}

// Close cleans up when finished using.
func (transactions *Transactions) Close() {
	transactions.unsubscribeHeadersEvent()
}

func (transactions *Transactions) txInHistory(
	dbTx DBTxInterface, scriptHashHex client.ScriptHashHex, txHash chainhash.Hash) bool {
	history, err := dbTx.AddressHistory(scriptHashHex)
	if err != nil {
		// TODO
		panic(err)
	}
	for _, entry := range history {
		if txHash == entry.TXHash.Hash() {
			return true
		}
	}
	return false
}

func (transactions *Transactions) processTxForAddress(
	dbTx DBTxInterface, scriptHashHex client.ScriptHashHex, txHash chainhash.Hash, tx *wire.MsgTx, height int) {
	// Don't process the tx if it is not found in the address history. It could have been removed
	// from the history before this function was called.
	if !transactions.txInHistory(dbTx, scriptHashHex, txHash) {
		return
	}

	_, _, previousHeight, _, err := dbTx.TxInfo(txHash)
	if err != nil {
		// TODO
		panic(err)
	}

	if err := dbTx.PutTx(txHash, tx, height); err != nil {
		// TODO
		panic(err)
	}

	// Newly confirmed tx. Try to verify it.
	if previousHeight <= 0 && height > 0 {
		transactions.log.Debug("Try to verify newly confirmed tx")
		go transactions.verifyTransaction(txHash, height)
	}

	if err := dbTx.AddAddressToTx(txHash, scriptHashHex); err != nil {
		// TODO
		panic(err)
	}
	transactions.processInputsAndOutputsForAddress(dbTx, scriptHashHex, txHash, tx)
}

// Go through the tx and extract all inputs and outputs which touch the address.
func (transactions *Transactions) processInputsAndOutputsForAddress(
	dbTx DBTxInterface,
	scriptHashHex client.ScriptHashHex,
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
			// TODO
			panic(err)
		}
		if txInTxHash != nil && *txInTxHash != txHash {
			transactions.log.WithFields(logrus.Fields{"txIn.PreviousOutPoint": txIn.PreviousOutPoint,
				"txInTxHash": txInTxHash, "txHash": txHash}).
				Warning("Double spend detected")
		}
		if err := dbTx.PutInput(txIn.PreviousOutPoint, txHash); err != nil {
			// TODO
			panic(err)
		}
	}
	// Gather transaction outputs that belong to us.
	for index, txOut := range tx.TxOut {
		// Check if output is ours.
		if (&TxOut{txOut}).ScriptHashHex() == scriptHashHex {
			err := dbTx.PutOutput(
				wire.OutPoint{Hash: txHash, Index: uint32(index)},
				txOut,
			)
			if err != nil {
				// TODO
				panic(err)
			}
		}
	}
}

func (transactions *Transactions) allInputsOurs(dbTx DBTxInterface, transaction *wire.MsgTx) bool {
	for _, txIn := range transaction.TxIn {
		txOut, err := dbTx.Output(txIn.PreviousOutPoint)
		if err != nil {
			// TODO
			panic(err)
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
func (transactions *Transactions) SpendableOutputs() map[wire.OutPoint]*TxOut {
	transactions.synchronizer.WaitSynchronized()
	defer transactions.RLock()()

	dbTx, err := transactions.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()

	outputs, err := dbTx.Outputs()
	if err != nil {
		// TODO
		panic(err)
	}
	result := map[wire.OutPoint]*TxOut{}
	for outPoint, txOut := range outputs {
		tx, _, height, _, err := dbTx.TxInfo(outPoint.Hash)
		if err != nil {
			// TODO
			panic(err)
		}
		confirmed := height > 0

		spent := isInputSpent(dbTx, outPoint)
		if !spent && (confirmed || transactions.allInputsOurs(dbTx, tx)) {
			result[outPoint] = &TxOut{TxOut: txOut}
		}
	}
	return result
}

func isInputSpent(dbTx DBTxInterface, outPoint wire.OutPoint) bool {
	input, err := dbTx.Input(outPoint)
	if err != nil {
		// TODO
		panic(err)
	}
	return input != nil
}

func (transactions *Transactions) removeTxForAddress(
	dbTx DBTxInterface, scriptHashHex client.ScriptHashHex, txHash chainhash.Hash) {
	transactions.log.Debug("Remove transaction for address")
	tx, _, _, _, err := dbTx.TxInfo(txHash)
	if err != nil {
		// TODO
		panic(err)
	}
	if tx == nil {
		// Not yet indexed.
		transactions.log.Debug("Transaction hash not listed")
		return
	}

	transactions.log.Debug("Deleting transaction address")
	empty, err := dbTx.RemoveAddressFromTx(txHash, scriptHashHex)
	if err != nil {
		// TODO
		panic(err)
	}
	if empty {
		// Tx is not touching any of our outputs anymore. Remove.

		for _, txIn := range tx.TxIn {
			transactions.log.Debug("Deleting transaction iput")
			dbTx.DeleteInput(txIn.PreviousOutPoint)
		}

		// Remove the outputs added by this tx.
		for index := range tx.TxOut {
			dbTx.DeleteOutput(wire.OutPoint{
				Hash:  txHash,
				Index: uint32(index),
			})
		}

		dbTx.DeleteTx(txHash)
	}
}

// UpdateAddressHistory should be called when initializing a wallet address, or when the history of
// an address changes (a new transaction that touches it appears or disappears). The transactions
// are downloaded and indexed.
func (transactions *Transactions) UpdateAddressHistory(scriptHashHex client.ScriptHashHex, txs []*client.TxInfo) {
	defer transactions.Lock()()
	dbTx, err := transactions.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()
	txsSet := map[chainhash.Hash]struct{}{}
	for _, txInfo := range txs {
		txsSet[txInfo.TXHash.Hash()] = struct{}{}
	}
	if len(txsSet) != len(txs) {
		err = errp.New("duplicate tx ids in address history returned by server")
		transactions.log.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
	previousHistory, err := dbTx.AddressHistory(scriptHashHex)
	if err != nil {
		// TODO
		panic(err)
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
		// TODO
		panic(err)
	}

	for _, txInfo := range txs {
		func(txHash chainhash.Hash, height int) {
			transactions.doForTransaction(dbTx, txHash, func(innerDBTx DBTxInterface, tx *wire.MsgTx) {
				transactions.processTxForAddress(innerDBTx, scriptHashHex, txHash, tx, height)
			})
		}(txInfo.TXHash.Hash(), txInfo.Height)
	}
	if err := dbTx.Commit(); err != nil {
		// TODO
		panic(err)
	}
}

func (transactions *Transactions) doForTransaction(
	dbTx DBTxInterface,
	txHash chainhash.Hash,
	callback func(DBTxInterface, *wire.MsgTx),
) {
	tx, _, _, _, err := dbTx.TxInfo(txHash)
	if err != nil {
		// TODO
		panic(err)
	}
	if tx != nil {
		callback(dbTx, tx)
		return
	}
	if transactions.requestedTXs[txHash] == nil {
		transactions.requestedTXs[txHash] = []func(DBTxInterface, *wire.MsgTx){}
	}
	alreadyDownloading := len(transactions.requestedTXs[txHash]) != 0
	transactions.requestedTXs[txHash] = append(transactions.requestedTXs[txHash], callback)
	if alreadyDownloading {
		return
	}
	done := transactions.synchronizer.IncRequestsCounter()
	if err := transactions.blockchain.TransactionGet(
		txHash,
		func(tx *wire.MsgTx) error {
			defer transactions.Lock()()
			dbTx, err := transactions.db.Begin()
			if err != nil {
				return err
			}
			defer dbTx.Rollback()

			for _, callback := range transactions.requestedTXs[txHash] {
				callback(dbTx, tx)
			}
			delete(transactions.requestedTXs, txHash)
			return dbTx.Commit()
		},
		func(error) { done() },
	); err != nil {
		transactions.log.WithField("error", err).Panic("Failed to retrieve transaction")
		// TODO
		panic(err)
	}
}

// Balance contains the available and incoming balance of the wallet.
type Balance struct {
	// Available funds are all confirmed funds which are not spent by any tx. Exception: unconfirmed
	// transactions that spend from the wallet are available.
	Available btcutil.Amount
	// Incoming balance are unconfirmed funds coming into the wallet.
	Incoming btcutil.Amount
}

// Balance computes the confirmed and unconfirmed balance of the wallet.
func (transactions *Transactions) Balance() *Balance {
	transactions.synchronizer.WaitSynchronized()
	defer transactions.RLock()()
	dbTx, err := transactions.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	outputs, err := dbTx.Outputs()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()
	var available, incoming int64
	for outPoint, txOut := range outputs {
		// What is spent can not be available nor incoming.
		if spent := isInputSpent(dbTx, outPoint); spent {
			continue
		}
		tx, _, height, _, err := dbTx.TxInfo(outPoint.Hash)
		if err != nil {
			// TODO
			panic(err)
		}
		confirmed := height > 0
		if confirmed || transactions.allInputsOurs(dbTx, tx) {
			available += txOut.Value
		} else {
			incoming += txOut.Value
		}
	}
	return &Balance{
		Available: btcutil.Amount(available),
		Incoming:  btcutil.Amount(incoming),
	}
}

// byHeight defines the methods needed to satisify sort.Interface to sort transactions by their
// height. Special case for unconfirmed transactions (height <=0), which come last.
type byHeight []*TxInfo

func (s byHeight) Len() int { return len(s) }
func (s byHeight) Less(i, j int) bool {
	if s[j].Height <= 0 {
		return true
	}
	if s[i].Height <= 0 {
		return false
	}
	return s[i].Height < s[j].Height
}
func (s byHeight) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

// TxType is a type of transaction. See the TxType* constants.
type TxType string

const (
	// TxTypeReceive is a tx which sends funds to our wallet.
	TxTypeReceive TxType = "receive"
	// TxTypeSend is a tx which sends funds out of our wallet.
	TxTypeSend = "send"
	// TxTypeSendSelf is a tx from out wallet to our wallet.
	TxTypeSendSelf = "sendSelf"
)

// TxInfo contains additional tx information to display to the user.
type TxInfo struct {
	Tx *wire.MsgTx
	// VSize is the tx virtual size in
	// "vbytes". https://bitcoincore.org/en/segwit_wallet_dev/#transaction-fee-estimation
	VSize int64
	// Size is the serialized tx size in bytes.
	Size int64
	// Weight is the tx weight.
	Weight int64
	// Height is the height this tx was confirmed at. 0 (or -1) for unconfirmed.
	Height int
	// NumConfirmations is the number of confirmations. 0 for unconfirmed.
	NumConfirmations int
	Type             TxType
	// Amount is always >0 and is the amount received or sent (not including the fee).
	Amount btcutil.Amount
	// Fee is nil if for a receiving tx (TxTypeReceive). The fee is only displayed (and relevant)
	// when sending funds from the wallet.
	Fee *btcutil.Amount
	// Time of confirmation. nil for unconfirmed tx or when the headers are not synced yet.
	Timestamp *time.Time
	// Addresses money was sent to / received on (without change addresses).
	Addresses []string
}

// FeeRatePerKb returns the fee rate of the tx (fee / tx size).
func (txInfo *TxInfo) FeeRatePerKb() *btcutil.Amount {
	if txInfo.Fee == nil {
		return nil
	}
	feeRatePerKb := *txInfo.Fee * 1000 / btcutil.Amount(txInfo.VSize)
	return &feeRatePerKb
}

// txInfo computes additional information to display to the user (type of tx, fee paid, etc.).
func (transactions *Transactions) txInfo(
	dbTx DBTxInterface,
	tx *wire.MsgTx,
	height int,
	timestamp *time.Time,
	isChange func(client.ScriptHashHex) bool) *TxInfo {
	defer transactions.RLock()()
	var sumOurInputs btcutil.Amount
	var result btcutil.Amount
	allInputsOurs := true
	for _, txIn := range tx.TxIn {
		spentOut, err := dbTx.Output(txIn.PreviousOutPoint)
		if err != nil {
			// TODO
			panic(err)
		}
		if spentOut != nil {
			sumOurInputs += btcutil.Amount(spentOut.Value)
		} else {
			allInputsOurs = false
		}
	}
	var sumAllOutputs, sumOurReceive, sumOurChange btcutil.Amount
	receiveAddresses := []string{}
	sendAddresses := []string{}
	outputToAddress := func(pkScript []byte) string {
		_, extractedAddresses, _, err := txscript.ExtractPkScriptAddrs(pkScript, transactions.net)
		// unknown addresses and multisig scripts ignored.
		if err != nil || len(extractedAddresses) != 1 {
			return "<unknown address>"
		}
		return extractedAddresses[0].String()
	}
	allOutputsOurs := true
	for index, txOut := range tx.TxOut {
		sumAllOutputs += btcutil.Amount(txOut.Value)
		output, err := dbTx.Output(wire.OutPoint{
			Hash:  tx.TxHash(),
			Index: uint32(index),
		})
		if err != nil {
			// TODO
			panic(err)
		}
		address := outputToAddress(txOut.PkScript)
		if output != nil {
			if isChange((&TxOut{TxOut: output}).ScriptHashHex()) {
				sumOurChange += btcutil.Amount(txOut.Value)
			} else {
				sumOurReceive += btcutil.Amount(txOut.Value)
				receiveAddresses = append(receiveAddresses, address)
				sendAddresses = append(sendAddresses, address)
			}
		} else {
			allOutputsOurs = false
			sendAddresses = append(sendAddresses, address)
		}
	}
	var addresses []string
	var txType TxType
	var feeP *btcutil.Amount
	if allInputsOurs {
		fee := sumOurInputs - sumAllOutputs
		feeP = &fee
		addresses = sendAddresses
		if allOutputsOurs {
			txType = TxTypeSendSelf
			// Money sent from our wallet to our wallet
			result = sumOurReceive
		} else {
			// Money sent from our wallet to external address.
			txType = TxTypeSend
			result = sumAllOutputs - sumOurReceive - sumOurChange
		}
	} else {
		// Money sent from external to our wallet
		txType = TxTypeReceive
		addresses = receiveAddresses
		result = sumOurReceive + sumOurChange - sumOurInputs
	}
	numConfirmations := 0
	if height > 0 && transactions.headersTipHeight > 0 {
		numConfirmations = transactions.headersTipHeight - height + 1
	}
	btcutilTx := btcutil.NewTx(tx)
	return &TxInfo{
		Tx:               tx,
		VSize:            mempool.GetTxVirtualSize(btcutilTx),
		Size:             int64(tx.SerializeSize()),
		Weight:           btcdBlockchain.GetTransactionWeight(btcutilTx),
		NumConfirmations: numConfirmations,
		Height:           height,
		Type:             txType,
		Amount:           result,
		Fee:              feeP,
		Timestamp:        timestamp,
		Addresses:        addresses,
	}
}

// Transactions returns an ordered list of transactions.
func (transactions *Transactions) Transactions(
	isChange func(client.ScriptHashHex) bool) []*TxInfo {
	transactions.synchronizer.WaitSynchronized()
	defer transactions.RLock()()
	dbTx, err := transactions.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()
	txs := []*TxInfo{}
	txHashes, err := dbTx.Transactions()
	if err != nil {
		// TODO
		panic(err)
	}
	for _, txHash := range txHashes {
		tx, _, height, timestamp, err := dbTx.TxInfo(txHash)
		if err != nil {
			// TODO
			panic(err)
		}
		txs = append(txs, transactions.txInfo(dbTx, tx, height, timestamp, isChange))
	}
	sort.Sort(sort.Reverse(byHeight(txs)))
	return txs
}
