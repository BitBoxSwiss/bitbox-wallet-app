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

import "github.com/ethereum/go-ethereum/core/types"

// TxInterface needs to be implemented to persist all wallet/transaction related data.
type TxInterface interface {
	// Commit closes the transaction, writing the changes.
	Commit() error

	// Rollback closes the transaction without writing anything and be called safely after Commit().
	Rollback()

	// PutPendingOutgoingTransaction stores the transaction in the collection of pending outgoing
	// transactions.
	PutPendingOutgoingTransaction(*types.Transaction) error

	// PendingOutgoingTransactions returns the stored list of pending outgoing transactions, sorted
	// descending by the transaction nonce.
	PendingOutgoingTransactions() ([]*types.Transaction, error)
}

// Interface can be implemented by database backends to open database transactions.
type Interface interface {
	// Begin starts a DB transaction. Apply `defer tx.Rollback()` in any case after. Use
	// `tx.Commit()` to commit the write operations.
	Begin() (TxInterface, error)
	Close() error
}
