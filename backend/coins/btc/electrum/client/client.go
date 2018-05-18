// Package client implements an Electrum JSON RPC client.
// See https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst
package client

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

const (
	clientVersion         = "0.0.1"
	clientProtocolVersion = "1.2"
)

// RPCClient describes the methods needed to communicate with an RPC server.
type RPCClient interface {
	Method(func([]byte) error, func(error), string, ...interface{}) error
	MethodSync(interface{}, string, ...interface{}) error
	SubscribeNotifications(string, func([]byte))
	Close()
}

// ElectrumClient is a high level API access to an ElectrumX server.
// See https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst.
type ElectrumClient struct {
	rpc RPCClient

	scriptHashNotificationCallbacks     map[string]func(string) error
	scriptHashNotificationCallbacksLock sync.RWMutex

	close bool
	log   *logrus.Entry
}

// NewElectrumClient creates a new Electrum client.
func NewElectrumClient(rpcClient RPCClient, log *logrus.Entry) (*ElectrumClient, error) {
	electrumClient := &ElectrumClient{
		rpc: rpcClient,
		scriptHashNotificationCallbacks: map[string]func(string) error{},
		log: log.WithField("group", "client"),
	}
	// Install a callback for the scripthash notifications, which directs the response to callbacks
	// installed by ScriptHashSubscribe().
	rpcClient.SubscribeNotifications(
		"blockchain.scripthash.subscribe",
		func(responseBytes []byte) {
			// TODO example responsebytes, use for unit testing:
			// "[\"mn31QqyuBum6PFS7VFyo8oUL8Yc8G8MHZA\", \"3b98a4b9bed1312f4f53a1c6c9276b0ad8be68c57a5bcbe651688e4f4191b521\"]"
			response := []string{}
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				electrumClient.log.WithField("error", err).Error("Failed to unmarshal JSON response")
				return
			}
			if len(response) != 2 {
				electrumClient.log.WithField("response-length", len(response)).Error("Unexpected response (expected 2)")
				return
			}
			scriptHash := response[0]
			status := response[1]
			electrumClient.scriptHashNotificationCallbacksLock.RLock()
			callback, ok := electrumClient.scriptHashNotificationCallbacks[scriptHash]
			electrumClient.scriptHashNotificationCallbacksLock.RUnlock()
			if ok {
				if err := callback(status); err != nil {
					electrumClient.log.WithField("error", err).Error("Failed to execute callback")
					return
				}
			}
		},
	)
	// Ping sends the version and must be the first message, to establish which methods the server
	// accepts.
	version, err := electrumClient.ServerVersion()
	if err != nil {
		return nil, err
	}
	log.WithField("server-version", version).Debug("electrumx server version")

	go electrumClient.ping()

	return electrumClient, nil
}

// ping periodically pings the server to keep the connection alive.
func (client *ElectrumClient) ping() {
	defer func() {
		if r := recover(); r != nil {
			client.log.WithField("error", r.(error)).Debug("Closing client after error in ping.")
			client.Close()
		}
	}()
	for !client.close {
		time.Sleep(time.Minute)
		if client.close {
			panic(errp.New("Connection closed"))
		}
		client.log.Debug("Pinging the electrum server")
		_, err := client.ServerVersion()
		if err != nil {
			client.log.WithField("error", err).Error("Error while pinging the server")
			// TODO
			panic(err)
		}
	}
}

// ServerVersion is returned by ServerVersion().
type ServerVersion struct {
	Version         string
	ProtocolVersion string
}

