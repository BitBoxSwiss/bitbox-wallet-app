package transactionsdb

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	bbolt "github.com/coreos/bbolt"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/util/errp"
)

const (
	bucketTransactions           = "transactions"
	bucketUnverifiedTransactions = "unverifiedTransactions"
	bucketInputs                 = "inputs"
	bucketOutputs                = "outputs"
	bucketAddressHistories       = "addressHistories"
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

// Begin implements transactions.Begin.
func (db *DB) Begin() (transactions.DBTxInterface, error) {
	tx, err := db.db.Begin(true)
	if err != nil {
		return nil, err
	}
	bucketTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketTransactions))
	if err != nil {
		return nil, err
	}
	bucketUnverifiedTransactions, err := tx.CreateBucketIfNotExists([]byte(bucketUnverifiedTransactions))
	if err != nil {
		return nil, err
	}
	bucketInputs, err := tx.CreateBucketIfNotExists([]byte(bucketInputs))
	if err != nil {
		return nil, err
	}
	bucketOutputs, err := tx.CreateBucketIfNotExists([]byte(bucketOutputs))
	if err != nil {
		return nil, err
	}
	bucketAddressHistories, err := tx.CreateBucketIfNotExists([]byte(bucketAddressHistories))
	if err != nil {
		return nil, err
	}
	return &Tx{
		tx:                           tx,
		bucketTransactions:           bucketTransactions,
		bucketUnverifiedTransactions: bucketUnverifiedTransactions,
		bucketInputs:                 bucketInputs,
		bucketOutputs:                bucketOutputs,
		bucketAddressHistories:       bucketAddressHistories,
	}, nil
}

// Tx implements transactions.DBTxInterface.
type Tx struct {
	tx *bbolt.Tx

	bucketTransactions           *bbolt.Bucket
	bucketUnverifiedTransactions *bbolt.Bucket
	bucketInputs                 *bbolt.Bucket
	bucketOutputs                *bbolt.Bucket
	bucketAddressHistories       *bbolt.Bucket
}

// Rollback implements transactions.DBTxInterface.
func (tx *Tx) Rollback() {
	// Only possible error is ErrTxClosed.
	_ = tx.tx.Rollback()
}

// Commit implements transactions.DBTxInterface.
func (tx *Tx) Commit() error {
	return tx.tx.Commit()
}

type walletTransaction struct {
	Tx        *wire.MsgTx
	Height    int
	Addresses map[string]bool `json:"addresses"`
	Verified  bool
}

func newWalletTransaction() *walletTransaction {
	return &walletTransaction{
		Tx:        nil,
		Height:    0,
		Addresses: map[string]bool{},
	}
}

func readJSON(bucket *bbolt.Bucket, key []byte, value interface{}) (bool, error) {
	if jsonBytes := bucket.Get(key); jsonBytes != nil {
		return true, errp.WithStack(json.Unmarshal(jsonBytes, value))
	}
	return false, nil
}

func writeJSON(bucket *bbolt.Bucket, key []byte, value interface{}) error {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return bucket.Put(key, jsonBytes)
}

func (tx *Tx) modifyTx(key []byte, f func(value *walletTransaction)) error {
	walletTx := newWalletTransaction()
	if _, err := readJSON(tx.bucketTransactions, key, walletTx); err != nil {
		return err
	}
	f(walletTx)
	return writeJSON(tx.bucketTransactions, key, walletTx)
}

// TxInfo implements transactions.DBTxInterface.
func (tx *Tx) TxInfo(txHash chainhash.Hash) (*wire.MsgTx, []string, int, error) {
	walletTx := newWalletTransaction()
	if _, err := readJSON(tx.bucketTransactions, txHash[:], walletTx); err != nil {
		return nil, nil, 0, err
	}
	addresses := []string{}
	for address := range walletTx.Addresses {
		addresses = append(addresses, address)
	}
	return walletTx.Tx, addresses, walletTx.Height, nil
}

// PutTx implements transactions.DBTxInterface.
func (tx *Tx) PutTx(txHash chainhash.Hash, msgTx *wire.MsgTx, height int) error {
	var verified bool
	err := tx.modifyTx(txHash[:], func(walletTx *walletTransaction) {
		verified = walletTx.Verified
		walletTx.Tx = msgTx
		walletTx.Height = height
	})
	if err != nil {
		return err
	}
	if !verified {
		return tx.bucketUnverifiedTransactions.Put(txHash[:], nil)
	}
	return nil
}

// DeleteTx implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteTx(txHash chainhash.Hash) {
	if err := tx.bucketTransactions.Delete(txHash[:]); err != nil {
		panic(errp.WithStack(err))
	}
}

// AddAddressToTx implements transactions.DBTxInterface.
func (tx *Tx) AddAddressToTx(txHash chainhash.Hash, address btcutil.Address) error {
	return tx.modifyTx(txHash[:], func(walletTx *walletTransaction) {
		walletTx.Addresses[address.String()] = true
	})
}

