// SPDX-License-Identifier: Apache-2.0

package transactionsdb

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"go.etcd.io/bbolt"
)

const (
	bucketTransactionsKey           = "transactions"
	bucketUnverifiedTransactionsKey = "unverifiedTransactions"
	bucketInputsKey                 = "inputs"
	bucketOutputsKey                = "outputs"
	bucketAddressHistoriesKey       = "addressHistories"
	bucketConfigKey                 = "config"
)

// DB is a bbolt key/value database.
type DB struct {
	db *bbolt.DB
}

// NewDB creates/opens a new db.
func NewDB(filename string) (*DB, error) {
	db, err := bbolt.Open(filename, 0600, nil)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return &DB{db: db}, nil
}

// Begin implements transactions.Begin.
func (db *DB) Begin(writable bool) (transactions.DBTxInterface, error) {
	tx, err := db.db.Begin(writable)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return &Tx{
		tx: tx,
	}, nil
}

// Close implements transactions.Close.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements transactions.DBTxInterface.
type Tx struct {
	tx *bbolt.Tx
}

// Rollback implements transactions.DBTxInterface.
func (tx *Tx) Rollback() {
	// Only possible error is ErrTxClosed.
	_ = tx.tx.Rollback()
}

// Commit implements transactions.DBTxInterface.
func (tx *Tx) Commit() error {
	return tx.tx.Commit()
}

func newWalletTransaction() *transactions.DBTxInfo {
	return &transactions.DBTxInfo{
		Tx:        nil,
		Height:    0,
		Addresses: map[string]bool{},
	}
}

func readJSON(bucket *bbolt.Bucket, key []byte, value interface{}) (bool, error) {
	if bucket == nil {
		return false, nil
	}
	if jsonBytes := bucket.Get(key); jsonBytes != nil {
		return true, errp.WithStack(json.Unmarshal(jsonBytes, value))
	}
	return false, nil
}

func writeJSON(bucket *bbolt.Bucket, key []byte, value interface{}) error {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return bucket.Put(key, jsonBytes)
}

func (tx *Tx) modifyTx(key []byte, f func(value *transactions.DBTxInfo)) error {
	walletTx := newWalletTransaction()
	bucketTransactions, err := tx.tx.CreateBucketIfNotExists([]byte(bucketTransactionsKey))
	if err != nil {
		return errp.WithStack(err)
	}

	found, err := readJSON(bucketTransactions, key, walletTx)
	if err != nil {
		return err
	}
	if !found {
		now := time.Now()
		walletTx.CreatedTimestamp = &now
	}
	f(walletTx)
	return writeJSON(bucketTransactions, key, walletTx)
}

// TxInfo implements transactions.DBTxInterface.
func (tx *Tx) TxInfo(txHash chainhash.Hash) (
	*transactions.DBTxInfo, error) {
	bucketTransactions := tx.tx.Bucket([]byte(bucketTransactionsKey))
	walletTx := newWalletTransaction()
	if _, err := readJSON(bucketTransactions, txHash[:], walletTx); err != nil {
		return nil, err
	}
	walletTx.TxHash = txHash
	return walletTx, nil
}

// PutTx implements transactions.DBTxInterface.
func (tx *Tx) PutTx(txHash chainhash.Hash, msgTx *wire.MsgTx, height int, headerTimestamp *time.Time) error {
	var verified *bool
	err := tx.modifyTx(txHash[:], func(walletTx *transactions.DBTxInfo) {
		verified = walletTx.Verified
		walletTx.Tx = msgTx
		walletTx.Height = height
		if headerTimestamp != nil {
			walletTx.HeaderTimestamp = headerTimestamp
		}
	})
	if err != nil {
		return err
	}
	if verified == nil {
		bucketUnverifiedTransactions, err := tx.tx.CreateBucketIfNotExists([]byte(bucketUnverifiedTransactionsKey))
		if err != nil {
			return errp.WithStack(err)
		}

		return bucketUnverifiedTransactions.Put(txHash[:], nil)
	}
	return nil
}

