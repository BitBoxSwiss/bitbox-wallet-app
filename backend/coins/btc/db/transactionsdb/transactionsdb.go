// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package transactionsdb

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"time"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"go.etcd.io/bbolt"
)

const (
	bucketTransactions           = "transactions"
	bucketUnverifiedTransactions = "unverifiedTransactions"
	bucketInputs                 = "inputs"
	bucketOutputs                = "outputs"
	bucketAddressHistories       = "addressHistories"
	bucketConfig                 = "config"
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
func (db *DB) Begin() (transactions.DBTxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketTransactions))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketUnverifiedTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketUnverifiedTransactions))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketInputs, err := tx.CreateBucketIfNotExists([]byte(bucketInputs))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketOutputs, err := tx.CreateBucketIfNotExists([]byte(bucketOutputs))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketAddressHistories, err := tx.CreateBucketIfNotExists([]byte(bucketAddressHistories))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	bucketConfig, err := tx.CreateBucketIfNotExists([]byte(bucketConfig))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return &Tx{
		tx:                           tx,
		bucketTransactions:           bucketTransactions,
		bucketUnverifiedTransactions: bucketUnverifiedTransactions,
		bucketInputs:                 bucketInputs,
		bucketOutputs:                bucketOutputs,
		bucketAddressHistories:       bucketAddressHistories,
		bucketConfig:                 bucketConfig,
	}, nil
}

// Close implements transactions.Close.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements transactions.DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketTransactions           *bbolt.Bucket
	bucketUnverifiedTransactions *bbolt.Bucket
	bucketInputs                 *bbolt.Bucket
	bucketOutputs                *bbolt.Bucket
	bucketAddressHistories       *bbolt.Bucket
	bucketConfig                 *bbolt.Bucket
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
	found, err := readJSON(tx.bucketTransactions, key, walletTx)
	if err != nil {
		return err
	}
	if !found {
		now := time.Now()
		walletTx.CreatedTimestamp = &now
	}
	f(walletTx)
	return writeJSON(tx.bucketTransactions, key, walletTx)
}

// TxInfo implements transactions.DBTxInterface.
func (tx *Tx) TxInfo(txHash chainhash.Hash) (
	*transactions.DBTxInfo, error) {
	walletTx := newWalletTransaction()
	if _, err := readJSON(tx.bucketTransactions, txHash[:], walletTx); err != nil {
		return nil, err
	}
	walletTx.TxHash = txHash
	return walletTx, nil
}

// PutTx implements transactions.DBTxInterface.
func (tx *Tx) PutTx(txHash chainhash.Hash, msgTx *wire.MsgTx, height int) error {
	var verified *bool
	err := tx.modifyTx(txHash[:], func(walletTx *transactions.DBTxInfo) {
		verified = walletTx.Verified
		walletTx.Tx = msgTx
		walletTx.Height = height
	})
	if err != nil {
		return err
	}
	if verified == nil {
		return tx.bucketUnverifiedTransactions.Put(txHash[:], nil)
	}
	return nil
}

// DeleteTx implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteTx(txHash chainhash.Hash) {
	if err := tx.bucketTransactions.Delete(txHash[:]); err != nil {
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
	return getTransactions(tx.bucketTransactions)
}

// UnverifiedTransactions implements transactions.DBTxInterface.
func (tx *Tx) UnverifiedTransactions() ([]chainhash.Hash, error) {
	return getTransactions(tx.bucketUnverifiedTransactions)
}

// MarkTxVerified implements transactions.DBTxInterface.
func (tx *Tx) MarkTxVerified(txHash chainhash.Hash, headerTimestamp time.Time) error {
	if err := tx.bucketUnverifiedTransactions.Delete(txHash[:]); err != nil {
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
	return tx.bucketInputs.Put([]byte(outPoint.String()), txHash[:])
}

// Input implements transactions.DBTxInterface.
func (tx *Tx) Input(outPoint wire.OutPoint) (*chainhash.Hash, error) {
	if value := tx.bucketInputs.Get([]byte(outPoint.String())); value != nil {
		return chainhash.NewHash(value)
	}
	return nil, nil
}

// DeleteInput implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteInput(outPoint wire.OutPoint) {
	if err := tx.bucketInputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutOutput implements transactions.DBTxInterface.
func (tx *Tx) PutOutput(outPoint wire.OutPoint, txOut *wire.TxOut) error {
	return writeJSON(tx.bucketOutputs, []byte(outPoint.String()), txOut)
}

// Output implements transactions.DBTxInterface.
func (tx *Tx) Output(outPoint wire.OutPoint) (*wire.TxOut, error) {
	txOut := &wire.TxOut{}
	found, err := readJSON(tx.bucketOutputs, []byte(outPoint.String()), txOut)
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
	cursor := tx.bucketOutputs.Cursor()
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
	if err := tx.bucketOutputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutAddressHistory implements transactions.DBTxInterface.
func (tx *Tx) PutAddressHistory(scriptHashHex blockchain.ScriptHashHex, history blockchain.TxHistory) error {
	return writeJSON(tx.bucketAddressHistories, []byte(string(scriptHashHex)), history)
}

// AddressHistory implements transactions.DBTxInterface.
func (tx *Tx) AddressHistory(scriptHashHex blockchain.ScriptHashHex) (blockchain.TxHistory, error) {
	history := blockchain.TxHistory{}
	_, err := readJSON(tx.bucketAddressHistories, []byte(string(scriptHashHex)), &history)
	return history, err
}

// PutGapLimits implements transactions.DBTxInterface.
func (tx *Tx) PutGapLimits(limits types.GapLimits) error {
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, limits.Receive); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(buf, binary.LittleEndian, limits.Change); err != nil {
		return errp.WithStack(err)
	}
	return tx.bucketConfig.Put([]byte("gapLimits"), buf.Bytes())
}

// GapLimits implements transactions.DBTxInterface.
func (tx *Tx) GapLimits() (types.GapLimits, error) {
	if value := tx.bucketConfig.Get([]byte(`gapLimits`)); value != nil {
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