func (version *ServerVersion) String() string {
	return fmt.Sprintf("%s;%s", version.Version, version.ProtocolVersion)
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (version *ServerVersion) UnmarshalJSON(b []byte) error {
	slice := []string{}
	if err := json.Unmarshal(b, &slice); err != nil {
		return errp.WithContext(errp.Wrap(err, "Failed to unmarshal JSON"), errp.Context{"raw": string(b)})
	}
	if len(slice) != 2 {
		return errp.WithContext(errp.New("Unexpected reply"), errp.Context{"raw": string(b)})
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
				client.log.WithField("error", err).Error("Failed to unmarshal JSON response")
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

// ScriptHashHex is the hash of a pkScript in reverse hex format.
type ScriptHashHex string

// ScriptHashGetHistory does the blockchain.scripthash.get_history() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashget_history
func (client *ElectrumClient) ScriptHashGetHistory(
	scriptHashHex ScriptHashHex,
	success func(TxHistory) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			txs := TxHistory{}
			if err := json.Unmarshal(responseBytes, &txs); err != nil {
				client.log.WithField("error", err).Error("Failed to unmarshal JSON response")
				return errp.WithStack(err)
			}
			return success(txs)
		},
		cleanup,
		"blockchain.scripthash.get_history",
		string(scriptHashHex))
}

// ScriptHashSubscribe does the blockchain.scripthash.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainscripthashsubscribe
func (client *ElectrumClient) ScriptHashSubscribe(
	scriptHashHex ScriptHashHex,
	success func(string) error,
	cleanup func(error),
) error {
	client.scriptHashNotificationCallbacksLock.Lock()
	client.scriptHashNotificationCallbacks[string(scriptHashHex)] = success
	client.scriptHashNotificationCallbacksLock.Unlock()
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var response *string
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				client.log.WithField("error", err).Error("Failed to unmarshal JSON response")
				return errp.WithStack(err)
			}
			if response == nil {
				return success("")
			}
			return success(*response)
		},
		cleanup,
		"blockchain.scripthash.subscribe",
		string(scriptHashHex))
}

func parseTX(rawTXHex string, log *logrus.Entry) (*wire.MsgTx, error) {
	rawTX, err := hex.DecodeString(rawTXHex)
	if err != nil {
		return nil, errp.Wrap(err, "Failed to decode transaction hex")
	}
	tx := &wire.MsgTx{}
	if err := tx.BtcDecode(bytes.NewReader(rawTX), 0, wire.WitnessEncoding); err != nil {
		return nil, errp.Wrap(err, "Failed to decode BTC transaction")
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
			tx, err := parseTX(rawTXHex, client.log)
			if err != nil {
				return err
			}
			return success(tx)
		},
		cleanup,
		"blockchain.transaction.get",
		txHash.String())
}

// Header is returned by HeadersSubscribe().
type Header struct {
	BlockHeight int `json:"block_height"`
}

// HeadersSubscribe does the blockchain.headers.subscribe() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainheaderssubscribe
func (client *ElectrumClient) HeadersSubscribe(
	success func(*Header) error,
	cleanup func(error),
) error {
	client.rpc.SubscribeNotifications("blockchain.headers.subscribe", func(responseBytes []byte) {
		response := []*Header{}
		if err := json.Unmarshal(responseBytes, &response); err != nil {
			client.log.WithField("error", err).Error("could not handle header notification")
			return
		}
		if len(response) != 1 {
			client.log.Error("could not handle header notification")
			return
		}
		if err := success(response[0]); err != nil {
			client.log.WithField("error", err).Error("could not handle header notification")
			return
		}
	})
	return client.rpc.Method(
		func(responseBytes []byte) error {
			response := &Header{}
			if err := json.Unmarshal(responseBytes, response); err != nil {
				return errp.WithStack(err)
			}
			return success(response)
		},
		cleanup,
		"blockchain.headers.subscribe")
}

// TXHash wraps chainhash.Hash for json deserialization.
type TXHash chainhash.Hash

// Hash returns the wrapped hash.
func (txHash *TXHash) Hash() chainhash.Hash {
	return chainhash.Hash(*txHash)
}

