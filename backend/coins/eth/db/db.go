// SPDX-License-Identifier: Apache-2.0

package db

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
	"github.com/ethereum/go-ethereum/common"
	"go.etcd.io/bbolt"
)

// DB is a bbolt key/value database.
type DB struct {
	db *bbolt.DB
}

// NewDB creates/opens a new db.
func NewDB(filename string) (*DB, error) {
	db, err := bbolt.Open(filename, 0600, nil)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(filename, 0600); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &DB{db: db}, nil
}

// BeginForSender implements Interface.
func (db *DB) BeginForSender(chainID uint64, sender common.Address) (TxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, err
	}
	bucketOutgoingTransactions, err := tx.CreateBucketIfNotExists([]byte(fmt.Sprintf("%d-%s", chainID, sender.Hex())))
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	return &Tx{
		tx:                         tx,
		bucketOutgoingTransactions: bucketOutgoingTransactions,
	}, nil
}

// DeleteOutgoingTransaction implements TxInterface.
func (tx *Tx) DeleteOutgoingTransaction(hash common.Hash) error {
	return tx.bucketOutgoingTransactions.Delete(hash.Bytes())
}

// Close implements Interface.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements TxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketOutgoingTransactions *bbolt.Bucket
}

// Rollback implements TxInterface.
func (tx *Tx) Rollback() {
	// Only possible error is ErrTxClosed.
	_ = tx.tx.Rollback()
}

// Commit implements TxInterface.
func (tx *Tx) Commit() error {
	return tx.tx.Commit()
}

// PutOutgoingTransaction implements TxInterface.
func (tx *Tx) PutOutgoingTransaction(transaction *types.TransactionWithMetadata) error {
	return tx.bucketOutgoingTransactions.Put(
		transaction.Transaction.Hash().Bytes(),
		jsonp.MustMarshal(transaction))
}

// OutgoingTransactions implements TxInterface.
func (tx *Tx) OutgoingTransactions() ([]*types.TransactionWithMetadata, error) {
	transactions := []*types.TransactionWithMetadata{}
	cursor := tx.bucketOutgoingTransactions.Cursor()
	for txHash, txSerialized := cursor.First(); txSerialized != nil; txHash, txSerialized = cursor.Next() {
		transaction := new(types.TransactionWithMetadata)
		if err := json.Unmarshal(txSerialized, transaction); err != nil {
			return nil, errp.WithStack(err)
		}
		if !bytes.Equal(transaction.Transaction.Hash().Bytes(), txHash) {
			return nil, errp.Newf("deserialized tx hash does not match serialized tx hash")
		}
		transactions = append(transactions, transaction)
	}
	return transactions, nil
}