// DeleteTx implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteTx(txHash chainhash.Hash) {
	bucketTransactions, err := tx.tx.CreateBucketIfNotExists([]byte(bucketTransactionsKey))
	if err != nil {
		panic(errp.WithStack(err))
	}
	if err := bucketTransactions.Delete(txHash[:]); err != nil {
		panic(errp.WithStack(err))
	}
}

// AddAddressToTx implements transactions.DBTxInterface.
func (tx *Tx) AddAddressToTx(txHash chainhash.Hash, scriptHashHex blockchain.ScriptHashHex) error {
	return tx.modifyTx(txHash[:], func(walletTx *transactions.DBTxInfo) {
		walletTx.Addresses[string(scriptHashHex)] = true
	})
}

// RemoveAddressFromTx implements transactions.DBTxInterface.
func (tx *Tx) RemoveAddressFromTx(txHash chainhash.Hash, scriptHashHex blockchain.ScriptHashHex) (bool, error) {
	var empty bool
	err := tx.modifyTx(txHash[:], func(walletTx *transactions.DBTxInfo) {
		delete(walletTx.Addresses, string(scriptHashHex))
		empty = len(walletTx.Addresses) == 0
	})
	return empty, err
}

func getTransactions(bucket *bbolt.Bucket) ([]chainhash.Hash, error) {
	result := []chainhash.Hash{}
	if bucket == nil {
		return result, nil
	}
	cursor := bucket.Cursor()
	for txHashBytes, _ := cursor.First(); txHashBytes != nil; txHashBytes, _ = cursor.Next() {
		var txHash chainhash.Hash
		if err := txHash.SetBytes(txHashBytes); err != nil {
			return nil, errp.WithStack(err)
		}
		result = append(result, txHash)
	}
	return result, nil
}

// Transactions implements transactions.DBTxInterface.
func (tx *Tx) Transactions() ([]chainhash.Hash, error) {
	bucketTransactions := tx.tx.Bucket([]byte(bucketTransactionsKey))
	return getTransactions(bucketTransactions)
}

// UnverifiedTransactions implements transactions.DBTxInterface.
func (tx *Tx) UnverifiedTransactions() ([]chainhash.Hash, error) {
	return getTransactions(tx.tx.Bucket([]byte(bucketUnverifiedTransactionsKey)))
}

// MarkTxVerified implements transactions.DBTxInterface.
func (tx *Tx) MarkTxVerified(txHash chainhash.Hash, headerTimestamp time.Time) error {
	bucketUnverifiedTransactions, err := tx.tx.CreateBucketIfNotExists([]byte(bucketUnverifiedTransactionsKey))
	if err != nil {
		panic(errp.WithStack(err))
	}
	if err := bucketUnverifiedTransactions.Delete(txHash[:]); err != nil {
		panic(errp.WithStack(err))
	}
	return tx.modifyTx(txHash[:], func(walletTx *transactions.DBTxInfo) {
		truth := true
		walletTx.Verified = &truth
		walletTx.HeaderTimestamp = &headerTimestamp
	})
}

// PutInput implements transactions.DBTxInterface.
func (tx *Tx) PutInput(outPoint wire.OutPoint, txHash chainhash.Hash) error {
	bucketInputs, err := tx.tx.CreateBucketIfNotExists([]byte(bucketInputsKey))
	if err != nil {
		return errp.WithStack(err)
	}
	return bucketInputs.Put([]byte(outPoint.String()), txHash[:])
}

// Input implements transactions.DBTxInterface.
func (tx *Tx) Input(outPoint wire.OutPoint) (*chainhash.Hash, error) {
	bucketInputs := tx.tx.Bucket([]byte(bucketInputsKey))
	if bucketInputs == nil {
		return nil, nil
	}
	if value := bucketInputs.Get([]byte(outPoint.String())); value != nil {
		return chainhash.NewHash(value)
	}
	return nil, nil
}

// DeleteInput implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteInput(outPoint wire.OutPoint) {
	bucketInputs, err := tx.tx.CreateBucketIfNotExists([]byte(bucketInputsKey))
	if err != nil {
		panic(errp.WithStack(err))
	}
	if err := bucketInputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutOutput implements transactions.DBTxInterface.
