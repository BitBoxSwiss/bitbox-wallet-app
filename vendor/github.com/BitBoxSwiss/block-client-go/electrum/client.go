// Copyright 2022 Shift Crypto AG
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

package electrum

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/BitBoxSwiss/block-client-go/jsonrpc"
)

// supportedProtocolVersion reports to the servers the minimal supported electrum
// protocol version during the initial connection phase.
const supportedProtocolVersion = "1.4"

const defaultPingInterval = time.Minute

// ServerVersion is returned by the `server.version` RPC call.
type ServerVersion struct {
	software string
	protocol string
}

func (v ServerVersion) String() string {
	return fmt.Sprintf("%s;%s", v.software, v.protocol)
}

// Options to initialize the Electrum client.
type Options struct {
	// SoftwareVersion reports to an electrum protocol compatible server
	// its name and a version so that server owners can identify what kind of
	// clients are connected.
	SoftwareVersion string
	// MethodTimeout is the duration after method calls time out. If 0, no timeout is applied.
	MethodTimeout time.Duration
	// PingInterval is the time between periodic ping requests to the Electrum server. 1m is the
	// default if not specified. If negative, pinging is disabled. This should be longer than
	// `MethodTimeout`.
	PingInterval time.Duration
	// Dial connects to the server and returns a connection object.
	Dial func() (net.Conn, error)
}

// Client is a high level API access to an Electrum protocol compatible server.  See
// https://electrumx-spesmilo.readthedocs.io/en/latest/protocol-methods.html selecting the
// `supportedProtocolVersion` currently in use.
type Client struct {
	opts            *Options
	rpc             *jsonrpc.Client
	serverVersion   ServerVersion
	subscriptions   map[string][]func(params json.RawMessage)
	subscriptionsMu sync.RWMutex

	scriptHashNotificationCallbacks   map[string][]func(string, error)
	scriptHashNotificationCallbacksMu sync.RWMutex

	onError   func(error)
	onErrorMu sync.RWMutex

	quitCh chan struct{}
}

// ServerVersion returns the version as reported by the server.
func (c *Client) ServerVersion() ServerVersion {
	return c.serverVersion
}

// Connect connets to an Electrum server and negotiates the protocol in a blocking fashion
// immediately. If the connection could not be established or the server didn't respond with a valid
// server version response, an error is returned.
func Connect(opts *Options) (*Client, error) {
	rpc, err := jsonrpc.Connect(&jsonrpc.Options{
		Dial: opts.Dial,
	})
	if err != nil {
		return nil, err
	}
	c := &Client{
		opts:                            opts,
		rpc:                             rpc,
		subscriptions:                   map[string][]func(params json.RawMessage){},
		scriptHashNotificationCallbacks: map[string][]func(string, error){},
		quitCh:                          make(chan struct{}),
	}

	serverVersion, err := c.negotiateProtocol()
	if err != nil {
		return nil, err
	}
	c.serverVersion = serverVersion
	rpc.OnNotification(c.onNotification)

	c.registerNotification("blockchain.scripthash.subscribe", func(params json.RawMessage) {
		do := func() error {
			response := []string{}
			if err := json.Unmarshal(params, &response); err != nil {
				return err
			}
			if len(response) != 2 {
				return errors.New("unexpected response (expected 2")
			}
			scriptHash := response[0]
			status := response[1]
			c.scriptHashNotificationCallbacksMu.RLock()
			callbacks := c.scriptHashNotificationCallbacks[scriptHash]
			c.scriptHashNotificationCallbacksMu.RUnlock()
			for _, callback := range callbacks {
				go callback(status, nil)
			}
			return nil
		}
		if err := do(); err != nil {
			c.fireOnError(err)
		}
	})

	go c.pingLoop()

	return c, nil
}

func (c *Client) pingLoop() {
	pingInterval := defaultPingInterval
	if c.opts.PingInterval != 0 {
		pingInterval = c.opts.PingInterval
	}
	if pingInterval < 0 {
		return
	}
	for {
		select {
		case <-c.quitCh:
			return
		case <-time.After(pingInterval):
			go func() {
				if err := c.ping(); err != nil {
					c.fireOnError(err)
				}
			}()
		}
	}
}

func (c *Client) fireOnError(err error) {
	c.onErrorMu.RLock()
	onError := c.onError
	defer c.onErrorMu.RUnlock()
	if onError != nil {
		go onError(err)
	}
}

