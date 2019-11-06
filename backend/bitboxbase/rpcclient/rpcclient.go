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
	channelHashBitBoxBaseVerified bool
	sendCipher, receiveCipher     *noise.CipherState
	onChangeStatus                func(bitboxbasestatus.Status)
	onEvent                       func(bitboxbasestatus.Event)
	onUnregister                  func() error

	//rpc stuff
	client        *rpc.Client
	rpcConnection *rpcConn
	jwtToken      string
}

// NewRPCClient returns a new bitboxbase rpcClient.
func NewRPCClient(address string,
	bitboxBaseConfigDir string,
	onChangeStatus func(bitboxbasestatus.Status),
	onEvent func(bitboxbasestatus.Event),
	onUnregister func() error) (*RPCClient, error) {

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
	setupStatus, err := rpcClient.GetSetupStatus()
	if err != nil {
		return err
	}
	if !setupStatus.MiddlewarePasswordSet {
		// If the password has not been set yet authenticate the user with the dummy password.
		reply, err := rpcClient.UserAuthenticate(rpcmessages.UserAuthenticateArgs{Username: "admin", Password: "ICanHasPasword?"})
		if err != nil {
			return err
		}
		if !reply.ErrorResponse.Success {
			return reply.ErrorResponse
		}
		// let the frontend know that the password needs to be set.
		rpcClient.onChangeStatus(bitboxbasestatus.StatusPasswordNotSet)
	} else {
		rpcClient.onChangeStatus(bitboxbasestatus.StatusLocked)
	}
	return nil
}

