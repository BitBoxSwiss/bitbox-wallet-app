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

package jsonrpc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"sync"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/sirupsen/logrus"
)

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
}

const (
	responseTimeout = 30 * time.Second
)

// Backend is a server to connect to.
type Backend struct {
	// Name is used in logging only, to identify the backend.
	Name string
	// EstablishConnection connects to the backend and returns a connection object to
	// read/write/close.
	EstablishConnection func() (io.ReadWriteCloser, error)
}

type callbacks struct {
	// success is called when a successful response has been received.
	success func([]byte) error
	// setupAndTeardown will be called before the response has been received.
	setupAndTeardown func() func(error)
	// cleanup will be called after the response has been received.
	cleanup func(error)
}

// SocketError indicates an error when reading from or writing to a network socket.
type SocketError struct {
	err        error
	connection *connection
}

func (err *SocketError) Error() string {
	return err.err.Error()
}

// ResponseError indicates an error when parsing the response from the server.
type ResponseError struct {
	err error
}

func (err *ResponseError) Error() string {
	return err.err.Error()
}

type connection struct {
	conn    io.ReadWriteCloser
	backend *Backend
}

type request struct {
	responseCallbacks callbacks
	method            string
	params            []interface{}
	jsonText          []byte
}

type heartBeat struct {
	method string
	params []interface{}
}

// RPCClient is a generic json rpc client, which is able to invoke remote methods and subscribe to
// remote notifications.
type RPCClient struct {
	connection *connection
	connLock   locker.Locker

	backends     []*Backend
	backendsLock locker.Locker

	pendingRequests     map[int]*request
	pendingRequestsLock locker.Locker

	pingRequests     map[int]bool
	pingRequestsLock locker.Locker

	subscriptionRequests     []*request
	subscriptionRequestsLock locker.Locker

	retryLock locker.Locker

	status                              Status
	onConnectionStatusChangesNotify     []func(Status)
	onConnectionStatusChangesNotifyLock locker.Locker

	onConnectCallback func() error
	heartBeat         *heartBeat

	msgID     int
	msgIDLock sync.Mutex
	close     bool

	notificationsCallbacks     map[string][]func([]byte)
	notificationsCallbacksLock locker.Locker

	onError func(error)

	log *logrus.Entry
}

// NewRPCClient creates a new RPCClient. conn is used for transport (e.g. a tcp/tls
// connection). onError is called for unexpected errors like malformed server responses.
func NewRPCClient(backends []*Backend, onError func(error), log *logrus.Entry) *RPCClient {
	client := &RPCClient{
		backends:                        backends,
		msgID:                           0,
		status:                          CONNECTED,
		onConnectionStatusChangesNotify: []func(Status){},
		pendingRequests:                 map[int]*request{},
		pingRequests:                    map[int]bool{},
		subscriptionRequests:            []*request{},
		notificationsCallbacks:          map[string][]func([]byte){},
		onError:                         onError,
		log:                             log,
	}
	return client
}

// ConnectionStatus returns the current connection status of this client to the backend(s).
func (client *RPCClient) ConnectionStatus() Status {
	if _, err := client.conn(); err != nil {
		return DISCONNECTED
	}
	return CONNECTED
}

// RegisterOnConnectionStatusChangedEvent registers an event that is fired if the connection status changes.
// After registration it fires the event to notify the holder of the callback about the current status.
// TODO: eventually return a de-register method that deletes the callback. Will be required once we
// allow the user to manage their accounts fully.
func (client *RPCClient) RegisterOnConnectionStatusChangedEvent(onConnectionStatusChangedEvent func(Status)) {
	defer client.onConnectionStatusChangesNotifyLock.Lock()()
	client.onConnectionStatusChangesNotify = append(client.onConnectionStatusChangesNotify, onConnectionStatusChangedEvent)
}

func (client *RPCClient) requeueSubscriptions() {
	defer client.subscriptionRequestsLock.Lock()()
	client.log.Debugf("Got %v subscriptions that need to be resubscribed", len(client.subscriptionRequests))
	for _, r := range client.subscriptionRequests {
		client.prepare(r.responseCallbacks.success, r.responseCallbacks.setupAndTeardown, r.method, r.params...)
	}
	client.subscriptionRequests = []*request{}
}

func (client *RPCClient) resendPendingRequests() {
	defer client.pendingRequestsLock.RLock()()
	client.log.Debugf("Queueing %v pending requests to resend.", len(client.pendingRequests))
	// This needs to be executed in a go-routine so that it doesn't block if the connection fails
	// and a failover is initiated.
	go func() {
		for _, request := range client.pendingRequests {
			err := client.send(request.jsonText)
			if err != nil {
				wait := time.Minute / 4
				client.log.Debugf("Resending failed. Waiting for %v", wait)
				time.Sleep(wait)
				// Resend again to collect all the subscriptions that were successfully registered
				// on the now-failed connection.
				client.resendPendingRequestsAndSubscriptions(err.connection)
				// Stop sending the pending requests in this goroutine.
				return
			}
		}
	}()
}

