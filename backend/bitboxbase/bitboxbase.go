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

package bitboxbase

import (
	"fmt"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcclient"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"

	"github.com/sirupsen/logrus"
)

// Interface represents bitbox base.
type Interface interface {

	// Identifier returns the bitboxBaseID.
	Identifier() string

	// GetRPCClient returns the rpcClient so we can listen to its events.
	RPCClient() *rpcclient.RPCClient

	// Close tells the bitboxbase to close all connections.
	Close()

	// GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
	GetRegisterTime() time.Time

	// MiddlewareInfo returns some blockchain information.
	MiddlewareInfo() (rpcmessages.SampleInfoResponse, error)

	// VerificationProgress returns the bitcoind verification progress.
	VerificationProgress() (rpcmessages.VerificationProgressResponse, error)

	// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly
	ConnectElectrum() error

	// Ping sends a get requset to the bitbox base middleware root handler and returns true if successful
	Ping() (bool, error)

	// Self returns an instance of the base
	Self() *BitBoxBase

	// Status returns the current status of the base
	Status() bitboxbasestatus.Status

	// ChannelHash returns the hash of the noise channel
	ChannelHash() (string, bool)

	// Deregister calls the backend's BitBoxBase Deregister callback and sends a notification to the frontend, if bitboxbase is active.
	// If bitboxbase is not active, an error is returned.
	Deregister() (bool, error)

	// SyncOption returns true if the bitcoin resync rpc call executed successfully
	SyncWithOption(SyncOption) (bool, error)

	// GetHostname returns the hostname of the BitBox Base
	GetHostname() (string, error)

	// SetHostname sets the hostname of the BitBox Base
	SetHostname(string) (bool, error)

	// UserChangePassword sets a new password for a given user
	// TODO: this is a dummy
	UserChangePassword(string, string) (bool, error)

	// UserAuthenticate returns is the authentication with a username and password was successful
	// TODO: this is a dummy
	UserAuthenticate(string, string) (bool, error)
}

// SyncOption is a user provided blockchain sync option during BBB initialization
type SyncOption string

// SyncOption iota has three options:
// Accept pre-synchronized blockchain; delete the chainstate and reindex; resync bitcon from scratch with an IBD
const (
	SyncOptionPresynced            SyncOption = "preSynced"
	SyncOptionReindex              SyncOption = "reindex"
	SyncOptionInitialBlockDownload SyncOption = "initialBlockDownload"
)

// BitBoxBase provides the dictated bitboxbase api to communicate with the base
type BitBoxBase struct {
	observable.Implementation

	bitboxBaseID        string //This is just the ip currently
	registerTime        time.Time
	address             string
	rpcClient           *rpcclient.RPCClient
	electrsRPCPort      string
	network             string
	log                 *logrus.Entry
	config              *config.Config
	bitboxBaseConfigDir string
	status              bitboxbasestatus.Status
	active              bool //this indicates if the bitboxbase is in use, or being disconnected

	onUnregister func(string)
}

//NewBitBoxBase creates a new bitboxBase instance
func NewBitBoxBase(address string, id string, config *config.Config, bitboxBaseConfigDir string, onUnregister func(string)) (*BitBoxBase, error) {
	bitboxBase := &BitBoxBase{
		log:                 logging.Get().WithGroup("bitboxbase"),
		bitboxBaseID:        id,
		address:             strings.Split(address, ":")[0],
		registerTime:        time.Now(),
		config:              config,
		bitboxBaseConfigDir: bitboxBaseConfigDir,
		status:              bitboxbasestatus.StatusConnected,
		onUnregister:        onUnregister,
		active:              false,
	}
	rpcClient, err := rpcclient.NewRPCClient(address, bitboxBaseConfigDir, bitboxBase.changeStatus, bitboxBase.fireEvent, bitboxBase.Deregister)
	bitboxBase.rpcClient = rpcClient

	return bitboxBase, err
}

// Self returns the current bitbox base instance.
func (base *BitBoxBase) Self() *BitBoxBase {
	return base
}

