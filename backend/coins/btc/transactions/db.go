package transactions

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
)

// DBTxInterface needs to be implemented to persist all wallet/transaction related data.
type DBTxInterface interface {
	// Commit closes the transaction, writing the changes.
	Commit() error
	// Rollback closes the transaction without writing anything and be called safely after Commit().
	Rollback()
	// PutTx stores a transaction and it's height (according to
	// https://github.com/kyuupichan/electrumx/blob/46f245891cb62845f9eec0f9549526a7e569eb03/docs/protocol-basics.rst#status).
	PutTx(txHash chainhash.Hash, tx *wire.MsgTx, height int) error
	// DeleteTx deletes a transaction (nothing happens if not found).
	DeleteTx(txHash chainhash.Hash)
	// AddAddressToTx adds an address associated with a transaction. Retrieve them with with
	// `TxInfo()`.
	AddAddressToTx(chainhash.Hash, btcutil.Address) error
	RemoveAddressFromTx(chainhash.Hash, btcutil.Address) (bool, error)
	// TxInfo retrieves all data stored with for a transaction. Default values (nil, nil, 0) are
	// returned for the values not found.
	TxInfo(chainhash.Hash) (tx *wire.MsgTx, addresses []string, height int, err error)
	// Transactions retrieves all stored trasaction hashes.
	Transactions() ([]chainhash.Hash, error)
	// UnverifiedTransactions retrieves all stored trasaction hashes of unverified transactions.
	UnverifiedTransactions() ([]chainhash.Hash, error)
	// PutInput stores a transaction input. It is referenced by output it spends. The transaction
	// hash of the transaction this input was found in is recorded. TODO: store slice of inputs
	// along with the txhash they appear in. If there are more than one, a double spend is detected.
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
	PutAddressHistory(btcutil.Address, client.TxHistory) error
	// AddressHistory retrieves an address history. If not found, returns an empty history.
	AddressHistory(btcutil.Address) (client.TxHistory, error)
}

// DBInterface can be implemented by database backends to open database transactions.
type DBInterface interface {
	// Begin starts a DB transaction. Apply `defer tx.Rollback()` in any case after. Use
	// `tx.Commit()` to commit the write operations.
	Begin() (DBTxInterface, error)
}