// SetOnError defines a callback that is called when there is a JSON RPC error. See
// `jsonrpc.SetOnError`.
func (c *Client) SetOnError(f func(error)) {
	c.onErrorMu.Lock()
	defer c.onErrorMu.Unlock()
	c.onError = f
	c.rpc.SetOnError(f)
}

func (c *Client) onNotification(method string, params json.RawMessage) {
	c.subscriptionsMu.RLock()
	defer c.subscriptionsMu.RUnlock()
	for _, cb := range c.subscriptions[method] {
		go cb(params)
	}
}

func (c *Client) registerNotification(method string, callback func(params json.RawMessage)) {
	c.subscriptionsMu.Lock()
	c.subscriptions[method] = append(c.subscriptions[method], callback)
	c.subscriptionsMu.Unlock()
}

func (c *Client) timeoutCtx(ctx context.Context) (context.Context, context.CancelFunc) {
	timeout := c.opts.MethodTimeout
	if timeout == 0 {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(ctx, timeout)
}

// negotiateProtocol performs client/server protocol negotiation using the server.version RPC call.
// ElectrumX will reply with a success only once. Subsequent calls return a "server.version already
// sent" error. Electrs doesn't enforce the "only once" condition.
func (c *Client) negotiateProtocol() (ServerVersion, error) {
	var resp [2]string // [software version, protocol version]
	if c.opts.SoftwareVersion == "" {
		return ServerVersion{}, errors.New("SoftwareVersion not specified")
	}
	ctx, cancel := c.timeoutCtx(context.Background())
	defer cancel()
	err := c.rpc.MethodBlocking(
		ctx,
		&resp,
		"server.version", c.opts.SoftwareVersion, supportedProtocolVersion)
	if err != nil {
		return ServerVersion{}, err
	}
	return ServerVersion{software: resp[0], protocol: resp[1]}, nil
}

// ScriptHashGetHistory does the blockchain.scripthash.get_history RPC call.
func (c *Client) ScriptHashGetHistory(ctx context.Context, scriptHashHex string) (types.TxHistory, error) {
	txs := types.TxHistory{}
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &txs, "blockchain.scripthash.get_history", scriptHashHex)
	if err != nil {
		return nil, err
	}
	return txs, nil
}

// TransactionGet downloads a transaction using the blockchain.transaction.get RPC method.
// The response is the raw transaction.
func (c *Client) TransactionGet(ctx context.Context, txHash string) ([]byte, error) {
	var rawTxHex string
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &rawTxHex, "blockchain.transaction.get", txHash)
	if err != nil {
		return nil, err
	}
	rawTx, err := hex.DecodeString(rawTxHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode transaction hex: %w", err)
	}
	return rawTx, nil
}

func (c *Client) ping() error {
	var response interface{}
	ctx, cancel := c.timeoutCtx(context.Background())
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &response, "server.ping")
	if err != nil {
		return err
	}
	if response != nil {
		return errors.New("unexpected response")
	}
	return nil
}

func (c *Client) ScriptHashSubscribe(
	ctx context.Context,
	scriptHashHex string,
	result func(status string, err error)) {
	c.scriptHashNotificationCallbacksMu.Lock()
	c.scriptHashNotificationCallbacks[scriptHashHex] = append(c.scriptHashNotificationCallbacks[scriptHashHex], result)
	c.scriptHashNotificationCallbacksMu.Unlock()
	ctx, cancel := c.timeoutCtx(ctx)
	err := c.rpc.Method(
		ctx,
		func(responseBytes []byte, err error) {
			defer cancel()
			if err != nil {
				result("", err)
				return
			}
			var response *string
			if err := json.Unmarshal(responseBytes, &response); err != nil {
				result("", err)
				return
			}
			if response == nil {
				result("", nil)
			} else {
				result(*response, nil)
			}
		},
		"blockchain.scripthash.subscribe", scriptHashHex)
	if err != nil {
		result("", err)
	}
}

