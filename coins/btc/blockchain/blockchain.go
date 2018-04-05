package blockchain

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
)

// Interface is the interface to a blockchain index backend. Currently geared to Electrum, though
// other backends can implement the same interface.
//go:generate mockery -name Interface
type Interface interface {
	ScriptHashGetHistory(string, func(client.TxHistory) error, func(error)) error
	TransactionGet(chainhash.Hash, func(*wire.MsgTx) error, func(error)) error
	ScriptHashSubscribe(string, func(string) error, func(error)) error
	HeadersSubscribe(func(*client.Header) error, func(error)) error
	TransactionBroadcast(*wire.MsgTx) error
	RelayFee() (btcutil.Amount, error)
	EstimateFee(int, func(btcutil.Amount) error, func(error)) error
	Close()
}
