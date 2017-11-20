// Package client implements an Electrum JSON RPC client.
// See https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst
package client

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/util/errp"
)

const (
	clientVersion         = "0.0.1"
	clientProtocolVersion = "1.1"
)

// RPCClient describes the methods needed to communicate with an RPC server.
type RPCClient interface {
	Method(func([]byte) error, func(error), string, ...interface{}) error
	MethodSync(interface{}, string, ...interface{}) error
	SubscribeNotifications(string, func([]byte)) error
}

// ElectrumClient is a high level API access to an ElectrumX server.
// See https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst.
type ElectrumClient struct {
	rpc RPCClient

	addressNotificationCallbacks     map[string]func(string) error
	addressNotificationCallbacksLock sync.RWMutex
}

// NewElectrumClient creates a new Electrum client.
func NewElectrumClient(rpcClient RPCClient) (*ElectrumClient, error) {
	electrumClient := &ElectrumClient{
		rpc: rpcClient,
		addressNotificationCallbacks: map[string]func(string) error{},
	}
	// Install a callback for the address notifications, which directs the response to callbacks
	// installed by AddressSubscribe().
	if err := rpcClient.SubscribeNotifications(
		"blockchain.address.subscribe",
		func(responseBytes []byte) {
			// TODO example responsebytes, use for unit testing:
			// "[\"mn31QqyuBum6PFS7VFyo8oUL8Yc8G8MHZA\", \"3b98a4b9bed1312f4f53a1c6c9276b0ad8be68c57a5bcbe651688e4f4191b521\"]"
			response := []string{}
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				electrumClient.handleError(errp.WithStack(err))
				return
			}
			if len(response) != 2 {
				electrumClient.handleError(errp.New("unexpected response"))
				return
			}
			address := response[0]
			status := response[1]
			electrumClient.addressNotificationCallbacksLock.RLock()
			callback, ok := electrumClient.addressNotificationCallbacks[address]
			electrumClient.addressNotificationCallbacksLock.RUnlock()
			if ok {
				if err := callback(status); err != nil {
					electrumClient.handleError(err)
					return
				}
			}
		},
	); err != nil {
		return nil, err
	}

	go electrumClient.ping()

	return electrumClient, nil
}

// ping periodically pings the server to keep the connection alive.
func (client *ElectrumClient) ping() {
	for {
		log.Println("pinging the electrum server")
		_, err := client.ServerVersion()
		if err != nil {
			// TODO
			panic(err)
		}
		time.Sleep(time.Minute)
	}
}

type ServerVersion struct {
	Version         string
	ProtocolVersion string
}

func (version *ServerVersion) UnmarshalJSON(b []byte) error {
	slice := []string{}
	if err := json.Unmarshal(b, &slice); err != nil {
		return err
	}
	if len(slice) != 2 {
		return errp.New("unexpected reply")
	}
	version.Version = slice[0]
	version.ProtocolVersion = slice[1]
	return nil
}

// ServerVersion does the server.version() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#serverversion
func (client *ElectrumClient) ServerVersion() (*ServerVersion, error) {
	response := &ServerVersion{}
	err := client.rpc.MethodSync(response, "server.version", clientVersion, clientProtocolVersion)
	return response, err
}

type ServerFeatures struct {
	GenesisHash string `json:"genesis_hash"`
}

// ServerFeatures does the server.features() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#serverfeatures
func (client *ElectrumClient) ServerFeatures() (*ServerFeatures, error) {
	response := &ServerFeatures{}
	err := client.rpc.MethodSync(response, "server.features")
	return response, err
}

type Balance struct {
	Confirmed   int64 `json:"confirmed"`
	Unconfirmed int64 `json:"unconfirmed"`
}

// AddressGetBalance does the blockchain.address.get_balance() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainaddressget_balance
func (client *ElectrumClient) AddressGetBalance(
	address string,
	success func(*Balance) error,
	cleanup func(error)) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			response := &Balance{}
			if err := json.Unmarshal(responseBytes, response); err != nil {
				return errp.WithStack(err)
			}
			return success(response)
		},
		cleanup,
		"blockchain.address.get_balance",
		address)
}

type TX struct {
	Height int    `json:"height"`
	TXHash TXHash `json:"tx_hash"`
	Fee    *int64 `json:"fee"`
}