// ConnectRPCClient starts the connection with the remote bitbox base middleware
func (base *BitBoxBase) ConnectRPCClient() error {
	if err := base.rpcClient.Connect(); err != nil {
		return err
	}
	response, err := base.rpcClient.GetEnv()
	if err != nil {
		return err
	}
	base.network = response.Network
	base.electrsRPCPort = response.ElectrsRPCPort
	base.active = true
	return nil
}

// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly
func (base *BitBoxBase) ConnectElectrum() error {
	if !base.active {
		return errp.New("Attempted call to non-active base")
	}
	electrumAddress := base.address + ":" + base.electrsRPCPort

	electrumCert, err := electrum.DownloadCert(electrumAddress)
	if err != nil {
		base.log.WithField("ElectrumIP: ", electrumAddress).Error(err.Error())
		return err
	}

	if err := electrum.CheckElectrumServer(
		electrumAddress,
		electrumCert,
		base.log); err != nil {
		base.log.WithField("ElectrumIP: ", electrumAddress).Error(err.Error())
		return err
	}

	base.log.WithField("ElectrumAddress:", electrumAddress).Debug("Setting config to base electrum Server...")

	// BaseBtcConfig sets the TBTC configs to the provided cert and ip.
	if base.isTestnet() {
		base.config.SetTBTCElectrumServers(electrumAddress, electrumCert)
	} else {
		base.config.SetBTCElectrumServers(electrumAddress, electrumCert)
	}
	// Disable Litecoin and Ethereum accounts - we do not want any more traffic hitting other servers
	base.config.SetBtcOnly()

	if err := base.config.SetAppConfig(base.config.AppConfig()); err != nil {
		return err
	}
	return nil
}

// Deregister calls the backend's BitBoxBaseDeregister callback and sends a notification to the frontend, if bitboxbase is active.
// If bitboxbase is not active, an error is returned.
func (base *BitBoxBase) Deregister() (bool, error) {
	if base.active {
		// let the frontend know that the base is disconnected
		base.fireEvent("disconnect")
		base.onUnregister(base.bitboxBaseID)
		base.active = false
		return true, nil
	}
	return false, errp.New("Attempted call to non-active base")
}

// ChannelHash returns the bitboxbase's rpcClient noise channel hash
func (base *BitBoxBase) ChannelHash() (string, bool) {
	return base.rpcClient.ChannelHash()
}

// Status returns the current state of the bitboxbase.
func (base *BitBoxBase) Status() bitboxbasestatus.Status {
	return base.status
}

// fireEvent notifies the frontend of an event in the bitboxbase
func (base *BitBoxBase) fireEvent(event bitboxbasestatus.Event) {
	base.Notify(observable.Event{
		Subject: fmt.Sprintf("/bitboxbases/%s/event", base.bitboxBaseID),
		Action:  action.Replace,
		Object:  event,
	})
}

func (base *BitBoxBase) changeStatus(status bitboxbasestatus.Status) {
	base.status = status
	base.fireEvent(bitboxbasestatus.EventStatusChange)
}

// RPCClient returns ths current instance of the rpcClient
func (base *BitBoxBase) RPCClient() *rpcclient.RPCClient {
	return base.rpcClient
}

// MiddlewareInfo returns the received MiddlewareInfo packet from the rpcClient
func (base *BitBoxBase) MiddlewareInfo() (rpcmessages.SampleInfoResponse, error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return rpcmessages.SampleInfoResponse{}, err
	}
	return base.rpcClient.GetSampleInfo()
}

// VerificationProgress returns the received VerificationProgress packet from the rpcClient
func (base *BitBoxBase) VerificationProgress() (rpcmessages.VerificationProgressResponse, error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return rpcmessages.VerificationProgressResponse{}, err
	}
	return base.rpcClient.GetVerificationProgress()
}