// HeadersSubscribe does the blockchain.headers.subscribe RPC call. The callback is called once with
// the latest header and subsequently on each new header.
//
// This function is non-blocking, the result is delivered asynchronously to the callback.
// The callback is called with an error if:
// - writing to the socket fails
// - there was a timeout in invoking the RPC call
// - the server responds with invalid data to the RPC call
// - the server sends invalid data in the `blockchain.headers.subscribe` notification.
func (c *Client) HeadersSubscribe(ctx context.Context, result func(header *types.Header, err error)) {
	c.registerNotification("blockchain.headers.subscribe", func(params json.RawMessage) {
		var h [1]types.Header
		if err := json.Unmarshal(params, &h); err != nil {
			result(nil, err)
			return
		}
		result(&h[0], nil)
	})
	ctx, cancel := c.timeoutCtx(ctx)
	err := c.rpc.Method(
		ctx,
		func(responseBytes []byte, err error) {
			defer cancel()
			if err != nil {
				result(nil, err)
				return
			}
			var h types.Header
			if err := json.Unmarshal(responseBytes, &h); err != nil {
				result(nil, err)
				return
			}
			result(&h, nil)
		},
		"blockchain.headers.subscribe")
	if err != nil {
		result(nil, err)
	}
}

// EstimateFee estimates the fee rate needed to be confirmed within the given number of
// blocks using the blockchain.estimatefee RPC method.
// The value returned is the fee rate in BTC/kB.
// If the fee rate could not be estimated, an error is returned.
func (c *Client) EstimateFee(ctx context.Context, number int) (float64, error) {
	var fee float64
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &fee, "blockchain.estimatefee", number)
	if err != nil {
		return 0, err
	}
	if fee == -1 {
		return 0, fmt.Errorf("node could not estimate fee for target %d", number)
	}
	return fee, nil
}

// RelayFee does the blockchain.relayfee RPC call.
// The value returned is the fee rate in BTC/kB.
func (c *Client) RelayFee(ctx context.Context) (float64, error) {
	var fee float64
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &fee, "blockchain.relayfee")
	if err != nil {
		return 0, err
	}
	return fee, nil
}

// TransactionBroadcast does the blockchain.transaction.broadcast RPC call.
func (c *Client) TransactionBroadcast(ctx context.Context, rawTxHex string) (string, error) {
	var txID string
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &txID, "blockchain.transaction.broadcast", rawTxHex)
	if err != nil {
		return "", err
	}
	return txID, nil
}

// HeadersResult is returned by `Headers()`.
type HeadersResult struct {
	// Headers is a slice of 80-byte headers.
	Headers [][]byte
	// Max is the maximum number of headers the server will return in a single request.
	Max int
}

// Headers does the blockchain.block.headers RPC call. It returns a slice of 80-byte headers, and
// the maximum number of headers the server will return in a single request.
func (c *Client) Headers(ctx context.Context, startHeight int, count int) (*HeadersResult, error) {
	var response struct {
		Hex   string `json:"hex"`
		Count int    `json:"count"`
		Max   int    `json:"max"`
	}
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &response, "blockchain.block.headers", startHeight, count)
	if err != nil {
		return nil, err
	}
	headers := [][]byte{}
	reader := hex.NewDecoder(strings.NewReader(response.Hex))
	for {
		header := make([]byte, 80)
		_, err := io.ReadFull(reader, header)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		headers = append(headers, header)
	}
	if len(headers) != response.Count {
		return nil, fmt.Errorf(
			"unexpected electrumx reply: should have gotten %d headers, but got %d",
			response.Count,
			len(headers))
	}
	return &HeadersResult{Headers: headers, Max: response.Max}, nil
}

// GetMerkleResult is returned by `GetMerkle()`.
type GetMerkleResult struct {
	Merkle      []string `json:"merkle"`
	Pos         int      `json:"pos"`
	BlockHeight int      `json:"block_height"`
}

// GetMerkle does the blockchain.transaction.get_merkle RPC call.
func (c *Client) GetMerkle(ctx context.Context, txHashHex string, height int) (*GetMerkleResult, error) {
	var response GetMerkleResult
	ctx, cancel := c.timeoutCtx(ctx)
	defer cancel()
	err := c.rpc.MethodBlocking(ctx, &response, "blockchain.transaction.get_merkle", txHashHex, height)
	if err != nil {
		return nil, err
	}
	if response.BlockHeight != height {
		return nil, fmt.Errorf("height should be %d, but got %d", height, response.BlockHeight)
	}
	return &response, nil
}

// Close closes the connection and shuts down all pending requests. All pending requests will be
// resolved with an error.
func (c *Client) Close() {
	close(c.quitCh)
	c.rpc.Close()
}