// RemoveAddressFromTx implements transactions.DBTxInterface.
func (tx *Tx) RemoveAddressFromTx(txHash chainhash.Hash, address btcutil.Address) (bool, error) {
	var empty bool
	err := tx.modifyTx(txHash[:], func(walletTx *walletTransaction) {
		delete(walletTx.Addresses, address.String())
		empty = len(walletTx.Addresses) == 0
	})
	return empty, err
}

func getTransactions(bucket *bbolt.Bucket) ([]chainhash.Hash, error) {
	result := []chainhash.Hash{}
	cursor := bucket.Cursor()
	for txHashBytes, _ := cursor.First(); txHashBytes != nil; txHashBytes, _ = cursor.Next() {
		var txHash chainhash.Hash
		if err := txHash.SetBytes(txHashBytes); err != nil {
			return nil, errp.WithStack(err)
		}
		result = append(result, txHash)
	}
	return result, nil
}

// Transactions implements transactions.DBTxInterface.
func (tx *Tx) Transactions() ([]chainhash.Hash, error) {
	return getTransactions(tx.bucketTransactions)
}

// UnverifiedTransactions implements transactions.DBTxInterface.
func (tx *Tx) UnverifiedTransactions() ([]chainhash.Hash, error) {
	return getTransactions(tx.bucketUnverifiedTransactions)
}

// PutInput implements transactions.DBTxInterface.
func (tx *Tx) PutInput(outPoint wire.OutPoint, txHash chainhash.Hash) error {
	return tx.bucketInputs.Put([]byte(outPoint.String()), txHash[:])
}

// Input implements transactions.DBTxInterface.
func (tx *Tx) Input(outPoint wire.OutPoint) (*chainhash.Hash, error) {
	if value := tx.bucketInputs.Get([]byte(outPoint.String())); value != nil {
		return chainhash.NewHash(value)
	}
	return nil, nil
}

// DeleteInput implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteInput(outPoint wire.OutPoint) {
	if err := tx.bucketInputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutOutput implements transactions.DBTxInterface.
func (tx *Tx) PutOutput(outPoint wire.OutPoint, txOut *wire.TxOut) error {
	return writeJSON(tx.bucketOutputs, []byte(outPoint.String()), txOut)
}

// Output implements transactions.DBTxInterface.
func (tx *Tx) Output(outPoint wire.OutPoint) (*wire.TxOut, error) {
	txOut := &wire.TxOut{}
	found, err := readJSON(tx.bucketOutputs, []byte(outPoint.String()), txOut)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return txOut, nil
}

func parseOutPoint(outPointBytes []byte) (*wire.OutPoint, error) {
	split := strings.SplitN(string(outPointBytes), ":", 2)
	if len(split) != 2 {
		return nil, errp.Newf("wrong outPoint format %s", string(outPointBytes))
	}
	txHash, err := chainhash.NewHashFromStr(split[0])
	if err != nil {
		return nil, errp.WithStack(err)
	}
	index, err := strconv.ParseInt(split[1], 10, 32)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return wire.NewOutPoint(txHash, uint32(index)), nil
}

// Outputs implements transactions.DBTxInterface.
func (tx *Tx) Outputs() (map[wire.OutPoint]*wire.TxOut, error) {
	outputs := map[wire.OutPoint]*wire.TxOut{}
	cursor := tx.bucketOutputs.Cursor()
	for outPointBytes, txOutJSONBytes := cursor.First(); outPointBytes != nil; outPointBytes, txOutJSONBytes = cursor.Next() {
		txOut := &wire.TxOut{}
		if err := json.Unmarshal(txOutJSONBytes, txOut); err != nil {
			return nil, errp.WithStack(err)
		}
		outPoint, err := parseOutPoint(outPointBytes)
		if err != nil {
			return nil, err
		}
		outputs[*outPoint] = txOut
	}
	return outputs, nil
}

// DeleteOutput implements transactions.DBTxInterface. It panics if called from a read-only db
// transaction.
func (tx *Tx) DeleteOutput(outPoint wire.OutPoint) {
	if err := tx.bucketOutputs.Delete([]byte(outPoint.String())); err != nil {
		panic(errp.WithStack(err))
	}
}

// PutAddressHistory implements transactions.DBTxInterface.
func (tx *Tx) PutAddressHistory(address btcutil.Address, history client.TxHistory) error {
	return writeJSON(tx.bucketAddressHistories, []byte(address.String()), history)
}

// AddressHistory implements transactions.DBTxInterface.
func (tx *Tx) AddressHistory(address btcutil.Address) (client.TxHistory, error) {
	history := client.TxHistory{}
	_, err := readJSON(tx.bucketAddressHistories, []byte(address.String()), &history)
	return history, err
}
