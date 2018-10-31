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
	bbolt "github.com/coreos/bbolt"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	bucketPendingTransactions = "pendingTransactions"
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
func (db *DB) Begin() (DBTxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, err
	}
	bucketPendingTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketPendingTransactions))
	if err != nil {
		return nil, err
	}
	return &Tx{
		tx:                        tx,
		bucketPendingTransactions: bucketPendingTransactions,
	}, nil
}

// Close implements transactions.Close.
func (db *DB) Close() error {
	return errp.WithStack(db.db.Close())
}

// Tx implements DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketPendingTransactions *bbolt.Bucket
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