func (tx *Tx) PutOutput(outPoint wire.OutPoint, txOut *wire.TxOut) error {
	bucketOutputs, err := tx.tx.CreateBucketIfNotExists([]byte(bucketOutputsKey))
	if err != nil {
		return errp.WithStack(err)
	}
	return writeJSON(bucketOutputs, []byte(outPoint.String()), txOut)
}

// Output implements transactions.DBTxInterface.
func (tx *Tx) Output(outPoint wire.OutPoint) (*wire.TxOut, error) {
	bucketOutputs := tx.tx.Bucket([]byte(bucketOutputsKey))
	if bucketOutputs == nil {
		return nil, nil
	}
	txOut := &wire.TxOut{}
	found, err := readJSON(bucketOutputs, []byte(outPoint.String()), txOut)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return txOut, nil
}

// Outputs implements transactions.DBTxInterface.
func (tx *Tx) Outputs() (map[wire.OutPoint]*wire.TxOut, error) {
	outputs := map[wire.OutPoint]*wire.TxOut{}
	bucketOutputs := tx.tx.Bucket([]byte(bucketOutputsKey))
	if bucketOutputs == nil {
		return outputs, nil
	}
	cursor := bucketOutputs.Cursor()
	for outPointBytes, txOutJSONBytes := cursor.First(); outPointBytes != nil; outPointBytes, txOutJSONBytes = cursor.Next() {
		txOut := &wire.TxOut{}
		if err := json.Unmarshal(txOutJSONBytes, txOut); err != nil {
			return nil, errp.WithStack(err)
		}
		outPoint, err := util.ParseOutPoint(outPointBytes)
		if err != nil {
			return nil, err
		}
		outputs[*outPoint] = txOut
	}
	return outputs, nil
}

// DeleteOutput implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteOutput(outPoint wire.OutPoint) {
	bucketOutputs, err := tx.tx.CreateBucketIfNotExists([]byte(bucketOutputsKey))
	if err != nil {
		panic(errp.WithStack(err))
	}
	if err := bucketOutputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutAddressHistory implements transactions.DBTxInterface.
func (tx *Tx) PutAddressHistory(scriptHashHex blockchain.ScriptHashHex, history blockchain.TxHistory) error {
	bucketAddressHistories, err := tx.tx.CreateBucketIfNotExists([]byte(bucketAddressHistoriesKey))
	if err != nil {
		return errp.WithStack(err)
	}
	return writeJSON(bucketAddressHistories, []byte(string(scriptHashHex)), history)
}

// AddressHistory implements transactions.DBTxInterface.
func (tx *Tx) AddressHistory(scriptHashHex blockchain.ScriptHashHex) (blockchain.TxHistory, error) {
	history := blockchain.TxHistory{}
	bucketAddressHistories := tx.tx.Bucket([]byte(bucketAddressHistoriesKey))
	_, err := readJSON(bucketAddressHistories, []byte(string(scriptHashHex)), &history)
	return history, err
}

// PutGapLimits implements transactions.DBTxInterface.
func (tx *Tx) PutGapLimits(limits types.GapLimits) error {
	bucketConfig, err := tx.tx.CreateBucketIfNotExists([]byte(bucketConfigKey))
	if err != nil {
		return errp.WithStack(err)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, limits.Receive); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(buf, binary.LittleEndian, limits.Change); err != nil {
		return errp.WithStack(err)
	}
	return bucketConfig.Put([]byte("gapLimits"), buf.Bytes())
}

// GapLimits implements transactions.DBTxInterface.
func (tx *Tx) GapLimits() (types.GapLimits, error) {
	bucketConfig := tx.tx.Bucket([]byte(bucketConfigKey))
	if bucketConfig == nil {
		return types.GapLimits{}, nil
	}
	if value := bucketConfig.Get([]byte(`gapLimits`)); value != nil {
		limits := types.GapLimits{}
		reader := bytes.NewReader(value)
		if err := binary.Read(reader, binary.LittleEndian, &limits.Receive); err != nil {
			return types.GapLimits{}, errp.WithStack(err)
		}
		if err := binary.Read(reader, binary.LittleEndian, &limits.Change); err != nil {
			return types.GapLimits{}, errp.WithStack(err)
		}
		return limits, nil
	}
	return types.GapLimits{}, nil
}
