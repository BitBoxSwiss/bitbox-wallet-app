package blockchain

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"

	"github.com/shiftdevices/godbb/electrum/client"
)

type Interface interface {
	ScriptHashGetHistory(string, func([]*client.TX) error, func(error)) error
	TransactionGet(chainhash.Hash, func(*wire.MsgTx) error, func(error)) error
	ScriptHashSubscribe(string, func(string) error, func(error)) error
	HeadersSubscribe() (*client.Header, error)
	TransactionBroadcast([]byte) error
	RelayFee() (btcutil.Amount, error)
	EstimateFee(int, func(btcutil.Amount) error, func(error)) error
	Close()
}
