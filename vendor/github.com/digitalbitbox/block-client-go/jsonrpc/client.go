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

package jsonrpc

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/digitalbitbox/block-client-go/jsonrpc/types"
)

const writeTimeout = 10 * time.Second

// SocketError is an error writing to or reading from a socket.
type SocketError error

// Options to configure the JSON RPC client.
type Options struct {
	// Dial connects to the server and returns a connection object.
	Dial func() (net.Conn, error)
}

type pendingRequest struct {
	cancel     context.CancelFunc
	onResponse func([]byte, error)
}

// Client is a generic JSON RPC 2.0 client, which is able to invoke remote methods and
// subscribe to remote notifications.
type Client struct {
	opts              *Options
	conn              net.Conn
	msgID             int
	msgIDMu           sync.Mutex
	pendingRequests   map[int]pendingRequest
	pendingRequestsMu sync.RWMutex
	closed            bool
	closedMu          sync.RWMutex
	onError           func(error)
	onErrorMu         sync.RWMutex
	onNotification    func(method string, params json.RawMessage)
	onNotificationMu  sync.RWMutex
}

// Connect creates a new JSON RPC client. It returns an error if the connection fails.
func Connect(opts *Options) (*Client, error) {
	conn, err := opts.Dial()
	if err != nil {
		return nil, err
	}
	client := &Client{
		opts:            opts,
		pendingRequests: map[int]pendingRequest{},
		conn:            conn,
	}
	go client.readLoop()
	return client, nil
}

// SetOnError defines a callback that is called when there is a processing error in the socket read
// loop, e.g. a `SocketError` if there was a socket read error, or any other error if a JSON RPC
// read could not be deserialized or is otherwise invalid.
func (c *Client) SetOnError(f func(error)) {
	c.onErrorMu.Lock()
	defer c.onErrorMu.Unlock()
	c.onError = f
}

func (c *Client) fireOnError(err error) {
	c.onErrorMu.RLock()
	onError := c.onError
	defer c.onErrorMu.RUnlock()
	if onError != nil {
		go onError(err)
	}
}

func (c *Client) readLoop() {
	reader := bufio.NewReader(c.conn)
	for !c.isClosed() {
		line, err := reader.ReadBytes(byte('\n'))
		if err != nil {
			c.fireOnError(SocketError(fmt.Errorf("failed to read from socket: %w", err)))
			c.Close()
			return
		}
		go c.handleResponse(line)
	}
}

func (c *Client) handleResponse(responseBytes []byte) {
	handle := func() error {
		var resp types.Response
		if err := json.Unmarshal(responseBytes, &resp); err != nil {
			return err
		}
		if resp.JSONRPC != types.JSONRPC {
			return fmt.Errorf("Unexpected json rpc version: Expected %s, got %s", types.JSONRPC, resp.JSONRPC)
		}
		// Handle method response.
		if resp.ID != nil {
			c.pendingRequestsMu.Lock()
			pendingRequest, ok := c.pendingRequests[*resp.ID]
			// ok is false is the request was never made or if it was canceled/timed out before the
			// response arrived.
			if ok {
				delete(c.pendingRequests, *resp.ID)
			}
			c.pendingRequestsMu.Unlock()
			if ok {
				if err := resp.ParseError(); err != nil {
					pendingRequest.onResponse(nil, err)
				} else if len(resp.Result) == 0 {
					pendingRequest.onResponse(nil, fmt.Errorf("unexpected empty result"))
				} else {
					pendingRequest.onResponse(resp.Result, nil)
				}
			}
		}
		// Handle notification.
		c.onNotificationMu.RLock()
		onNotification := c.onNotification
		c.onNotificationMu.RUnlock()
		if resp.Method != nil && onNotification != nil {
			onNotification(*resp.Method, resp.Params)
		}
		return nil
	}
	if err := handle(); err != nil {
		c.fireOnError(err)
	}
}

func (c *Client) nextMsgID() int {
	c.msgIDMu.Lock()
	defer c.msgIDMu.Unlock()
	c.msgID++
	return c.msgID
}

// Method invokes a JSON RPC method. onResponse is called either with the response, or with an error
// if the context finished (cancelled or timeout).
func (c *Client) Method(
	ctx context.Context,
	onResponse func([]byte, error),
	method string,
	params ...interface{}) error {
	if params == nil {
		params = []interface{}{}
	}
	msgID := c.nextMsgID()
	request := types.Request{
		ID:     msgID,
		Method: method,
		Params: params,
	}
	msg, err := json.Marshal(&request)
	if err != nil {
		return err
	}
	msg = append(msg, byte('\n'))

	ctx, cancel := context.WithCancel(ctx)
	c.pendingRequestsMu.Lock()
	c.pendingRequests[msgID] = pendingRequest{
		cancel: cancel,
		onResponse: func(responseBytes []byte, err error) {
			defer cancel()
			onResponse(responseBytes, err)
		},
	}
	c.pendingRequestsMu.Unlock()

	_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	_, err = c.conn.Write(msg)
	if err != nil {
		c.Close()
		return SocketError(fmt.Errorf("Failed to write to socket: %w", err))
	}

	// Resolve request abnormally (timeout or cancelled).
	go func() {
		<-ctx.Done()
		c.pendingRequestsMu.Lock()
		pendingRequest, ok := c.pendingRequests[msgID]
		if ok {
			delete(c.pendingRequests, msgID)
		}
		c.pendingRequestsMu.Unlock()
		if ok { // this is false if the request was already resolved successfully.
			pendingRequest.onResponse(nil, ctx.Err())
		}
	}()
	return nil
}

// OnNotification defines a callback that is called when a JSON RPC notification is
// received. `params` are JSON bytes and should be unmarshalled into the an appropriate type.
func (c *Client) OnNotification(onNotification func(method string, params json.RawMessage)) {
	c.onNotificationMu.Lock()
	defer c.onNotificationMu.Unlock()
	c.onNotification = onNotification
}

// MethodBlocking is like `Method`, but blocking until there is a response. The json response is
// JSON unmarshalled into `response`.
func (c *Client) MethodBlocking(ctx context.Context, response interface{}, method string, params ...interface{}) error {
	type responseOrError struct {
		responseBytes []byte
		err           error
	}
	responseChan := make(chan responseOrError)
	err := c.Method(
		ctx,
		func(responseBytes []byte, err error) {
			responseChan <- responseOrError{responseBytes, err}
		},
		method, params...)
	if err != nil {
		return err
	}
	resp := <-responseChan
	if resp.err != nil {
		return resp.err
	}
	if err := json.Unmarshal(resp.responseBytes, response); err != nil {
		return fmt.Errorf("Failed to unmarshal response: %v. Error: %w", string(resp.responseBytes), err)
	}
	return nil
}

func (c *Client) isClosed() bool {
	c.closedMu.RLock()
	defer c.closedMu.RUnlock()
	return c.closed
}

// Close closes the connection and shuts down all pending requests. All pending requests will be
// resolved with an error.
func (c *Client) Close() {
	c.closedMu.Lock()
	defer c.closedMu.Unlock()
	if c.closed {
		return
	}

	_ = c.conn.Close()

	c.pendingRequestsMu.Lock()
	for _, pendingRequest := range c.pendingRequests {
		pendingRequest.cancel()
	}
	c.pendingRequestsMu.Unlock()

	c.closed = true
}
