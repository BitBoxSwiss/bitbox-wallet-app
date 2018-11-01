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

package headersdb

import (
	"bytes"
	"encoding/binary"

	"github.com/btcsuite/btcd/wire"
	bbolt "github.com/coreos/bbolt"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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

const (
	bucketInfo    = "info"
	bucketHeaders = "headers"
)

// Begin implements headers.DBInterface.
func (db *DB) Begin() (headers.DBTxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, err
	}
	bucket, err := tx.CreateBucketIfNotExists([]byte("headers"))
	if err != nil {
		return nil, err
	}
	bucketInfo, err := bucket.CreateBucketIfNotExists([]byte(bucketInfo))
	if err != nil {
		return nil, err
	}
	bucketHeaders, err := bucket.CreateBucketIfNotExists([]byte(bucketHeaders))
	if err != nil {
		return nil, err
	}
	return &Tx{
		tx:            tx,
		bucketInfo:    bucketInfo,
		bucketHeaders: bucketHeaders,
	}, nil
}

// Tx implements headers.DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketInfo    *bbolt.Bucket
	bucketHeaders *bbolt.Bucket
}

// Rollback implements headers.DBTxInterface.
func (tx *Tx) Rollback() {
	// Only possible error is ErrTxClosed.
	_ = tx.tx.Rollback()
}

// Commit implements headers.DBTxInterface.
func (tx *Tx) Commit() error {
	return tx.tx.Commit()
}

func serInt(i int) []byte {
	var buffer bytes.Buffer
	if err := binary.Write(&buffer, binary.BigEndian, int64(i)); err != nil {
		panic(err)
	}
	return buffer.Bytes()
}

// PutTip implements headers.DBTxInterface.
func (tx *Tx) PutTip(tip int) error {
	return tx.bucketInfo.Put([]byte("tip"), serInt(tip))
}

// Tip implements headers.DBTxInterface.
func (tx *Tx) Tip() (int, error) {
	if value := tx.bucketInfo.Get([]byte("tip")); value != nil {
		var tip int64
		if err := binary.Read(bytes.NewReader(value), binary.BigEndian, &tip); err != nil {
			return 0, errp.WithStack(err)
		}
		return int(tip), nil
	}

	return -1, nil
}

// PutHeader implements headers.DBTxInterface.
func (tx *Tx) PutHeader(tip int, header *wire.BlockHeader) error {
	var headerSer bytes.Buffer
	if err := header.Serialize(&headerSer); err != nil {
		return errp.WithStack(err)
	}
	if err := tx.bucketHeaders.Put(serInt(tip), headerSer.Bytes()); err != nil {
		return err
	}
	return tx.PutTip(tip)
}

// HeaderByHeight implements headers.DBTxInterface.
func (tx *Tx) HeaderByHeight(height int) (*wire.BlockHeader, error) {
	tip, err := tx.Tip()
	if err != nil {
		return nil, err
	}
	if tip < height {
		return nil, nil
	}
	if value := tx.bucketHeaders.Get(serInt(height)); value != nil {
		header := &wire.BlockHeader{}
		if err := header.Deserialize(bytes.NewReader(value)); err != nil {
			return nil, errp.WithStack(err)
		}
		return header, nil
	}
	return nil, nil
}
