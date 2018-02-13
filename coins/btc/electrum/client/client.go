// Package client implements an Electrum JSON RPC client.
// See https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst
package client

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
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
	Close()
}

// ElectrumClient is a high level API access to an ElectrumX server.
// See https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst.
type ElectrumClient struct {
	rpc RPCClient

	scriptHashNotificationCallbacks     map[string]func(string) error
	scriptHashNotificationCallbacksLock sync.RWMutex

	close bool
}

// NewElectrumClient creates a new Electrum client.
func NewElectrumClient(rpcClient RPCClient) (*ElectrumClient, error) {
	electrumClient := &ElectrumClient{
		rpc: rpcClient,
		scriptHashNotificationCallbacks: map[string]func(string) error{},
	}
	// Install a callback for the scripthash notifications, which directs the response to callbacks
	// installed by ScriptHashSubscribe().
	if err := rpcClient.SubscribeNotifications(
		"blockchain.scripthash.subscribe",
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
			scriptHash := response[0]
			status := response[1]
			electrumClient.scriptHashNotificationCallbacksLock.RLock()
			callback, ok := electrumClient.scriptHashNotificationCallbacks[scriptHash]
			electrumClient.scriptHashNotificationCallbacksLock.RUnlock()
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
	for !client.close {
		log.Println("pinging the electrum server")
		_, err := client.ServerVersion()
		if err != nil {
			// TODO
			panic(err)
		}
		time.Sleep(time.Minute)
	}
}

// ServerVersion is returned by ServerVersion().
type ServerVersion struct {
	Version         string
	ProtocolVersion string
}

// UnmarshalJSON implements the json.Unmarshaler interface.
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

// ServerFeatures is returned by ServerFeatures().
type ServerFeatures struct {
	GenesisHash string `json:"genesis_hash"`
}

// ServerFeatures does the server.features() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#serverfeatures
func (client *ElectrumClient) ServerFeatures() (*ServerFeatures, error) {
	response := &ServerFeatures{}
	err := client.rpc.MethodSync(response, "server.features")
	return response, err
}

// Balance is returned by ScriptHashGetBalance().
type Balance struct {
	Confirmed   int64 `json:"confirmed"`
	Unconfirmed int64 `json:"unconfirmed"`
}

// ScriptHashGetBalance does the blockchain.scripthash.get_balance() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashget_balance
func (client *ElectrumClient) ScriptHashGetBalance(
	scriptHashHex string,
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
		"blockchain.scripthash.get_balance",
		scriptHashHex)
}

// TxInfo is returned by ScriptHashGetHistory.
type TxInfo struct {
	Height int    `json:"height"`
	TXHash TXHash `json:"tx_hash"`
	Fee    *int64 `json:"fee"`
}

// TxHistory is returned by ScriptHashGetHistory.
type TxHistory []*TxInfo

// Status encodes the status of the address history as a hash, according to the Electrum
// specification.
// https://github.com/kyuupichan/electrumx/blob/b01139bb93a7b0cfbd45b64e170223f4871a4a87/docs/PROTOCOL.rst#blockchainaddresssubscribe
func (history TxHistory) Status() string {
	if len(history) == 0 {
		return ""
	}
	status := bytes.Buffer{}
	for _, tx := range history {
		status.WriteString(fmt.Sprintf("%s:%d:", tx.TXHash.Hash().String(), tx.Height))
	}
	return hex.EncodeToString(chainhash.HashB(status.Bytes()))
}

// ScriptHashGetHistory does the blockchain.scripthash.get_history() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashget_history
func (client *ElectrumClient) ScriptHashGetHistory(
	scriptHashHex string,
	success func(TxHistory) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			txs := TxHistory{}
			if err := json.Unmarshal(responseBytes, &txs); err != nil {
				return errp.WithStack(err)
			}
			return success(txs)
		},
		cleanup,
		"blockchain.scripthash.get_history",
		scriptHashHex)
}

// ScriptHashSubscribe does the blockchain.scripthash.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashsubscribe
func (client *ElectrumClient) ScriptHashSubscribe(
	scriptHashHex string,
	success func(string) error,
	cleanup func(error),
) error {
	client.scriptHashNotificationCallbacksLock.Lock()
	client.scriptHashNotificationCallbacks[scriptHashHex] = success
	client.scriptHashNotificationCallbacksLock.Unlock()
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
		"blockchain.scripthash.subscribe",
		scriptHashHex)
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

// TransactionGet downloads a transaction.
// See https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchaintransactionget
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

// Header is returned by HeadersSubscribe().
type Header struct {
	BlockHeight int `json:"block_height"`
}

// HeadersSubscribe does the blockchain.headers.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainheaderssubscribe
func (client *ElectrumClient) HeadersSubscribe() (*Header, error) {
	response := &Header{}
	err := client.rpc.MethodSync(
		response,
		"blockchain.headers.subscribe")
	return response, err
}

// TXHash wraps chainhash.Hash for json deserialization.
type TXHash chainhash.Hash

// Hash returns the wrapped hash.
func (txHash *TXHash) Hash() chainhash.Hash {
	return chainhash.Hash(*txHash)
}

// UnmarshalJSON implements the json.Unmarshaler interface.
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

// ScriptHashListUnspent does the blockchain.address.listunspent() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashlistunspent
func (client *ElectrumClient) ScriptHashListUnspent(scriptHashHex string) ([]*UTXO, error) {
	response := []*UTXO{}
	err := client.rpc.MethodSync(&response, "blockchain.scripthash.listunspent", scriptHashHex)
	return response, err
}

// TransactionBroadcast does the blockchain.transaction.broadcast() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchaintransactionbroadcast
func (client *ElectrumClient) TransactionBroadcast(transaction *wire.MsgTx) error {
	rawTx := &bytes.Buffer{}
	_ = transaction.Serialize(rawTx)
	rawTxHex := hex.EncodeToString(rawTx.Bytes())
	var response string
	if err := client.rpc.MethodSync(&response, "blockchain.transaction.broadcast", rawTxHex); err != nil {
		return err
	}
	// TxHash() deviates from the hash of rawTxHex in case of a segwit tx. The stripped transaction
	// ID is used.
	if response != transaction.TxHash().String() {
		return errp.New(response)
	}
	return nil
}

// RelayFee does the blockchain.relayfee() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainrelayfee
func (client *ElectrumClient) RelayFee() (btcutil.Amount, error) {
	var response float64
	if err := client.rpc.MethodSync(&response, "blockchain.relayfee"); err != nil {
		return 0, err
	}
	return btcutil.NewAmount(response)
}

// EstimateFee estimates the fee rate (unit/kB) needed to be confirmed within the given number of
// blocks.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainestimatefee
func (client *ElectrumClient) EstimateFee(
	number int,
	success func(btcutil.Amount) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var fee float64
			if err := json.Unmarshal(responseBytes, &fee); err != nil {
				return errp.WithStack(err)
			}
			if fee == -1 {
				return errp.New("fee could not be estimated")
			}
			amount, err := btcutil.NewAmount(fee)
			if err != nil {
				return err
			}
			return success(amount)
		},
		cleanup,
		"blockchain.estimatefee",
		number)
}

// Close closes the connection.
func (client *ElectrumClient) Close() {
	client.close = true
	client.rpc.Close()
}
