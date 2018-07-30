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

// DBTxInterface needs to be implemented to persist all headers related data.
type DBTxInterface interface {
	// Commit closes the transaction, writing the changes.
	Commit() error
	// Rollback closes the transaction without writing anything and be called safely after Commit().
	Rollback()
	// PutHeader stores a header at a new tip.
	PutHeader(tip int, header *wire.BlockHeader) error
	HeaderByHeight(height int) (*wire.BlockHeader, error)
	PutTip(tip int) error
	Tip() (int, error)
}

// DBInterface can be implemented by database backends to open database transactions.
type DBInterface interface {
	// Begin starts a DB transaction. Apply `defer tx.Rollback()` in any case after. Use
	// `tx.Commit()` to commit the write operations.
	Begin() (DBTxInterface, error)
}
