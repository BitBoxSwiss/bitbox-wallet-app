// SPDX-License-Identifier: Apache-2.0

package transactions

import (
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
)

// DBTxInfo contains data stored for a wallet transaction.
type DBTxInfo struct {
	Tx               *wire.MsgTx     `json:"Tx"`
	Height           int             `json:"Height"`
	Addresses        map[string]bool `json:"addresses"`
	Verified         *bool           `json:"Verified"`
	HeaderTimestamp  *time.Time      `json:"ts"`
	CreatedTimestamp *time.Time      `json:"created"`

	// TxHash is the same as Tx.TxHash(), but since we already have this value in the database, it
	// is faster to access it this way than to recompute it.  It is not serialized and stored in the
	// database.
	TxHash chainhash.Hash `json:"-"`
}

// DBTxInterface needs to be implemented to persist all wallet/transaction related data.
type DBTxInterface interface {
	// Commit closes the transaction, writing the changes.
	Commit() error

	// Rollback closes the transaction without writing anything and can be called safely after
	// Commit().
	Rollback()

	// PutTx stores a transaction and it's height (according to
	// https://github.com/kyuupichan/electrumx/blob/46f245891cb62845f9eec0f9549526a7e569eb03/docs/protocol-basics.rst#status).
	PutTx(txHash chainhash.Hash, tx *wire.MsgTx, height int, headerTimestamp *time.Time) error

	// DeleteTx deletes a transaction (nothing happens if not found).
	DeleteTx(txHash chainhash.Hash)

	// AddAddressToTx adds an address associated with a transaction. Retrieve them with `TxInfo()`.
	AddAddressToTx(chainhash.Hash, blockchain.ScriptHashHex) error
	RemoveAddressFromTx(chainhash.Hash, blockchain.ScriptHashHex) (bool, error)

	// TxInfo retrieves all data stored with for a transaction. nil is returned if not found.
	TxInfo(chainhash.Hash) (*DBTxInfo, error)

	// Transactions retrieves all stored transaction hashes.
	Transactions() ([]chainhash.Hash, error)

	// UnverifiedTransactions retrieves all stored transaction hashes of unverified transactions.
	UnverifiedTransactions() ([]chainhash.Hash, error)

	// MarkTxVerified marks a tx as verified. Stores timestamp of the header this tx appears in.
	MarkTxVerified(txHash chainhash.Hash, headerTimestamp time.Time) error

	// PutInput stores a transaction input. It is referenced by the output it spends. The
	// transaction hash of the transaction this input was found in is recorded. TODO: store slice of
	// inputs along with the txhash they appear in. If there are more than one, a double spend is
	// detected.
	PutInput(wire.OutPoint, chainhash.Hash) error

	// Input retrieves an input. `nil, nil` is returned if not found.
	Input(wire.OutPoint) (*chainhash.Hash, error)

	// DeleteInput deletes an input (nothing happens if not found).
	DeleteInput(wire.OutPoint)

	// PutOutput stores an Output.
	PutOutput(wire.OutPoint, *wire.TxOut) error

	// Output retrieves an output. `nil, nil` is returned if not found.
	Output(wire.OutPoint) (*wire.TxOut, error)
	Outputs() (map[wire.OutPoint]*wire.TxOut, error)

	// DeleteOutput deletes an output (nothing happens if not found).
	DeleteOutput(wire.OutPoint)

	// PutAddressHistory stores an address history.
	PutAddressHistory(blockchain.ScriptHashHex, blockchain.TxHistory) error

	// AddressHistory retrieves an address history. If not found, returns an empty history.
	AddressHistory(blockchain.ScriptHashHex) (blockchain.TxHistory, error)

	// PutGapLimits stores the gap limits for receive and change addresses.
	PutGapLimits(types.GapLimits) error

	// GapLimits returns the gap limit for receive and change addresses.
	// If none have been stored before, the default zero value is returned.
	GapLimits() (types.GapLimits, error)
}

// DBInterface can be implemented by database backends to open database transactions.
type DBInterface interface {
	// Begin starts a DB transaction. Apply `defer tx.Rollback()` in any case after. Use
	// `tx.Commit()` to commit the write operations.  If `writable` is true, write-operations are
	// permitted, and concurrent write- or read-transactions are serialized by blocking. If
	// `writable` is false, concurrent read-transactions are performed without blocking, unless
	// there is an ongoing write-transaction.
	Begin(writable bool) (DBTxInterface, error)
	Close() error
}

// DBUpdate updates the database. All changes are rolled back on error. The transaction is committed
// if the callback does not return an error.
func DBUpdate(db DBInterface, f func(DBTxInterface) error) error {
	dbTx, err := db.Begin(true)
	if err != nil {
		return err
	}
	defer dbTx.Rollback()
	if err := f(dbTx); err != nil {
		return err
	}
	return dbTx.Commit()
}

// DBView reads from the database. Any write-operations on the database transaction will result in
// an error. The return value of the callback is passed as the return value of the whole function
// for ease of use.
func DBView[R any](db DBInterface, f func(DBTxInterface) (R, error)) (R, error) {
	dbTx, err := db.Begin(false)
	if err != nil {
		var empty R
		return empty, errp.WithStack(err)
	}
	defer dbTx.Rollback()
	return f(dbTx)
}
