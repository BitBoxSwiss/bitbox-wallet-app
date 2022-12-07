// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package client implements an Electrum JSON RPC client.
// See ElectrumClient for more details.
package client

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonrpc"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/sirupsen/logrus"
)

// SoftwareVersion reports to an electrum protocol compatible server
// its name and a version so that server owners can identify what kind of
// clients are connected.
// It is set at the app startup in the backend and never changes during the runtime.
var SoftwareVersion = "BitBoxApp/uninitialized"

// supportedProtocolVersion reports to the servers the minimal supported electrum
// protocol version during the initial connection phase.
const supportedProtocolVersion = "1.4"

// ElectrumClient is a high level API access to an Electrum protocol compatible server.
// See https://electrumx-spesmilo.readthedocs.io/en/latest/protocol-methods.html
// selecting the supportedProtocolVersion currently in use.
type ElectrumClient struct {
	rpc *jsonrpc.RPCClient

	scriptHashNotificationCallbacks     map[string][]func(string)
	scriptHashNotificationCallbacksLock sync.RWMutex

	close bool
	log   *logrus.Entry
}

// NewElectrumClient creates a new Electrum client.
func NewElectrumClient(rpcClient *jsonrpc.RPCClient, log *logrus.Entry) *ElectrumClient {
	electrumClient := &ElectrumClient{
		rpc:                             rpcClient,
		scriptHashNotificationCallbacks: map[string][]func(string){},
		log:                             log.WithField("group", "client"),
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
				electrumClient.log.WithError(err).Error("Failed to unmarshal JSON response")
				return
			}
			if len(response) != 2 {
				electrumClient.log.WithField("response-length", len(response)).Error("Unexpected response (expected 2)")
				return
			}
			scriptHash := response[0]
			status := response[1]
			electrumClient.scriptHashNotificationCallbacksLock.RLock()
			callbacks := electrumClient.scriptHashNotificationCallbacks[scriptHash]
			electrumClient.scriptHashNotificationCallbacksLock.RUnlock()
			for _, callback := range callbacks {
				callback(status)
			}
		},
	)

	rpcClient.OnConnect(func() error {
		// Sends the version and must be the first message, to establish which methods the server
		// accepts.
		version, err := electrumClient.negotiateProtocol()
		if err != nil {
			return err
		}
		log.WithField("server-version", version).Debug("electrumx server version")
		return nil
	})
	rpcClient.RegisterHeartbeat("server.ping")

	return electrumClient
}

// ConnectionError returns the current connection status of the backend.
func (client *ElectrumClient) ConnectionError() error {
	return client.rpc.ConnectionError()
}

// RegisterOnConnectionErrorChangedEvent registers an event that forwards the connection status from
// the underlying client to the given callback.
func (client *ElectrumClient) RegisterOnConnectionErrorChangedEvent(f func(error)) {
	client.rpc.RegisterOnConnectionErrorChangedEvent(f)
}

// serverVersion is returned by serverVersion().
type serverVersion struct {
	software string
	protocol *semver.SemVer
}

func (v serverVersion) String() string {
	return fmt.Sprintf("%s;%s", v.software, v.protocol)
}

// negotiateProtocol performs client/server protocol negotiation using the
// server.version RPC call.
// ElectrumX will reply with a success only once. Subsequent calls return
// a "server.version already sent" error. Electrs doesn't enforce the "only once"
// condition.
func (client *ElectrumClient) negotiateProtocol() (serverVersion, error) {
	var resp [2]string // [software version, protocol version]
	err := client.rpc.MethodSync(&resp, "server.version", SoftwareVersion, supportedProtocolVersion)
	if err != nil {
		return serverVersion{}, err
	}
	semv, err := semver.NewSemVerFromString(resp[1])
	if err != nil {
		semv, err = semver.NewSemVerFromString(resp[1] + ".0")
	}
	if err != nil {
		semv = &semver.SemVer{} // don't really care; nice to have
	}
	return serverVersion{software: resp[0], protocol: semv}, nil
}

// CheckConnection reports whether the server returns a succesfull response
// to a server.ping RPC method.
// It is different when compared to a raw socket connection check.
// A client seemingly connected at a transport level is not indicative of
// a functioning application layer connection. This reports the latter.
func (client *ElectrumClient) CheckConnection() error {
	var empty struct{}
	return client.rpc.MethodSync(&empty, "server.ping")
}

// ScriptHashGetHistory does the blockchain.scripthash.get_history RPC call.
func (client *ElectrumClient) ScriptHashGetHistory(scriptHashHex blockchain.ScriptHashHex) (
	blockchain.TxHistory, error) {
	txs := blockchain.TxHistory{}
	err := client.rpc.MethodSync(&txs, "blockchain.scripthash.get_history", string(scriptHashHex))
	if err != nil {
		return nil, err
	}
	return txs, nil
}