func (rpcClient *RPCClient) parseMessage(message []byte) {
	if len(message) == 0 {
		rpcClient.log.Error("Received empty message, dropping.")
		return
	}
	opCode := string(message[0])
	switch opCode {
	case rpcmessages.OpServiceInfoChanged:
		rpcClient.onEvent(bitboxbasestatus.EventServiceInfoChanged)
	case rpcmessages.OpBaseUpdateProgressChanged:
		rpcClient.onEvent(bitboxbasestatus.EventBaseUpdateProgressChange)
	case rpcmessages.OpBaseUpdateIsAvailable:
		rpcClient.onEvent(bitboxbasestatus.EventUpdateAvailable)
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

// GetSetupStatus makes a synchronous rpc call to the base and returns the setup status.
// This is used for the base setup wizard and is not authenticated.
func (rpcClient *RPCClient) GetSetupStatus() (rpcmessages.SetupStatusResponse, error) {
	var reply rpcmessages.SetupStatusResponse
	err := rpcClient.client.Call("RPCServer.GetSetupStatus", true, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetSetupStatus RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetEnv makes a synchronous rpc call to the base and returns the network type and electrs rpc port
func (rpcClient *RPCClient) GetEnv() (rpcmessages.GetEnvResponse, error) {
	var reply rpcmessages.GetEnvResponse
	err := rpcClient.client.Call("RPCServer.GetSystemEnv", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetSystemEnv RPC call failed")
		return reply, err
	}
	return reply, nil
}

// ResyncBitcoin makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) ResyncBitcoin() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing ResyncBitcoin rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.ResyncBitcoin", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// ReindexBitcoin makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) ReindexBitcoin() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing ReindexBitcoin rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.ReindexBitcoin", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// SetHostname makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) SetHostname(args rpcmessages.SetHostnameArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing SetHostname rpc call")
	args.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.SetHostname", args, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// UserAuthenticate makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the user is successfully authenticated.
func (rpcClient *RPCClient) UserAuthenticate(args rpcmessages.UserAuthenticateArgs) (rpcmessages.UserAuthenticateResponse, error) {
	rpcClient.log.Println("Executing UserAuthenticate rpc call")
	var reply rpcmessages.UserAuthenticateResponse
	err := rpcClient.client.Call("RPCServer.UserAuthenticate", args, &reply)
	if err != nil {
		return rpcmessages.UserAuthenticateResponse{}, errp.WithStack(err)
	}
	rpcClient.jwtToken = reply.Token
	return reply, nil
}

// UserChangePassword makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the password has been successfully changed .
func (rpcClient *RPCClient) UserChangePassword(args rpcmessages.UserChangePasswordArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing UserChangePassword rpc call")
	args.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.UserChangePassword", args, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// BackupSysconfig makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) BackupSysconfig() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing BackupSysconfig rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.BackupSysconfig", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// BackupHSMSecret makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) BackupHSMSecret() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing BackupHSMSecret rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.BackupHSMSecret", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// RestoreSysconfig makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) RestoreSysconfig() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing RestoreSysconfig rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.RestoreSysconfig", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// RestoreHSMSecret makes a synchronous rpc call to the base and returns a ErrorResponse indicating if the called script was successfully executed.
func (rpcClient *RPCClient) RestoreHSMSecret() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing RestoreHSMSecret rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.RestoreHSMSecret", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableTor makes an rpc call to the Base that enables/disables the tor.service based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableTor(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableTorTor: %v' rpc call\n", toggleAction)
	var reply rpcmessages.ErrorResponse
	toggleAction.Token = rpcClient.jwtToken
	err := rpcClient.client.Call("RPCServer.EnableTor", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableTorMiddleware makes an rpc call to BitBoxBase that enables/disables the Tor hidden service for the middleware based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableTorMiddleware(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableTorMiddleware: %v' rpc call\n", toggleAction)
	toggleAction.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.EnableTorMiddleware", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableTorElectrs makes an rpc call to BitBoxBase that enables/disables the Tor hidden service for electrs based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableTorElectrs(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableTorElectrs: %v' rpc call\n", toggleAction)
	toggleAction.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.EnableTorElectrs", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableTorSSH makes an rpc call to BitBoxBase that enables/disables the tor hidden service for SSH based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableTorSSH(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableTorSSH: %v' rpc call\n", toggleAction)
	toggleAction.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.EnableTorSSH", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableClearnetIBD makes an rpc call to BitBoxBase that configures bitcoind to run over clearnet while in IBD mode based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableClearnetIBD(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableClearnetIBD: %v' rpc call\n", toggleAction)
	toggleAction.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.EnableClearnetIBD", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// EnableRootLogin makes an rpc call to BitBoxBase that enables/disables login via the root user/password based on rpcmessages.ToggleSettingArgs Enable/Disable
func (rpcClient *RPCClient) EnableRootLogin(toggleAction rpcmessages.ToggleSettingArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Printf("Executing 'EnableRootLogin: %v' rpc call\n", toggleAction)
	toggleAction.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.EnableRootLogin", toggleAction, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// SetRootPassword makes an rpc call to BitBoxBase that sets the systems root password
func (rpcClient *RPCClient) SetRootPassword(args rpcmessages.SetRootPasswordArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing SetRootPassword rpc call")
	args.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.SetRootPassword", args, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// ShutdownBase makes an rpc call to BitBoxBase that calls the bbb-cmd.sh script which initiates a `shutdown now`
func (rpcClient *RPCClient) ShutdownBase() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing ShutdownBase rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.ShutdownBase", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// RebootBase makes an rpc call to BitBoxBase that calls the bbb-cmd.sh script which initiates a `reboot`
func (rpcClient *RPCClient) RebootBase() (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing RebootBase rpc call")
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.RebootBase", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// UpdateBase makes an rpc call to BitBoxBase that updates the Base to the passed version.
// The Base is restarted after a successful RPC call.
func (rpcClient *RPCClient) UpdateBase(args rpcmessages.UpdateBaseArgs) (rpcmessages.ErrorResponse, error) {
	rpcClient.log.Println("Executing UpdateBase rpc call")
	args.Token = rpcClient.jwtToken
	var reply rpcmessages.ErrorResponse
	err := rpcClient.client.Call("RPCServer.UpdateBase", args, &reply)
	if err != nil {
		return rpcmessages.ErrorResponse{}, errp.WithStack(err)
	}
	return reply, nil
}

// GetBaseUpdateProgress returns the current Base update progress.
// This RPC should be called when the middleware sends a notification that the Base update progress changed.
func (rpcClient *RPCClient) GetBaseUpdateProgress() (rpcmessages.GetBaseUpdateProgressResponse, error) {
	var reply rpcmessages.GetBaseUpdateProgressResponse
	err := rpcClient.client.Call("RPCServer.GetBaseUpdateProgress", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetBaseUpdateProgress RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetBaseInfo makes a synchronous rpc call to the base and returns the GetBaseInfoResponse struct
func (rpcClient *RPCClient) GetBaseInfo() (rpcmessages.GetBaseInfoResponse, error) {
	var reply rpcmessages.GetBaseInfoResponse
	err := rpcClient.client.Call("RPCServer.GetBaseInfo", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetBaseInfo RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetServiceInfo makes a synchronous RPC call to the Base and returns the GetServiceInfoResponse struct
func (rpcClient *RPCClient) GetServiceInfo() (rpcmessages.GetServiceInfoResponse, error) {
	var reply rpcmessages.GetServiceInfoResponse
	err := rpcClient.client.Call("RPCServer.GetServiceInfo", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetServiceInfo RPC call failed")
		return reply, err
	}
	return reply, nil
}

// GetBaseUpdateInfo makes a synchronous RPC call to the Base and returns the IsBaseUpdateAvailable struct
// with corresponding UpdateInfo
func (rpcClient *RPCClient) GetBaseUpdateInfo() (rpcmessages.IsBaseUpdateAvailableResponse, error) {
	var reply rpcmessages.IsBaseUpdateAvailableResponse
	err := rpcClient.client.Call("RPCServer.IsBaseUpdateAvailable", rpcmessages.AuthGenericRequest{Token: rpcClient.jwtToken}, &reply)
	if err != nil {
		rpcClient.log.WithError(err).Error("GetBaseUpdateInfo RPC call failed")
		return reply, err
	}
	return reply, nil
}
