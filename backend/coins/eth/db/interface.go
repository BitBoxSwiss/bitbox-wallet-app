// SPDX-License-Identifier: Apache-2.0

package db

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"

// TxInterface needs to be implemented to persist all wallet/transaction related data.
type TxInterface interface {
	// Commit closes the transaction, writing the changes.
	Commit() error

	// Rollback closes the transaction without writing anything and be called safely after Commit().
	Rollback()

	// PutOutgoingTransaction stores the transaction in the collection of outgoing transactions.
	PutOutgoingTransaction(*types.TransactionWithMetadata) error

	// OutgoingTransactions returns the stored list of outgoing transactions, sorted descending by
	// the transaction nonce.
	OutgoingTransactions() ([]*types.TransactionWithMetadata, error)
}

// Interface can be implemented by database backends to open database transactions.
type Interface interface {
	// Begin starts a DB transaction. Apply `defer tx.Rollback()` in any case after. Use
	// `tx.Commit()` to commit the write operations.
	Begin() (TxInterface, error)
	Close() error
}
