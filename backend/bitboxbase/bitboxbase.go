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
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"

	"github.com/sirupsen/logrus"
)

// Interface represents bitbox base.
type Interface interface {
	observable.Interface

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

	// Status returns the current status of the base
	Status() bitboxbasestatus.Status

	// ChannelHash returns the hash of the noise channel
	ChannelHash() (string, bool)

	// Deregister calls the backend's BitBoxBase Deregister callback and sends a notification to the frontend, if bitboxbase is active.
	// If bitboxbase is not active, an error is returned.
	Deregister() error

	// ReindexBitcoin starts a bitcoin reindex on the base.
	ReindexBitcoin() error

	// ResyncBitcoin starts a bitcoin resync on the base.
	ResyncBitcoin() error

	// SetHostname sets the hostname of the BitBox Base
	SetHostname(string) error

	// UserChangePassword sets a new password for a given user
	UserChangePassword(string, string, string) error

	// UserAuthenticate returns is the authentication with a username and password was successful
	UserAuthenticate(string, string) error

	// BackupSysconfig backs up the system config to the flashdrive
	BackupSysconfig() error

	// BackupHSMSecret backs up the lightning hsm_secret
	BackupHSMSecret() error

	// RestoreSysconfig restores the system config from the flashdrive
	RestoreSysconfig() error

	// RestoreHSMSecret restores the lightning hsm_secret
	RestoreHSMSecret() error

	// EnableTor enables/disables Tor
	EnableTor(rpcmessages.ToggleSettingArgs) error

	// EnableTorMiddleware enables/disables Tor for the middleware
	EnableTorMiddleware(rpcmessages.ToggleSettingArgs) error

	// EnableTorElectrs enables/disables Tor for electrs
	EnableTorElectrs(rpcmessages.ToggleSettingArgs) error

	// EnableTorSSH enables/disables Tor for SSH
	EnableTorSSH(rpcmessages.ToggleSettingArgs) error

	// EnableClearnetIBD configures bitcoind to run over clearnet while in IBD
	EnableClearnetIBD(rpcmessages.ToggleSettingArgs) error

	// EnableRootLogin enables/disables login via the root user/password
	EnableRootLogin(rpcmessages.ToggleSettingArgs) error

	// SetRootPassword sets the systems root password
	SetRootPassword(string) error

	// ShutdownBase initiates a `shutdown now` call via the bbb-cmd.sh script
	ShutdownBase() error

	// RebootBase initiates a `reboot` call via the bbb-cmd.sh script
	RebootBase() error

	// BaseInfo returns information about the Base
	BaseInfo() (rpcmessages.GetBaseInfoResponse, error)

	// ServiceInfo returns information about the services running on the Base
	// As for example the bitcoind, electrs and ligthningd block height
	ServiceInfo() (rpcmessages.GetServiceInfoResponse, error)
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
	socksProxy   socksproxy.SocksProxy
}

//NewBitBoxBase creates a new bitboxBase instance
func NewBitBoxBase(address string,
	id string,
	config *config.Config,
	bitboxBaseConfigDir string,
	onUnregister func(string),
	socksProxy socksproxy.SocksProxy) (*BitBoxBase, error) {
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
		socksProxy:          socksProxy,
	}
	rpcClient, err := rpcclient.NewRPCClient(address, bitboxBaseConfigDir, bitboxBase.changeStatus, bitboxBase.fireEvent, bitboxBase.Deregister)
	bitboxBase.rpcClient = rpcClient

	return bitboxBase, err
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

	electrumCert, err := electrum.DownloadCert(electrumAddress, base.socksProxy)
	if err != nil {
		base.log.WithField("ElectrumIP: ", electrumAddress).Error(err.Error())
		return err
	}

	if err := electrum.CheckElectrumServer(
		electrumAddress,
		electrumCert,
		base.log,
		base.socksProxy); err != nil {
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
func (base *BitBoxBase) Deregister() error {
	if !base.active {
		return errp.New("Attempted call to non-active base")
	}
	// let the frontend know that the base is disconnected
	base.fireEvent("disconnect")
	base.onUnregister(base.bitboxBaseID)
	base.active = false
	return nil
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
		return rpcmessages.SampleInfoResponse{}, errp.New("Attempted a call to non-active base")
	}
	return base.rpcClient.GetSampleInfo()
}

// VerificationProgress returns the received VerificationProgress packet from the rpcClient
func (base *BitBoxBase) VerificationProgress() (rpcmessages.VerificationProgressResponse, error) {
	if !base.active {
		return rpcmessages.VerificationProgressResponse{}, errp.New("Attempted a call to non-active base")
	}
	return base.rpcClient.GetVerificationProgress()
}

// ReindexBitcoin returns true if the chosen sync option was executed successfully
func (base *BitBoxBase) ReindexBitcoin() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a ReindexBitcoin call")
	reply, err := base.rpcClient.ReindexBitcoin()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// ResyncBitcoin returns true if the chosen sync option was executed successfully
func (base *BitBoxBase) ResyncBitcoin() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a ResyncBitcoin call")
	reply, err := base.rpcClient.ResyncBitcoin()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// SetHostname sets the hostname of the bitboxbase
func (base *BitBoxBase) SetHostname(hostname string) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a SetHostname call")
	args := rpcmessages.SetHostnameArgs{Hostname: hostname}
	reply, err := base.rpcClient.SetHostname(args)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// UserAuthenticate returns if a given Username and Password are valid