// AddressGetHistory does the blockchain.address.get_history() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchainaddressget_history
func (client *ElectrumClient) AddressGetHistory(
	address string,
	success func([]*TX) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			txs := []*TX{}
			if err := json.Unmarshal(responseBytes, &txs); err != nil {
				return errp.WithStack(err)
			}
			return success(txs)
		},
		cleanup,
		"blockchain.address.get_history",
		address)
}

// AddressSubscribe does the blockchain.address.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchainaddresssubscribe
func (client *ElectrumClient) AddressSubscribe(
	address string,
	success func(string) error,
	cleanup func(error),
) error {
	client.addressNotificationCallbacksLock.Lock()
	client.addressNotificationCallbacks[address] = success
	client.addressNotificationCallbacksLock.Unlock()
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var response *string
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				return errp.WithStack(err)
			}
			if response == nil {
				return success("")
			}
			return success(*response)
		},
		cleanup,
		"blockchain.address.subscribe",
		address)
}

func parseTX(rawTXHex string) (*wire.MsgTx, error) {
	rawTX, err := hex.DecodeString(rawTXHex)
	if err != nil {
		return nil, err
	}
	tx := &wire.MsgTx{}
	if err := tx.BtcDecode(bytes.NewReader(rawTX), 0, wire.WitnessEncoding); err != nil {
		return nil, err
	}
	return tx, nil
}

func (client *ElectrumClient) TransactionGet(
	txHash chainhash.Hash,
	success func(*wire.MsgTx) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var rawTXHex string
			if err := json.Unmarshal(responseBytes, &rawTXHex); err != nil {
				return errp.WithStack(err)
			}
			tx, err := parseTX(rawTXHex)
			if err != nil {
				return err
			}
			return success(tx)
		},
		cleanup,
		"blockchain.transaction.get",
		txHash.String())
}

func (client *ElectrumClient) handleError(err error) {
	log.Println(err)
}

type Header struct {
	BlockHeight int `json:"block_height"`
}

// HeadersSubscribe does the blockchain.headers.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchainheaderssubscribe
func (client *ElectrumClient) HeadersSubscribe() (*Header, error) {
	response := &Header{}
	err := client.rpc.MethodSync(
		response,
		"blockchain.headers.subscribe")
	return response, err
}

type TXHash chainhash.Hash

func (txHash *TXHash) Hash() chainhash.Hash {
	return chainhash.Hash(*txHash)
}

func (txHash *TXHash) UnmarshalJSON(jsonBytes []byte) error {
	var txHashStr string
	if err := json.Unmarshal(jsonBytes, &txHashStr); err != nil {
		return err
	}
	t, err := chainhash.NewHashFromStr(txHashStr)
	if err != nil {
		return err
	}
	*txHash = TXHash(*t)
	return nil
}

// UTXO is the data returned by the listunspent RPC call.
type UTXO struct {
	TXPos  int    `json:"tx_pos"`
	Value  int64  `json:"value"`
	TXHash string `json:"tx_hash"`
	Height int    `json:"height"`
}

// AddressListUnspent does the blockchain.address.listunspent() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchainaddresslistunspent
func (client *ElectrumClient) AddressListUnspent(address string) ([]*UTXO, error) {
	response := []*UTXO{}
	err := client.rpc.MethodSync(&response, "blockchain.address.listunspent", address)
	return response, err
}

// TransactionBroadcast does the blockchain.transaction.broadcast() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchaintransactionbroadcast
func (client *ElectrumClient) TransactionBroadcast(rawTX []byte) error {
	rawTXHex := hex.EncodeToString(rawTX)
	var response string
	if err := client.rpc.MethodSync(&response, "blockchain.transaction.broadcast", rawTXHex); err != nil {
		return err
	}
	if response != chainhash.DoubleHashH(rawTX).String() {
		return errp.New(response)
	}
	return nil
}

// RelayFee does the blockchain.relayfee() RPC call.
// https://github.com/kyuupichan/electrumx/blob/master/docs/PROTOCOL.rst#blockchainrelayfee
func (client *ElectrumClient) RelayFee() (btcutil.Amount, error) {
	var response float64
	if err := client.rpc.MethodSync(&response, "blockchain.relayfee"); err != nil {
		return 0, err
	}
	return btcutil.NewAmount(response)
}