// resendPendingRequestsAndSubscriptions tries to re-subscribe to all subscriptions associated with the given
// connection and tries to issue pending methods via another connection.
func (client *RPCClient) resendPendingRequestsAndSubscriptions(failed *connection) {
	alreadyHandled := func() bool {
		defer client.retryLock.Lock()()
		return client.connection != failed
	}
	if alreadyHandled() {
		return
	}
	client.connection = nil
	if failed != nil {
		client.log.Debugf("Backend %v failed. Trying to re-subscribe and send pending requests via another connection", failed.backend.Name)
	} else {
		// in case socket error does not have any information about the connection, for example
		// when a timeout happens in the MethodSync function
		client.log.Debugf("Last backend failed. Trying to re-subscribe and send pending requests via another connection")
	}
	unlock := client.pingRequestsLock.Lock()
	client.pingRequests = map[int]bool{}
	unlock()
	client.requeueSubscriptions()
	client.resendPendingRequests()
}

// read reads incoming data from the given connection and executes the given success message.
// Any panics are caught and handled by retring to subscribe on another connection and sending
// out any pending methods via another connection.
func (client *RPCClient) read(connection *connection, success func(*connection, []byte)) {
	defer func() {
		_ = connection.conn.Close()
		if r := recover(); r != nil {
			if sockErr, ok := r.(*SocketError); ok {
				client.resendPendingRequestsAndSubscriptions(sockErr.connection)
				return
			}
			if err, ok := r.(error); ok {
				panic(errp.Wrap(err, "Unrecoverable error happened in read channel"))
			} else {
				panic(errp.Newf("Unrecoverable error happened in read channel: %v", r))
			}
		} else if client.close {
			client.setStatus(DISCONNECTED)
		}
	}()
	reader := bufio.NewReader(connection.conn)
	for !client.close {
		line, err := reader.ReadBytes(byte('\n'))
		if err != nil {
			panic(&SocketError{errp.Wrap(err, "Failed to read from socket"), connection})
		}
		success(connection, line)
	}
}

// establishConnection attempts to establish a connection to a given backend. On success, it returns
// a connection, otherwise it returns an error. If successful, the read function is started in a
// separate go routine to listen for incoming data.
func (client *RPCClient) establishConnection(backend *Backend) error {
	conn, err := backend.EstablishConnection()
	if err != nil {
		return err
	}
	client.log = client.log.WithField("backend", backend.Name)
	client.log.Debugf("Established connection to backend")
	client.connection = &connection{conn, backend}
	go client.read(client.connection, client.handleResponse)
	if err := client.onConnectCallback(); err != nil {
		client.log.WithError(err).Error("Error happened in connect callback")
		return err
	}
	go client.ping()
	return nil
}

func (client *RPCClient) notify(status Status) {
	for _, callback := range client.onConnectionStatusChangesNotify {
		callback(status)
	}
}

func (client *RPCClient) setStatus(status Status) {
	if status != client.status {
		client.status = status
		go client.notify(status)
	}
}

// conn returns either the currently active connection or, if none was found, establishes a new connection
// to any of the configured backends.
// The selection process is randomized, to balance the load between multiple backends for multiple
// desktop applications, but we store the active connection and ping it regularly to
// keep it alive (see ping()).
func (client *RPCClient) conn() (*connection, error) {
	if client.connection == nil {
		defer client.connLock.Lock()()
		if client.connection == nil {
			defer client.backendsLock.RLock()()
			start := 0
			if len(client.backends) > 0 {
				start = rand.Intn(len(client.backends))
			}
			for i := 0; i < len(client.backends); i++ {
				client.log.Debugf("Trying to connect to backend %v", client.backends[start].Name)
				err := client.establishConnection(client.backends[start])
				if err != nil {
					client.log.WithError(err).Info("Failover: backend is down")
					start = (start + 1) % len(client.backends)
				} else {
					client.log.Debug("Successfully connected to backend")
					break
				}
			}
			if client.connection == nil {
				client.log = client.log.WithField("backend", "offline")
				// tried all backends
				client.setStatus(DISCONNECTED)
				return nil, errp.Newf("Disconnected from all backends")
			}
			go client.setStatus(CONNECTED)
		}
	}
	return client.connection, nil
}

