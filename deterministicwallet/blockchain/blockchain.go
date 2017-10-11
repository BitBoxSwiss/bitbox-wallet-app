package blockchain

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"

	"github.com/shiftdevices/godbb/electrum/client"
)

type Interface interface {
	AddressGetHistory(string, func([]*client.TX) error, func(error)) error
	TransactionGet(chainhash.Hash, func(*wire.MsgTx) error, func(error)) error
	AddressSubscribe(string, func(string) error, func(error)) error
	AddressListUnspent(address string) ([]*client.UTXO, error)
	HeadersSubscribe() (*client.Header, error)
	TransactionBroadcast([]byte) error
	RelayFee() (btcutil.Amount, error)
}