func (base *BitBoxBase) UserAuthenticate(username string, password string) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a UserAuthenticate call")
	args := rpcmessages.UserAuthenticateArgs{Username: username, Password: password}
	reply, err := base.rpcClient.UserAuthenticate(args)
	if err != nil {
		return err
	}
	if !reply.ErrorResponse.Success {
		return reply.ErrorResponse
	}
	setupStatus, err := base.rpcClient.GetSetupStatus()
	if err != nil {
		return err
	}
	if !setupStatus.BaseSetup {
		base.changeStatus(bitboxbasestatus.StatusBitcoinPre)
	} else {
		base.changeStatus(bitboxbasestatus.StatusInitialized)
	}
	return nil
}

// UserChangePassword returns if the password change for a username was successful
func (base *BitBoxBase) UserChangePassword(username string, password, newPassword string) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a UserChangePassword call")
	args := rpcmessages.UserChangePasswordArgs{Username: username, Password: password, NewPassword: newPassword}
	reply, err := base.rpcClient.UserChangePassword(args)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	// check if the base is getting setup, or not
	setupStatus, err := base.rpcClient.GetSetupStatus()
	if err != nil {
		return err
	}
	if !setupStatus.BaseSetup {
		base.changeStatus(bitboxbasestatus.StatusBitcoinPre)
	} else {
		base.changeStatus(bitboxbasestatus.StatusInitialized)
	}
	return nil
}

// BackupSysconfig backs up the system config to the flashdrive
func (base *BitBoxBase) BackupSysconfig() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a BackupSysconfig call")
	reply, err := base.rpcClient.BackupSysconfig()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	base.changeStatus(bitboxbasestatus.StatusInitialized)
	return nil
}

// BackupHSMSecret backs up the lightning hsm_secret
func (base *BitBoxBase) BackupHSMSecret() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a BackupHSMSecret call")
	reply, err := base.rpcClient.BackupHSMSecret()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// RestoreHSMSecret restores the lightning hsm_secret
func (base *BitBoxBase) RestoreHSMSecret() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a RestoreHSMSecret call")
	reply, err := base.rpcClient.RestoreHSMSecret()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// RestoreSysconfig restores the system config from the flashdrive
func (base *BitBoxBase) RestoreSysconfig() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a RestoreSysconfig call")
	reply, err := base.rpcClient.RestoreSysconfig()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableTor enables/disables Tor with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableTor(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Printf("bitboxbase is making a 'set EnableTor: %t' call\n", toggleAction.ToggleSetting)

	reply, err := base.rpcClient.EnableTor(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableTorMiddleware enables/disables Tor for the middleware with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableTorMiddleware(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableTorMiddleware: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableTorMiddleware(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableTorElectrs enables/disables Tor for electrs with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableTorElectrs(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableTorElectrs: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableTorElectrs(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableTorSSH enables/disables Tor for SSH with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableTorSSH(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableTorSSH for SSH: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableTorSSH(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableClearnetIBD configures bitcoind to run over clearnet while in IBD with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableClearnetIBD(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableClearnetIBD: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableClearnetIBD(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// EnableRootLogin enables/disables login via the root user/password with rpcmessages.ToggleSettingArgs Enable/Disable
func (base *BitBoxBase) EnableRootLogin(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableRootLogin: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableRootLogin(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// SetRootPassword sets the systems root password
func (base *BitBoxBase) SetRootPassword(password string) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a SetRootPassword call")
	reply, err := base.rpcClient.SetRootPassword(rpcmessages.SetRootPasswordArgs{RootPassword: password})
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// ShutdownBase initiates a `shutdown now` call via the bbb-cmd.sh script
func (base *BitBoxBase) ShutdownBase() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a ShutdownBase call")
	reply, err := base.rpcClient.ShutdownBase()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// RebootBase initiates a `reboot` call via the bbb-cmd.sh script
func (base *BitBoxBase) RebootBase() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a RebootBase call")
	reply, err := base.rpcClient.RebootBase()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// BaseInfo returns info about the Base contained in rpcmessages.GetBaseInfoResponse
func (base *BitBoxBase) BaseInfo() (rpcmessages.GetBaseInfoResponse, error) {
	if !base.active {
		return rpcmessages.GetBaseInfoResponse{}, errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a GetBaseInfo call")
	reply, err := base.rpcClient.GetBaseInfo()
	if err != nil {
		return rpcmessages.GetBaseInfoResponse{}, err
	}
	if !reply.ErrorResponse.Success {
		return rpcmessages.GetBaseInfoResponse{}, reply.ErrorResponse
	}
	return reply, nil
}

// ServiceInfo returns info about the Base contained in rpcmessages.GetServiceInfoResponse
func (base *BitBoxBase) ServiceInfo() (rpcmessages.GetServiceInfoResponse, error) {
	if !base.active {
		return rpcmessages.GetServiceInfoResponse{}, errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a GetServiceInfo call")
	reply, err := base.rpcClient.GetServiceInfo()
	if err != nil {
		return rpcmessages.GetServiceInfoResponse{}, err
	}
	if !reply.ErrorResponse.Success {
		return rpcmessages.GetServiceInfoResponse{}, reply.ErrorResponse
	}
	return reply, nil
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
