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