// cleanupFinishedRequest removes the finished request from the collection of pending requests
// and collects the subscription requests. It blocks resendPendingRequests(), and if it is a
// subscription request, resubscribe() and conn().
// If resubscribe() is already running, the subscription request will remain a pending request and
// be executed in the resendPendingRequest() function.
// If resendPendingRequest() is already running, the pending requests are executed again but the
// response is ignored because the request already finished with the previous connection.
func (client *RPCClient) cleanupFinishedRequest(responseError error, conn *connection, responseID int) {
	defer client.pendingRequestsLock.Lock()()
	finishedRequest := client.pendingRequests[responseID]
	finishedRequest.responseCallbacks.cleanup(responseError)
	if responseError != nil && client.isSubscriptionRequest(finishedRequest.method) {
		func() {
			defer client.subscriptionRequestsLock.Lock()()
			// if connection is still up and running we add it to the list of subscription requests
			// and remove it from the collection of pending requests.  Otherwise it remains in the
			// collection of pending requests.
			defer client.connLock.Lock()()
			if client.connection == conn {
				client.subscriptionRequests = append(client.subscriptionRequests, finishedRequest)
				delete(client.pendingRequests, responseID)
			}
		}()
	} else {
		// All non-subscription requests that are not resend are handled and can be removed from the
		// collection of pending requests.
		delete(client.pendingRequests, responseID)
	}
}

func (client *RPCClient) handleResponse(conn *connection, responseBytes []byte) {
	// fmt.Println("got response ", string(responseBytes))

	// Catch all response.
	// A notification contains:
	// - jsonrpc
	// - method
	// - params
	// A method call response contains:
	// - jsonrpc
	// - id
	// - result
	// - (error)
	response := &struct {
		JSONRPC string           `json:"jsonrpc"`
		ID      *int             `json:"id"`
		Error   *json.RawMessage `json:"error"`
		Result  json.RawMessage  `json:"result"`
		Method  *string          `json:"method"`
		Params  json.RawMessage  `json:"params"`
	}{}
	if err := json.Unmarshal(responseBytes, response); err != nil {
		// panic will be caught in read() and subscribed connections will be re-subscribed
		client.log.WithError(err).Errorf("invalid json response: %s", string(responseBytes))
		if client.onError != nil {
			client.onError(&ResponseError{err})
		}
		return
	}
	if response.JSONRPC != "2.0" {
		err := &ResponseError{errp.Newf("Unexpected json rpc version: %s", response.JSONRPC)}
		client.log.WithError(err).Error("Unexpected response")
		if client.onError != nil {
			client.onError(err)
		}
		return
	}

	parseError := func(msg json.RawMessage) string {
		errStruct := &struct {
			Message string `json:"message"`
		}{}
		if err := json.Unmarshal(msg, errStruct); err != nil {
			return string(msg)
		}
		return errStruct.Message
	}

	// Handle method response.
	if response.ID != nil {
		runlock := client.pendingRequestsLock.RLock()
		pendingRequest, ok := client.pendingRequests[*response.ID]
		runlock()
		var responseError error
		if ok {
			responseCallbacks := pendingRequest.responseCallbacks
			if response.Error != nil {
				responseError = &ResponseError{errp.New(parseError(*response.Error))}
			} else if len(response.Result) == 0 {
				responseError = &ResponseError{errp.New("unexpected reply from ElectrumX")}
			} else if err := responseCallbacks.success([]byte(response.Result)); err != nil {
				responseError = &ResponseError{errp.Cause(err)}
			}
			// if responseError != nil {
			// 	panic(responseError)
			// }
			defer client.cleanupFinishedRequest(responseError, conn, *response.ID)
		} else {
			unlock := client.pingRequestsLock.Lock()
			_, ok := client.pingRequests[*response.ID]
			if ok {
				client.log.Debug("Pong")
				delete(client.pingRequests, *response.ID)
			} else {
				client.log.WithField("request_id", *response.ID).WithField("response", string(response.Result)).Info("Request not found in list of " +
					"pending requests. It's likely that it finished before a failover and we therefore " +
					"do not have to do anything.")
			}
			unlock()
		}
	}
	// Handle notification.
	if response.Method != nil {
		client.log.Debug("Calling subscription callbacks")
		if len(response.Params) == 0 {
			return
		}
		func() {
			unlock := client.notificationsCallbacksLock.RLock()
			responseCallbacks := client.notificationsCallbacks[*response.Method]
			unlock()
			for _, responseCallback := range responseCallbacks {
				responseCallback([]byte(response.Params))
			}
		}()
	} else if response.ID == nil && response.Error != nil {
		panic(&ResponseError{errp.Newf("Unexpected response: %v", response.Error)})
	}
}

// OnConnect executed the given callback whenever a new connection is established
func (client *RPCClient) OnConnect(callback func() error) {
	client.onConnectCallback = callback
}

