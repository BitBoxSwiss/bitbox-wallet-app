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
	"os"

	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
)

const headerSize = 80

// DB is a bbolt key/value database.
type DB struct {
	file *os.File
	lock locker.Locker
}

// NewDB creates/opens a new db.
func NewDB(filename string) (*DB, error) {
	file, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return &DB{file: file}, nil
}

func (db *DB) tip() (int, error) {
	fileInfo, err := db.file.Stat()
	if err != nil {
		return 0, errp.WithStack(err)
	}
	return int(fileInfo.Size()/headerSize) - 1, nil
}

// RevertTo implements headers.DBInterface.
func (db *DB) RevertTo(tip int) error {
	defer db.lock.Lock()()
	if tip < -1 {
		panic("invalid tip")
	}
	currentTip, err := db.tip()
	if err != nil {
		return err
	}
	if tip > currentTip {
		panic("revert must go backwards")
	}
	if err := db.file.Truncate(headerSize * int64(tip+1)); err != nil {
		return err
	}
	return nil
}

// Tip implements headers.DBInterface.
func (db *DB) Tip() (int, error) {
	defer db.lock.RLock()()
	return db.tip()
}

// PutHeader implements headers.DBInterface.
func (db *DB) PutHeader(height int, header *wire.BlockHeader) error {
	if height < 0 {
		panic("invalid height")
	}
	defer db.lock.Lock()()
	var headerSer bytes.Buffer
	if err := header.Serialize(&headerSer); err != nil {
		return errp.WithStack(err)
	}
	if _, err := db.file.WriteAt(headerSer.Bytes(), headerSize*int64(height)); err != nil {
		return errp.WithStack(err)
	}
	return nil
}

// HeaderByHeight implements headers.DBInterface.
func (db *DB) HeaderByHeight(height int) (*wire.BlockHeader, error) {
	defer db.lock.Lock()()
	tip, err := db.tip()
	if err != nil {
		return nil, err
	}
	if tip < height {
		return nil, nil
	}
	headerBytes := make([]byte, headerSize)
	if _, err := db.file.ReadAt(headerBytes, headerSize*int64(height)); err != nil {
		return nil, errp.WithStack(err)
	}
	if bytes.Equal(headerBytes, bytes.Repeat([]byte{0}, headerSize)) {
		return nil, nil
	}
	header := &wire.BlockHeader{}
	if err := header.Deserialize(bytes.NewReader(headerBytes)); err != nil {
		return nil, errp.WithStack(err)
	}
	return header, nil
}

// Flush implements headers.DBInterface.
func (db *DB) Flush() error {
	return db.file.Sync()
}

// Close closes the db file.
func (db *DB) Close() error {
	return db.file.Close()
}