// MarshalJSON implements the json.Marshaler interface.
func (txHash *TXHash) MarshalJSON() ([]byte, error) {
	return json.Marshal(txHash.Hash().String())
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (txHash *TXHash) UnmarshalJSON(jsonBytes []byte) error {
	var txHashStr string
	if err := json.Unmarshal(jsonBytes, &txHashStr); err != nil {
		return errp.WithStack(err)
	}
	t, err := chainhash.NewHashFromStr(txHashStr)
	if err != nil {
		return errp.WithStack(err)
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
	if err := client.rpc.MethodSync(&response, "blockchain.scripthash.listunspent", scriptHashHex); err != nil {
		return nil, errp.WithStack(err)
	}
	return response, nil
}

// TransactionBroadcast does the blockchain.transaction.broadcast() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchaintransactionbroadcast
func (client *ElectrumClient) TransactionBroadcast(transaction *wire.MsgTx) error {
	rawTx := &bytes.Buffer{}
	_ = transaction.BtcEncode(rawTx, 0, wire.WitnessEncoding)
	rawTxHex := hex.EncodeToString(rawTx.Bytes())
	var response string
	if err := client.rpc.MethodSync(&response, "blockchain.transaction.broadcast", rawTxHex); err != nil {
		return errp.Wrap(err, "Failed to broadcast transaction")
	}
	// TxHash() deviates from the hash of rawTxHex in case of a segwit tx. The stripped transaction
	// ID is used.
	if response != transaction.TxHash().String() {
		return errp.WithContext(errp.New("Response is unexpected (expected TX hash)"),
			errp.Context{"response": response})
	}
	return nil
}

// RelayFee does the blockchain.relayfee() RPC call.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainrelayfee
func (client *ElectrumClient) RelayFee(
	success func(btcutil.Amount) error,
	cleanup func(error),
) error {
	return client.rpc.Method(func(responseBytes []byte) error {
		var fee float64
		if err := json.Unmarshal(responseBytes, &fee); err != nil {
			return errp.Wrap(err, "Failed to unmarshal JSON")
		}
		amount, err := btcutil.NewAmount(fee)
		if err != nil {
			return errp.Wrap(err, "Failed to construct BTC amount")
		}
		return success(amount)
	}, cleanup, "blockchain.relayfee")
}

// EstimateFee estimates the fee rate (unit/kB) needed to be confirmed within the given number of
// blocks. If the fee rate could not be estimated by the blockchain node, `nil` is passed to the
// success callback.
// https://github.com/kyuupichan/electrumx/blob/159db3f8e70b2b2cbb8e8cd01d1e9df3fe83828f/docs/PROTOCOL.rst#blockchainestimatefee
func (client *ElectrumClient) EstimateFee(
	number int,
	success func(*btcutil.Amount) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var fee float64
			if err := json.Unmarshal(responseBytes, &fee); err != nil {
				return errp.Wrap(err, "Failed to unmarshal JSON")
			}
			if fee == -1 {
				return success(nil)
			}
			amount, err := btcutil.NewAmount(fee)
			if err != nil {
				return errp.Wrap(err, "Failed to construct BTC amount")
			}
			return success(&amount)
		},
		cleanup,
		"blockchain.estimatefee",
		number)
}

func parseHeaders(reader io.Reader) ([]*wire.BlockHeader, error) {
	headers := []*wire.BlockHeader{}
	for {
		header := &wire.BlockHeader{}
		err := header.BtcDecode(reader, 0, wire.WitnessEncoding)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		headers = append(headers, header)
	}
	return headers, nil
}

// Headers does the blockchain.block.headers() RPC call. See
// https://github.com/kyuupichan/electrumx/blob/1.3/docs/protocol-methods.rst#blockchainblockheaders
func (client *ElectrumClient) Headers(
	startHeight int, count int,
	success func(headers []*wire.BlockHeader, max int) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var response struct {
				Hex   string `json:"hex"`
				Count int    `json:"count"`
				Max   int    `json:"max"`
			}
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				return errp.WithStack(err)
			}
			headers, err := parseHeaders(hex.NewDecoder(strings.NewReader(response.Hex)))
			if err != nil {
				return err
			}
			if len(headers) != response.Count {
				return errp.Newf(
					"unexpected electrumx reply: should have gotten %d headers, but got %d",
					response.Count,
					len(headers))
			}
			return success(headers, response.Max)
		},
		cleanup,
		"blockchain.block.headers",
		startHeight, count)
}

// GetMerkle does the blockchain.transaction.get_merkle() RPC call. See
// https://github.com/kyuupichan/electrumx/blob/1.3/docs/protocol-methods.rst#blockchaintransactionget_merkle
func (client *ElectrumClient) GetMerkle(
	txHash chainhash.Hash, height int,
	success func(merkle []TXHash, pos int) error,
	cleanup func(error),
) error {
	return client.rpc.Method(
		func(responseBytes []byte) error {
			var response struct {
				Merkle      []TXHash `json:"merkle"`
				Pos         int      `json:"pos"`
				BlockHeight int      `json:"block_height"`
			}
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				return errp.WithStack(err)
			}
			if response.BlockHeight != height {
				return errp.Newf("height should be %d, but got %d", height, response.BlockHeight)
			}
			return success(response.Merkle, response.Pos)
		},
		cleanup,
		"blockchain.transaction.get_merkle",
		txHash.String(), height)
}

// Close closes the connection.
func (client *ElectrumClient) Close() {
	client.close = true
	client.rpc.Close()
}
