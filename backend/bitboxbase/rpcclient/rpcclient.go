// Copyright 2019 Shift Devices AG
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

// Package rpcclient manages the connection with the bitboxbase, establishing a websocket listener and
// sending events when receiving packets. It also acts as a rpc client for any external package wanting
// to communicate with the base
package rpcclient

import (
	"net/http"
	"net/rpc"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"

	"github.com/flynn/noise"
	"github.com/gorilla/websocket"

	"github.com/sirupsen/logrus"
)

type rpcConn struct {
	readChan  chan []byte
	writeChan chan []byte
	closeChan chan struct{}
}

// newRPCConn returns a pointer to a rpcConn struct. RPCConn is used as an io.ReadWriteCloser by the rpc connection.
func newRPCConn() *rpcConn {
	RPCConn := &rpcConn{
		readChan:  make(chan []byte),
		writeChan: make(chan []byte),
		closeChan: make(chan struct{}),
	}
	return RPCConn
}

func (conn *rpcConn) ReadChan() chan []byte {
	return conn.readChan
}

func (conn *rpcConn) WriteChan() chan []byte {
	return conn.writeChan
}

func (conn *rpcConn) CloseChan() chan struct{} {
	return conn.closeChan
}

func (conn *rpcConn) Read(p []byte) (n int, err error) {
	message := <-conn.readChan
	return copy(p, message), nil
}

func (conn *rpcConn) Write(p []byte) (n int, err error) {
	conn.writeChan <- p
	return len(p), nil
}

func (conn *rpcConn) Close() error {
	if conn.closeChan != nil {
		close(conn.closeChan)
		conn.closeChan = nil
	}
	return nil
}

// RPCClient handles communication with the BitBox Base's rpc server
type RPCClient struct {
	log                 *logrus.Entry
	address             string
	bitboxBaseConfigDir string

	bitboxBaseNoiseStaticPubkey   []byte
	channelHash                   string
	channelHashAppVerified        bool
	channelHashBitBoxBaseVerified bool
	sendCipher, receiveCipher     *noise.CipherState
	onChangeStatus                func(bitboxbasestatus.Status)
	onEvent                       func(bitboxbasestatus.Event)
	onUnregister                  func() (bool, error)

	//rpc stuff
	client        *rpc.Client
	rpcConnection *rpcConn
}

// NewRPCClient returns a new bitboxbase rpcClient.
func NewRPCClient(address string,
	bitboxBaseConfigDir string,
	onChangeStatus func(bitboxbasestatus.Status),
	onEvent func(bitboxbasestatus.Event),
	onUnregister func() (bool, error)) (*RPCClient, error) {

	rpcClient := &RPCClient{
		log:                 logging.Get().WithGroup("bitboxbase"),
		address:             address,
		bitboxBaseConfigDir: bitboxBaseConfigDir,
		rpcConnection:       newRPCConn(),
		onChangeStatus:      onChangeStatus,
		onEvent:             onEvent,
		onUnregister:        onUnregister,
	}
	if success, err := rpcClient.Ping(); !success {
		return nil, err
	}
	return rpcClient, nil
}

// ChannelHash returns the noise channel and a boolean to indicate if it is verified
func (rpcClient *RPCClient) ChannelHash() (string, bool) {
	return rpcClient.channelHash, rpcClient.channelHashBitBoxBaseVerified
}

// Ping sends a get request to the bitbox base's middleware root handler and returns true if successful
func (rpcClient *RPCClient) Ping() (bool, error) {
	response, err := http.Get("http://" + rpcClient.address + "/")
	if err != nil {
		rpcClient.log.WithError(err).Error("No response from middleware")
		return false, err
	}

	if response.StatusCode != http.StatusOK {
		rpcClient.log.Error("Received http status code from middleware other than 200")
		return false, nil
	}
	return true, nil
}

