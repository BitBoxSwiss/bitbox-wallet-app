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

package db

import (
	"bytes"
	"sort"

	bbolt "github.com/coreos/bbolt"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

const (
	bucketPendingOutgoingTransactions = "pendingTransactions"
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
	bucketPendingOutgoingTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketPendingOutgoingTransactions))
	if err != nil {
		return nil, err
	}
	return &Tx{
		tx:                                tx,
		bucketPendingOutgoingTransactions: bucketPendingOutgoingTransactions,
	}, nil
}

// Close implements transactions.Close.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketPendingOutgoingTransactions *bbolt.Bucket
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

// PutPendingOutgoingTransaction implements DBTxInterface.
func (tx *Tx) PutPendingOutgoingTransaction(transaction *types.Transaction) error {
	txSerialized, err := rlp.EncodeToBytes(transaction)
	if err != nil {
		return err
	}
	return tx.bucketPendingOutgoingTransactions.Put(transaction.Hash().Bytes(), txSerialized)
}

type byNonce []*types.Transaction

func (txs byNonce) Len() int           { return len(txs) }
func (txs byNonce) Less(i, j int) bool { return txs[i].Nonce() < txs[j].Nonce() }
func (txs byNonce) Swap(i, j int)      { txs[i], txs[j] = txs[j], txs[i] }

// PendingOutgoingTransactions implements DBTxInterface.
func (tx *Tx) PendingOutgoingTransactions() ([]*types.Transaction, error) {
	transactions := []*types.Transaction{}
	cursor := tx.bucketPendingOutgoingTransactions.Cursor()
	for txHash, txSerialized := cursor.First(); txSerialized != nil; txHash, txSerialized = cursor.Next() {
		transaction := new(types.Transaction)
		if err := rlp.DecodeBytes(txSerialized, transaction); err != nil {
			return nil, errp.WithStack(err)
		}
		if !bytes.Equal(transaction.Hash().Bytes(), txHash) {
			return nil, errp.Newf("deserialized tx hash does not match serialized tx hash")
		}
		transactions = append(transactions, transaction)
	}
	sort.Sort(sort.Reverse(byNonce(transactions)))
	return transactions, nil
}
