// SPDX-License-Identifier: Apache-2.0

package headers

import "github.com/btcsuite/btcd/wire"

type dbMock struct {
	putHeader      func(height int, header *wire.BlockHeader) error
	headerByHeight func(height int) (*wire.BlockHeader, error)
	revertTo       func(tip int) error
	tip            func() (int, error)
	flush          func() error
	close          func() error
}

func (db *dbMock) PutHeader(height int, header *wire.BlockHeader) error {
	if db.putHeader != nil {
		return db.putHeader(height, header)
	}
	return nil
}
func (db *dbMock) HeaderByHeight(height int) (*wire.BlockHeader, error) {
	if db.headerByHeight != nil {
		return db.headerByHeight(height)
	}
	return nil, nil
}
func (db *dbMock) RevertTo(tip int) error {
	if db.revertTo != nil {
		return db.revertTo(tip)
	}
	return nil
}
func (db *dbMock) Tip() (int, error) {
	if db.tip != nil {
		return db.tip()
	}
	return 100000, nil
}
func (db *dbMock) Flush() error {
	if db.flush != nil {
		return db.flush()
	}
	return nil
}
func (db *dbMock) Close() error {
	if db.close != nil {
		return db.close()
	}
	return nil
}
