// SPDX-License-Identifier: Apache-2.0

package db

import (
	"bytes"
	"encoding/json"
	"sort"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
	"go.etcd.io/bbolt"
)

const (
	bucketOutgoingTransactions = "pendingTransactions"
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
	return &DB{db: db}, nil
}

// Begin implements transactions.Begin.
func (db *DB) Begin() (TxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, err
	}
	bucketOutgoingTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketOutgoingTransactions))
	if err != nil {
		return nil, err
	}
	return &Tx{
		tx:                         tx,
		bucketOutgoingTransactions: bucketOutgoingTransactions,
	}, nil
}

// Close implements transactions.Close.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketOutgoingTransactions *bbolt.Bucket
}

// Rollback implements DBTxInterface.
func (tx *Tx) Rollback() {
	// Only possible error is ErrTxClosed.
	_ = tx.tx.Rollback()
}

// Commit implements DBTxInterface.
func (tx *Tx) Commit() error {
	return tx.tx.Commit()
}

// PutOutgoingTransaction implements DBTxInterface.
func (tx *Tx) PutOutgoingTransaction(transaction *types.TransactionWithMetadata) error {
	return tx.bucketOutgoingTransactions.Put(
		transaction.Transaction.Hash().Bytes(),
		jsonp.MustMarshal(transaction))
}

type byNonce []*types.TransactionWithMetadata

func (txs byNonce) Len() int      { return len(txs) }
func (txs byNonce) Swap(i, j int) { txs[i], txs[j] = txs[j], txs[i] }
func (txs byNonce) Less(i, j int) bool {
	return txs[i].Transaction.Nonce() < txs[j].Transaction.Nonce()
}

// OutgoingTransactions implements DBTxInterface.
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
	sort.Sort(sort.Reverse(byNonce(transactions)))
	return transactions, nil
}