// Connect starts the websocket go routine, first checking if the middleware is reachable,
// then establishing a websocket connection, then authenticating and encrypting all further traffic with noise.
func (rpcClient *RPCClient) Connect() error {
	rpcClient.log.Printf("connecting to base websocket")
	if success, err := rpcClient.Ping(); !success {
		return err
	}
	ws, _, err := websocket.DefaultDialer.Dial("ws://"+rpcClient.address+"/ws", nil)
	if err != nil {
		return errp.New("rpcClient: failed to create new websocket client")
	}
	if err = rpcClient.initializeNoise(ws); err != nil {
		return err
	}
	rpcClient.client = rpc.NewClient(rpcClient.rpcConnection)
	rpcClient.runWebsocket(ws, rpcClient.rpcConnection.WriteChan())
	return nil
}

func (rpcClient *RPCClient) parseMessage(message []byte) {
	if len(message) == 0 {
		rpcClient.log.Error("Received empty message, dropping.")
		return
	}
	opCode := string(message[0])
	switch opCode {
	case rpcmessages.OpUCanHasSampleInfo:
		rpcClient.onEvent(bitboxbasestatus.EventSampleInfoChange)
	case rpcmessages.OpUCanHasVerificationProgress:
		rpcClient.onEvent(bitboxbasestatus.EventVerificationProgressChange)
	case rpcmessages.OpRPCCall:
		message := message[1:]
		rpcClient.rpcConnection.ReadChan() <- message
	default:
		rpcClient.log.Error("Received message without opCode, dropping.")
	}
}

// Stop shuts down the websocket connection with the base
func (rpcClient *RPCClient) Stop() {
	err := rpcClient.client.Close()
	if err != nil {
		rpcClient.log.WithError(err).Error("failed to close rpc client")
	}
}

// GetEnv makes a synchronous rpc call to the base and returns the network type and electrs rpc port
func (rpcClient *RPCClient) GetEnv() (rpcmessages.GetEnvResponse, error) {
	var reply rpcmessages.GetEnvResponse
	err := rpcClient.client.Call("RPCServer.GetSystemEnv", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetSystemEnv RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetSampleInfo makes a synchronous rpc call to the base and returns the SampleInfoResponse struct
func (rpcClient *RPCClient) GetSampleInfo() (rpcmessages.SampleInfoResponse, error) {
	var reply rpcmessages.SampleInfoResponse
	err := rpcClient.client.Call("RPCServer.GetSampleInfo", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetSampleInfo RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetVerificationProgress makes a synchronous rpc call to the base and returns the VerificationProgressResponse struct
func (rpcClient *RPCClient) GetVerificationProgress() (rpcmessages.VerificationProgressResponse, error) {
	var reply rpcmessages.VerificationProgressResponse
	err := rpcClient.client.Call("RPCServer.GetVerificationProgress", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("VerificationProgress RPC call failed")
		return reply, err
	}
	return reply, nil
}

// ResyncBitcoin makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) ResyncBitcoin() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing ResyncBitcoin rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.ResyncBitcoin", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("ResyncBitcoin RPC call failed")
		return reply, err
	}
	return reply, nil
}

// ReindexBitcoin makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) ReindexBitcoin() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing ReindexBitcoin rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.ReindexBitcoin", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("ReindexBitcoin RPC call failed")
		return reply, err
	}
	return reply, nil
}

// SetHostname makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) SetHostname(args rpcmessages.SetHostnameArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing SetHostname rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.SetHostname", args, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("SetHostname RPC call failed")
		return reply, err
	}
	return reply, nil
}

// UserAuthenticate makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the user is successfully authenticated.
func (rpcClient *RPCClient) UserAuthenticate(args rpcmessages.UserAuthenticateArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing UserAuthenticate rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.UserAuthenticate", args, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("UserAuthenticate RPC call failed")
		return reply, err
	}
	return reply, nil
}

// UserChangePassword makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the password has been successfully changed .
func (rpcClient *RPCClient) UserChangePassword(args rpcmessages.UserChangePasswordArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing UserChangePassword rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.UserChangePassword", args, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("UserChangePassword RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetHostname makes a synchronous rpc call to the base and returns a GetHostnameResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) GetHostname() (rpcmessages.GetHostnameResponse, error) {
	rpcClient.log.Println("Executing GetHostname rpc call")
	var reply rpcmessages.GetHostnameResponse
	err := rpcClient.client.Call("RPCServer.GetHostname", true /*dummy Arg */, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetHostname RPC call failed")
		return reply, err
	}
	return reply, nil
}