// ScriptHashSubscribe does the blockchain.scripthash.subscribe RPC call.
func (client *ElectrumClient) ScriptHashSubscribe(
	setupAndTeardown func() func(error),
	scriptHashHex blockchain.ScriptHashHex,
	success func(string),
) {
	client.scriptHashNotificationCallbacksLock.Lock()
	if _, ok := client.scriptHashNotificationCallbacks[string(scriptHashHex)]; !ok {
		client.scriptHashNotificationCallbacks[string(scriptHashHex)] = []func(string){}
	}
	client.scriptHashNotificationCallbacks[string(scriptHashHex)] = append(
		client.scriptHashNotificationCallbacks[string(scriptHashHex)],
		success,
	)
	client.scriptHashNotificationCallbacksLock.Unlock()
	client.rpc.Method(
		func(responseBytes []byte) error {
			var response *string
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				client.log.WithError(err).Error("Failed to unmarshal JSON response")
				return errp.WithStack(err)
			}
			if response == nil {
				success("")
			} else {
				success(*response)
			}
			return nil
		},
		setupAndTeardown,
		"blockchain.scripthash.subscribe",
		string(scriptHashHex))
}

func parseTX(rawTXHex string) (*wire.MsgTx, error) {
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

// TransactionGet downloads a transaction using the blockchain.transaction.get RPC method.
func (client *ElectrumClient) TransactionGet(txHash chainhash.Hash) (*wire.MsgTx, error) {
	var rawTxHex string
	err := client.rpc.MethodSync(&rawTxHex, "blockchain.transaction.get", txHash.String())
	if err != nil {
		return nil, err
	}
	return parseTX(rawTxHex)
}

// HeadersSubscribe does the blockchain.headers.subscribe RPC call.
func (client *ElectrumClient) HeadersSubscribe(
	setupAndTeardown func() func(error),
	success func(*blockchain.Header),
) {
	type header struct {
		Height int
	}
	client.rpc.SubscribeNotifications("blockchain.headers.subscribe", func(responseBytes []byte) {
		response := []json.RawMessage{}
		if err := json.Unmarshal(responseBytes, &response); err != nil {
			client.log.WithError(err).Error("could not handle header notification")
			return
		}
		if len(response) != 1 {
			client.log.Error("could not handle header notification")
			return
		}
		var h header
		if err := json.Unmarshal(response[0], &h); err != nil {
			client.log.WithError(err).Error("could not handle header notification")
			return
		}
		success(&blockchain.Header{BlockHeight: h.Height})
	})
	client.rpc.Method(
		func(responseBytes []byte) error {
			var h header
			if err := json.Unmarshal(responseBytes, &h); err != nil {
				return errp.WithStack(err)
			}
			success(&blockchain.Header{BlockHeight: h.Height})
			return nil
		},
		setupAndTeardown,
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

// ScriptHashListUnspent does the blockchain.address.listunspent RPC call.
func (client *ElectrumClient) ScriptHashListUnspent(scriptHashHex string) ([]*UTXO, error) {
	response := []*UTXO{}
	if err := client.rpc.MethodSync(&response, "blockchain.scripthash.listunspent", scriptHashHex); err != nil {
		return nil, errp.WithStack(err)
	}
	return response, nil
}

// TransactionBroadcast does the blockchain.transaction.broadcast RPC call.
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

// RelayFee does the blockchain.relayfee RPC call.
func (client *ElectrumClient) RelayFee() (btcutil.Amount, error) {
	var fee float64
	if err := client.rpc.MethodSync(&fee, "blockchain.relayfee"); err != nil {
		return 0, err
	}
	return btcutil.NewAmount(fee)
}

// EstimateFee estimates the fee rate (unit/kB) needed to be confirmed within the given number of
// blocks using the blockchain.estimatefee RPC method.
// If the fee rate could not be estimated by the blockchain node, an error is returned.
func (client *ElectrumClient) EstimateFee(number int) (btcutil.Amount, error) {
	var fee float64
	if err := client.rpc.MethodSync(&fee, "blockchain.estimatefee", number); err != nil {
		return 0, err
	}
	if fee == -1 {
		return 0, errp.Newf("node could not estimate fee for target %d", number)
	}
	return btcutil.NewAmount(fee)
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

// Headers does the blockchain.block.headers RPC call.
func (client *ElectrumClient) Headers(startHeight int, count int) ([]*wire.BlockHeader, int, error) {
	var response struct {
		Hex   string `json:"hex"`
		Count int    `json:"count"`
		Max   int    `json:"max"`
	}

	err := client.rpc.MethodSync(&response, "blockchain.block.headers", startHeight, count)
	if err != nil {
		return nil, 0, err
	}
	headers, err := parseHeaders(hex.NewDecoder(strings.NewReader(response.Hex)))
	if err != nil {
		return nil, 0, err
	}
	if len(headers) != response.Count {
		return nil, 0, errp.Newf(
			"unexpected electrumx reply: should have gotten %d headers, but got %d",
			response.Count,
			len(headers))
	}
	return headers, response.Max, nil
}

// GetMerkle does the blockchain.transaction.get_merkle RPC call.
func (client *ElectrumClient) GetMerkle(txHash chainhash.Hash, height int) ([]blockchain.TXHash, int, error) {
	var response struct {
		Merkle      []blockchain.TXHash `json:"merkle"`
		Pos         int                 `json:"pos"`
		BlockHeight int                 `json:"block_height"`
	}

	err := client.rpc.MethodSync(
		&response,
		"blockchain.transaction.get_merkle",
		txHash.String(), height)
	if err != nil {
		return nil, 0, err
	}
	if response.BlockHeight != height {
		return nil, 0, errp.Newf("height should be %d, but got %d", height, response.BlockHeight)
	}
	return response.Merkle, response.Pos, nil
}

// Close closes the connection.
func (client *ElectrumClient) Close() {
	client.close = true
	client.rpc.Close()
}