// SyncWithOption returns true if the chosen sync option was executed successfully
func (base *BitBoxBase) SyncWithOption(option SyncOption) (bool, error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return false, err
	}
	switch option {
	case SyncOptionPresynced:
		base.changeStatus(bitboxbasestatus.StatusInitialized)
		return true, nil
	case SyncOptionReindex:
		base.log.Println("bitboxbase is making a ReindexBitcoin call")
		replySuccess, err := base.rpcClient.ReindexBitcoin()
		base.changeStatus(bitboxbasestatus.StatusInitialized)
		return replySuccess.Success, err
	case SyncOptionInitialBlockDownload:
		base.log.Println("bitboxbase is making a ResyncBitcoin call")
		replySuccess, err := base.rpcClient.ResyncBitcoin()
		base.changeStatus(bitboxbasestatus.StatusInitialized)
		return replySuccess.Success, err
	default:
		return true, nil
	}
}

// GetHostname returns the hostname of the bitboxbase
func (base *BitBoxBase) GetHostname() (hostname string, err error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return "", err
	}
	base.log.Println("bitboxbase is making a GetHostname call")
	reply, err := base.rpcClient.GetHostname()
	if err != nil {
		return "", err
	}
	if !reply.Success {
		err := errp.Newf("GetHostname was not successful. Message: %s. Code: %s", reply.Message, reply.Code)
		return "", err
	}
	return reply.Hostname, nil
}

// SetHostname sets the hostname of the bitboxbase
func (base *BitBoxBase) SetHostname(hostname string) (success bool, err error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return false, err
	}
	base.log.Println("bitboxbase is making a SetHostname call")
	args := rpcmessages.SetHostnameArgs{Hostname: hostname}
	reply, err := base.rpcClient.SetHostname(args)
	if err != nil {
		return false, err
	}
	if !reply.Success {
		err := errp.Newf("SetHostname was not successful. Message: %s. Code: %s", reply.Message, reply.Code)
		return false, err
	}
	return true, nil
}

// UserAuthenticate returns if a given Username and Password are valid
// TODO: This is a dummy.
func (base *BitBoxBase) UserAuthenticate(username string, password string) (success bool, err error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return false, err
	}
	base.log.Println("bitboxbase is making a UserAuthenticate call")
	args := rpcmessages.UserAuthenticateArgs{Username: username, Password: password}
	reply, err := base.rpcClient.UserAuthenticate(args)
	if err != nil {
		return false, err
	}
	if !reply.Success {
		err := errp.Newf("UserAuthenticate was not successful. Message: %s. Code: %s", reply.Message, reply.Code)
		return false, err
	}
	return true, nil
}

// UserChangePassword returns if the password change for a username was successful
// TODO: This is a dummy.
func (base *BitBoxBase) UserChangePassword(username string, newPassword string) (success bool, err error) {
	if !base.active {
		err := errp.New("Attempted a call to non-active base")
		return false, err
	}
	base.log.Println("bitboxbase is making a UserChangePassword call")
	args := rpcmessages.UserChangePasswordArgs{Username: username, NewPassword: newPassword}
	reply, err := base.rpcClient.UserChangePassword(args)
	if err != nil {
		return false, err
	}
	if !reply.Success {
		err := errp.Newf("UserChangePassword was not successful. Message: %s. Code: %s", reply.Message, reply.Code)
		return false, err
	}
	return true, nil
}

// Identifier implements a getter for the bitboxBase ID
func (base *BitBoxBase) Identifier() string {
	return base.bitboxBaseID
}

// GetRegisterTime implements a getter for the timestamp of when the bitbox base was registered
func (base *BitBoxBase) GetRegisterTime() time.Time {
	return base.registerTime
}

// isTestnet returns a boolean that is true when connected to a base serving testnet and false otherwise
func (base *BitBoxBase) isTestnet() bool {
	return base.network == "testnet"
}

// Close implements a method to unset the bitboxBase
func (base *BitBoxBase) Close() {
	base.rpcClient.Stop()
}

// Ping sends a get requset to the bitbox base middleware root handler and returns true if successful
func (base *BitBoxBase) Ping() (bool, error) {
	return base.rpcClient.Ping()
}