// RegisterHeartbeat registers the heartbeat method and parameters that are sent to the backend
// to keep the connection alive
func (client *RPCClient) RegisterHeartbeat(
	method string,
	params ...interface{},
) {
	client.heartBeat = &heartBeat{method, params}
}

// ping periodically pings the server to keep the connection alive.
func (client *RPCClient) ping() {
	for !client.close {
		time.Sleep(time.Minute)
		if client.heartBeat == nil {
			continue
		}
		msgID, jsonText := client.transform(
			client.heartBeat.method, client.heartBeat.params...)
		unlock := client.pingRequestsLock.Lock()
		client.pingRequests[msgID] = true
		unlock()
		client.log.Debug("Ping")
		err := client.send(jsonText)
		if err != nil {
			client.log.Debug("Resend triggered in ping")
			client.resendPendingRequestsAndSubscriptions(err.connection)
			// ping will be restarted when the connection is established.
			return
		}
	}
}

func (client *RPCClient) isSubscriptionRequest(method string) bool {
	defer client.notificationsCallbacksLock.RLock()()
	_, ok := client.notificationsCallbacks[method]
	return ok
}

func (client *RPCClient) transform(
	method string,
	params ...interface{},
) (int, []byte) {
	client.msgIDLock.Lock()
	msgID := client.msgID
	client.msgID++
	client.msgIDLock.Unlock()
	if params == nil {
		params = []interface{}{}
	}
	return msgID, append(jsonp.MustMarshal(map[string]interface{}{
		"id":     msgID,
		"method": method,
		"params": params,
	}), byte('\n'))
}

// prepare ...
func (client *RPCClient) prepare(
	success func([]byte) error,
	setupAndTeardown func() func(error),
	method string,
	params ...interface{},
) []byte {
	// Ideally, we should have a worker thread that processes a "to be send" list.
	cleanup := func(error) {}
	if setupAndTeardown != nil {
		cleanup = setupAndTeardown()
	}

	msgID, jsonText := client.transform(method, params...)

	defer client.pendingRequestsLock.Lock()()
	client.pendingRequests[msgID] = &request{
		callbacks{
			success:          success,
			setupAndTeardown: setupAndTeardown,
			cleanup:          cleanup,
		},
		method,
		params,
		jsonText,
	}
	return jsonText
}

// Method sends invokes the remote method with the provided parameters. Before the request is send,
// the setupAndTeardown callback is executed and the return value is stored as cleanup callback with the pending request.
// The success callback is called with the response. cleanup is called afterwards.
func (client *RPCClient) Method(
	success func([]byte) error,
	setupAndTeardown func() func(error),
	method string,
	params ...interface{},
) {
	jsonText := client.prepare(success, setupAndTeardown, method, params...)
	err := client.send(jsonText)
	if err != nil {
		client.log.Debugf("Resend triggered in Method (%v)", method)
		go client.resendPendingRequestsAndSubscriptions(err.connection)
	}
}

// MethodSync is the same as method, but blocks until the response is available. The result is
// json-deserialized into response.
func (client *RPCClient) MethodSync(response interface{}, method string, params ...interface{}) error {
	responseChan := make(chan []byte)
	errChan := make(chan error)

	client.Method(
		func(responseBytes []byte) error {
			responseChan <- responseBytes
			return nil
		},
		func() func(error) { return func(error) {} },
		method, params...)
	select {
	case err := <-errChan:
		return err
	case responseBytes := <-responseChan:
		if response != nil {
			if err := json.Unmarshal(responseBytes, response); err != nil {
				return &ResponseError{errp.Wrap(err, fmt.Sprintf("Failed to unmarshal response: %v", string(responseBytes)))}
			}
		}
	case <-time.After(responseTimeout):
		return &SocketError{errp.New("response timeout"), nil}
	}
	return nil
}

// SubscribeNotifications installs a callback for a method which is called with notifications from
// the server.
func (client *RPCClient) SubscribeNotifications(method string, callback func([]byte)) {
	defer client.notificationsCallbacksLock.Lock()()
	if _, ok := client.notificationsCallbacks[method]; !ok {
		client.notificationsCallbacks[method] = []func([]byte){}
	}
	client.notificationsCallbacks[method] = append(client.notificationsCallbacks[method], callback)
}

func (client *RPCClient) send(msg []byte) *SocketError {
	conn, err := client.conn()
	if err != nil {
		return &SocketError{errp.WithStack(err), conn}
	}
	_, err = conn.conn.Write(msg)
	if err != nil {
		return &SocketError{errp.WithStack(err), conn}
	}
	return nil
}

// Close shuts down the connection.
func (client *RPCClient) Close() {
	client.log.Debug("closing rpc client")
	client.close = true
}

// IsClosed returns true if the client is closed and false otherwise.
func (client *RPCClient) IsClosed() bool {
	return client.close
}
