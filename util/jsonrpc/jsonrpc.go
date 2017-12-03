package jsonrpc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
)

const responseTimeout = 100 * time.Second

type callbacks struct {
	success func([]byte) error
	cleanup func(error)
}

// RPCClient is a generic json rpc client, which is able to invoke remote methods and subscribe to
// remote notifications.
type RPCClient struct {
	conn                  io.ReadWriteCloser
	msgID                 int
	msgIDLock             sync.Mutex
	responseCallbacks     map[int]callbacks
	responseCallbacksLock sync.RWMutex
	close                 bool

	notificationsCallbacks     map[string]func([]byte)
	notificationsCallbacksLock sync.RWMutex
}

// NewRPCClient creates a new RPCClient. conn is used for transport (e.g. a tcp/tls connection).
func NewRPCClient(conn io.ReadWriteCloser) (*RPCClient, error) {
	client := &RPCClient{
		conn:                   conn,
		msgID:                  0,
		responseCallbacks:      map[int]callbacks{},
		notificationsCallbacks: map[string]func([]byte){},
	}
	go client.read(client.handleResponse)
	return client, nil
}

func (client *RPCClient) handleError(err error) {
	fmt.Printf("%+v\n", err)
}

func (client *RPCClient) read(callback func([]byte)) {
	defer client.conn.Close()
	reader := bufio.NewReader(client.conn)
	for !client.close {
		line, err := reader.ReadBytes(byte('\n'))
		if err != nil {
			panic(err)
		}
		callback(line)
	}
}

func (client *RPCClient) handleResponse(responseBytes []byte) {
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
		client.handleError(errp.WithStack(err))
		return
	}
	if response.JSONRPC != "2.0" {
		client.handleError(errp.Newf("Unexpected json rpc version: %s", response.JSONRPC))
		return
	}
	if response.Error != nil {
		client.handleError(errp.New(string(*response.Error)))
		return
	}

	// Handle method response.
	if response.ID != nil {
		func() {
			client.responseCallbacksLock.RLock()
			responseCallbacks, ok := client.responseCallbacks[*response.ID]
			client.responseCallbacksLock.RUnlock()
			if ok {
				if len(response.Result) == 0 {
					responseCallbacks.cleanup(errp.New("unexpected reply"))
					return
				}
				responseCallbacks.cleanup(
					responseCallbacks.success([]byte(response.Result)),
				)
				client.responseCallbacksLock.Lock()
				delete(client.responseCallbacks, *response.ID)
				client.responseCallbacksLock.Unlock()
			}
		}()
	}

	// Handle notification.
	if response.Method != nil {
		if len(response.Params) == 0 {
			client.handleError(errp.New("unexpected reply"))
			return
		}
		func() {
			client.notificationsCallbacksLock.RLock()
			responseCallback, ok := client.notificationsCallbacks[*response.Method]
			client.notificationsCallbacksLock.RUnlock()
			if ok {
				responseCallback([]byte(response.Params))
			}
		}()
	}
}

// Method sends invokes the remote method with the provided parameters. The success callback is
// called with the response. cleanup is called afterwards in any case. The error passed to the
// cleanup callback can be nil (no error) or non-nil (general error or the error returned from the
// success callback.
func (client *RPCClient) Method(
	success func([]byte) error,
	cleanup func(error),
	method string,
	params ...interface{},
) error {
	client.msgIDLock.Lock()
	msgID := client.msgID
	client.msgID++
	client.msgIDLock.Unlock()
	if params == nil {
		params = []interface{}{}
	}
	jsonText := append(jsonp.MustMarshal(map[string]interface{}{
		"id":     msgID,
		"method": method,
		"params": params,
	}), byte('\n'))

	client.responseCallbacksLock.Lock()
	client.responseCallbacks[msgID] = callbacks{
		success: success,
		cleanup: cleanup,
	}
	client.responseCallbacksLock.Unlock()

	return client.send(jsonText)
}

// MethodSync is the same as method, but blocks until the response is available. The result is
// json-deserialized into response.
func (client *RPCClient) MethodSync(response interface{}, method string, params ...interface{}) error {
	responseChan := make(chan []byte)
	if err := client.Method(
		func(responseBytes []byte) error {
			responseChan <- responseBytes
			return nil
		},
		func(err error) {},
		method, params...); err != nil {
		return err
	}
	select {
	case responseBytes := <-responseChan:
		if response != nil {
			return errp.WithStack(json.Unmarshal(responseBytes, response))
		}
		return nil
	case <-time.After(responseTimeout):
		return errp.New("response timeout")
	}
}

// SubscribeNotifications installs a callback for a method which is called with notifications from
// the server.
func (client *RPCClient) SubscribeNotifications(method string, callback func([]byte)) error {
	client.notificationsCallbacksLock.Lock()
	defer client.notificationsCallbacksLock.Unlock()
	if _, ok := client.notificationsCallbacks[method]; ok {
		return errp.Newf("already subscribed to notifications of %s", method)
	}
	client.notificationsCallbacks[method] = callback
	return nil
}

func (client *RPCClient) send(msg []byte) error {
	_, err := client.conn.Write(msg)
	return errp.WithStack(err)
}

// Close shuts down the connection.
func (client *RPCClient) Close() {
	client.close = true
}
