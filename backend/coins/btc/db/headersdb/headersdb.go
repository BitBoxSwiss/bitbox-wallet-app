// SPDX-License-Identifier: Apache-2.0

package headersdb

import (
	"bytes"
	"os"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
)

const headerSize = 80

// DB is a database for storing headers. The database is simply a file where headers are appended
// to. Loolup is quick as each header is 80 bytes.
type DB struct {
	file *os.File
	log  *logrus.Entry
	lock locker.Locker
}

// NewDB creates/opens a new db.
func NewDB(filename string, log *logrus.Entry) (*DB, error) {
	file, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	db := &DB{
		file: file,
		log:  log,
	}
	if err := db.validateSize(); err != nil {
		_ = file.Close()
		return nil, err
	}
	if err := db.fixTrailingZeroesHeaders(); err != nil {
		_ = file.Close()
		return nil, err
	}
	return db, nil
}

func (db *DB) validateSize() error {
	fileInfo, err := db.file.Stat()
	if err != nil {
		return errp.WithStack(err)
	}
	if fileInfo.Size()%headerSize != 0 {
		return errp.Newf("invalid headers file size: %d", fileInfo.Size())
	}
	return nil
}

// fixTrailingZeroesHeaders deletes trailing headers that are stored as zero bytes. Zero headers
// don't exist in reality and could end up in the database file as a result of an interrupted
// `file.WriteAt()` call.
func (db *DB) fixTrailingZeroesHeaders() error {
	for {
		tip, err := db.tip()
		if err != nil {
			return err
		}
		if tip == -1 {
			return nil
		}
		header, err := db.HeaderByHeight(tip)
		if err != nil {
			return err
		}
		if header != nil {
			return nil
		}
		db.log.Errorf("Loading headers DB; found empty trailing header at height %d. Fixing.", tip)
		if err := db.RevertTo(tip - 1); err != nil {
			return err
		}
	}
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
	// This call, if interrupted, can leave zero bytes at the end of the file without writing the
	// data. We can't fix it here as the process may have ended. It is fixed at DB loading time, see
	// `fixTrailingZeroesHeaders()`.
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
