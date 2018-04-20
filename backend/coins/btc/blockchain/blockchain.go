package blockchain

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
)

// Interface is the interface to a blockchain index backend. Currently geared to Electrum, though
// other backends can implement the same interface.
//go:generate mockery -name Interface
type Interface interface {
	ScriptHashGetHistory(client.ScriptHashHex, func(client.TxHistory) error, func()) error
	TransactionGet(chainhash.Hash, func(*wire.MsgTx) error, func()) error
	ScriptHashSubscribe(client.ScriptHashHex, func(string) error, func()) error
	HeadersSubscribe(func(*client.Header) error, func()) error
	TransactionBroadcast(*wire.MsgTx) error
	RelayFee(func(btcutil.Amount) error, func()) error
	EstimateFee(int, func(*btcutil.Amount) error, func()) error
	Headers(int, int, func([]*wire.BlockHeader, int) error, func()) error
	GetMerkle(chainhash.Hash, int, func(merkle []client.TXHash, pos int) error, func()) error
	Close()
}
