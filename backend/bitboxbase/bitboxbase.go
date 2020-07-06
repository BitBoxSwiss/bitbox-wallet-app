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

// Package bitboxbase contains the API to the physical device.
package bitboxbase

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/bbbconfig"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcclient"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	appConfig "github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"

	"github.com/sirupsen/logrus"
)

// DisconnectType indicates the type of disconnect that should be passed to Disconnect() to determine if we set the Base
// status to 'offline' or 'reconnecting' which determines subsequent behavior of the backend.
type DisconnectType int

// DisconnectType currently has three possibilities: reboot, shutdown and disconnect.
// DisconnectTypeReboot changes status to StatusReconnecting to tell the backend to attempt to reconnect.
// DisconnectTypeShutdown changes status StatusOffline.
// DisconnectTypeDisconnect changes status StatusDisconnected to indicate that the Base is online, but not connected to
// the App backend.
const (
	DisconnectTypeReboot     DisconnectType = 0
	DisconnectTypeShutdown   DisconnectType = 1
	DisconnectTypeDisconnect DisconnectType = 2
)

// BitBoxBase provides the dictated bitboxbase api to communicate with the base.
type BitBoxBase struct {
	observable.Implementation

	bitboxBaseID   string // this is just the ip currently
	registerTime   time.Time
	address        string
	port           string
	hostname       string
	rpcClient      *rpcclient.RPCClient
	electrsRPCPort string
	network        string
	log            *logrus.Entry
	appConfig      *appConfig.Config
	bbbConfig      *bbbconfig.BBBConfig
	status         bitboxbasestatus.Status
	active         bool // this indicates if the bitboxbase is in use, or being disconnected

	onUnregister  func(string)
	onRemove      func(string)
	onReconnected func(string)
	socksProxy    socksproxy.SocksProxy
}

// NewBitBoxBase creates a new bitboxBase instance.
func NewBitBoxBase(address string,
	id string,
	hostname string,
	appConfig *appConfig.Config,
	bbbConfig *bbbconfig.BBBConfig,
	onUnregister func(string),
	onRemove func(string),
	onReconnected func(string),
	socksProxy socksproxy.SocksProxy) (*BitBoxBase, error) {
	bitboxBase := &BitBoxBase{
		log:           logging.Get().WithGroup("bitboxbase"),
		bitboxBaseID:  id,
		address:       strings.Split(address, ":")[0],
		port:          strings.Split(address, ":")[1],
		hostname:      hostname,
		registerTime:  time.Now(),
		appConfig:     appConfig,
		bbbConfig:     bbbConfig,
		status:        bitboxbasestatus.StatusConnected,
		onUnregister:  onUnregister,
		onRemove:      onRemove,
		onReconnected: onReconnected,
		active:        false,
		socksProxy:    socksProxy,
	}
	rpcClient, err := rpcclient.NewRPCClient(
		address, bbbConfig, bitboxBase.changeStatus, bitboxBase.fireEvent, bitboxBase.Ping)
	bitboxBase.rpcClient = rpcClient

	return bitboxBase, err
}

// EstablishConnection establishes initial websocket connection with the middleware.
func (base *BitBoxBase) EstablishConnection() error {
	if err := base.rpcClient.EstablishConnection(); err != nil {
		return err
	}
	return nil
}

// ConnectRPCClient starts the connection with the remote bitbox base middleware.
func (base *BitBoxBase) ConnectRPCClient() error {
	if err := base.rpcClient.Connect(); err != nil {
		fmt.Println("Removing")
		base.Remove()
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

// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly.
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
		&config.ServerInfo{Server: electrumAddress, TLS: true, PEMCert: electrumCert},
		base.log,
		base.socksProxy.GetTCPProxyDialer()); err != nil {
		base.log.WithField("ElectrumIP: ", electrumAddress).Error(err.Error())
		return err
	}

	base.log.WithField("ElectrumAddress:", electrumAddress).Debug("Setting config to base electrum Server...")

	// BaseBtcConfig sets the TBTC configs to the provided cert and ip.
	if base.isTestnet() {
		base.appConfig.SetTBTCElectrumServers(electrumAddress, electrumCert)
	} else {
		base.appConfig.SetBTCElectrumServers(electrumAddress, electrumCert)
	}
	// Disable Litecoin and Ethereum accounts - we do not want any more traffic hitting other servers
	base.appConfig.SetBtcOnly()

	if err := base.appConfig.SetAppConfig(base.appConfig.AppConfig()); err != nil {
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
	if err := base.bbbConfig.RemoveRegisteredBase(base.bitboxBaseID); err != nil {
		base.log.WithError(err).Error("Unable to remove BitBoxBase from config file")
	}
	base.active = false
	return nil
}

// Remove calls the backend's BitBoxBaseRemove callback and sends a notification to the frontend.
// Remove should only be used in the case the Base has not been fully connected,
// i.e. if the noise pairing wasn't completed and so the RPC connection not established.
func (base *BitBoxBase) Remove() {
	base.fireEvent("disconnect")
	base.onRemove(base.bitboxBaseID)
	if err := base.bbbConfig.RemoveRegisteredBase(base.bitboxBaseID); err != nil {
		base.log.WithError(err).Error("Unable to remove BitBoxBase from config file")
	}
	base.active = false
}

// Disconnect changes the Base status and takes appropriate action based on DisconnectType.
func (base *BitBoxBase) Disconnect(disconnectType DisconnectType) error {
	if !base.active {
		return errp.New("Attempted call to non-active base")
	}
	base.Close()
	base.rpcClient = nil
	base.active = false
	switch disconnectType {
	case DisconnectTypeReboot:
		base.log.Println("BitBoxBase if rebooting. Will attempt to reconnect automatically.")
		base.changeStatus(bitboxbasestatus.StatusReconnecting)
		go base.attemptReconnectLoop()
	case DisconnectTypeShutdown:
		base.log.Println("BitBoxBase is shutting down, setting status to 'offline'")
		base.changeStatus(bitboxbasestatus.StatusOffline)
	case DisconnectTypeDisconnect:
		base.log.Println("App is disconnecting from BitBoxBase, setting status to 'disconnected'")
		base.changeStatus(bitboxbasestatus.StatusDisconnected)
	}
	return nil
}

// ChannelHash returns the bitboxbase's rpcClient noise channel hash.
func (base *BitBoxBase) ChannelHash() (string, bool) {
	return base.rpcClient.ChannelHash()
}

// Status returns the current state of the bitboxbase.
func (base *BitBoxBase) Status() bitboxbasestatus.Status {
	return base.status
}

// fireEvent notifies the frontend of an event in the bitboxbase.
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

// RPCClient returns ths current instance of the rpcClient.
func (base *BitBoxBase) RPCClient() *rpcclient.RPCClient {
	return base.rpcClient
}

// ReindexBitcoin returns true if the chosen sync option was executed successfully.
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

// ResyncBitcoin returns true if the chosen sync option was executed successfully.
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

// SetHostname sets the hostname of the physical BitBoxBase device.
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

// SetLocalHostname sets hostname field in the BitBoxBase struct.
// This is necessary for example when restoring Bases from persisted config file
// when we don't yet have access to authenticated BaseInfo() RPC.
func (base *BitBoxBase) SetLocalHostname(hostname string) {
	base.hostname = hostname
}

// GetLocalHostname gets the hostname from the hostname field in the BitBoxBase struct.
// Necessary for the same reasons as setLocalHostname.
func (base *BitBoxBase) GetLocalHostname() string {
	return base.hostname
}

// UserAuthenticate returns if a given Username and Password are valid.
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
	base.fireEvent(bitboxbasestatus.EventUserAuthenticated)
	return nil
}

// UserChangePassword returns if the password change for a username was successful.
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

// BackupSysconfig backs up the system config to the flashdrive.
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
	return nil
}

// BackupHSMSecret backs up the lightning hsm_secret.
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

// RestoreHSMSecret restores the lightning hsm_secret.
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

// RestoreSysconfig restores the system config from the flashdrive.
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

// EnableTor enables/disables Tor with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableTorMiddleware enables/disables Tor for the middleware with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableTorElectrs enables/disables Tor for electrs with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableTorSSH enables/disables Tor for SSH with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableClearnetIBD configures bitcoind to run over clearnet while in IBD with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableRootLogin enables/disables login via the root user/password with rpcmessages.ToggleSettingArgs Enable/Disable.
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

// EnableSSHPasswordLogin enables/disables the ssh login with a password.
func (base *BitBoxBase) EnableSSHPasswordLogin(toggleAction rpcmessages.ToggleSettingArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}

	base.log.Printf("bitboxbase is making a 'set EnableSSHPasswordLogin: %t' call\n", toggleAction.ToggleSetting)
	reply, err := base.rpcClient.EnableSSHPasswordLogin(toggleAction)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// SetLoginPassword sets the systems root password.
func (base *BitBoxBase) SetLoginPassword(password string) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a SetRootPassword call")
	reply, err := base.rpcClient.SetLoginPassword(rpcmessages.SetLoginPasswordArgs{LoginPassword: password})
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	return nil
}

// ShutdownBase initiates a `shutdown now` call via the bbb-cmd.sh script.
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
	err = base.Disconnect(DisconnectTypeShutdown)
	if err != nil {
		return err
	}
	return nil
}

// RebootBase initiates a `reboot` call via the bbb-cmd.sh script.
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
	err = base.Disconnect(DisconnectTypeReboot)
	if err != nil {
		return err
	}
	return nil
}

// UpdateBase calls the UpdateBase RPC which performs a update of the Base.
func (base *BitBoxBase) UpdateBase(args rpcmessages.UpdateBaseArgs) error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a UpdateBase call")
	reply, err := base.rpcClient.UpdateBase(args)
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	err = base.Disconnect(DisconnectTypeReboot)
	if err != nil {
		return err
	}
	return nil
}

// BaseInfo returns info about the Base contained in rpcmessages.GetBaseInfoResponse.
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
	base.hostname = reply.Hostname
	err = base.bbbConfig.UpdateRegisteredBaseHostname(base.bitboxBaseID, reply.Hostname)
	if err != nil {
		base.log.WithError(err).Error("Unable to update BitBoxBase config file")
	}
	return reply, nil
}

// ServiceInfo returns info about the Base contained in rpcmessages.GetServiceInfoResponse.
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

// BaseUpdateProgress returns the Base update progress.
func (base *BitBoxBase) BaseUpdateProgress() (rpcmessages.GetBaseUpdateProgressResponse, error) {
	if !base.active {
		return rpcmessages.GetBaseUpdateProgressResponse{}, errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a GetBaseUpdateProgress call")
	reply, err := base.rpcClient.GetBaseUpdateProgress()
	if err != nil {
		return rpcmessages.GetBaseUpdateProgressResponse{}, err
	}
	return reply, nil
}

// UpdateInfo returns whether an update is available, and if so, version, description and severity information.
func (base *BitBoxBase) UpdateInfo() (rpcmessages.IsBaseUpdateAvailableResponse, error) {
	if !base.active {
		return rpcmessages.IsBaseUpdateAvailableResponse{}, errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making an UpdateInfo call")
	reply, err := base.rpcClient.GetBaseUpdateInfo()
	if err != nil {
		return rpcmessages.IsBaseUpdateAvailableResponse{}, err
	}
	if !reply.ErrorResponse.Success {
		return rpcmessages.IsBaseUpdateAvailableResponse{}, reply.ErrorResponse
	}
	return reply, nil
}

// FinalizeSetupWizard calls the FinalizeSetupWizard RPC to enable bitcoin and start bitcoin services.
func (base *BitBoxBase) FinalizeSetupWizard() error {
	if !base.active {
		return errp.New("Attempted a call to non-active base")
	}
	base.log.Println("bitboxbase is making a FinalizeSetupWizard call")
	reply, err := base.rpcClient.FinalizeSetupWizard()
	if err != nil {
		return err
	}
	if !reply.Success {
		return &reply
	}
	base.changeStatus(bitboxbasestatus.StatusInitialized)
	return nil
}

// Identifier implements a getter for the bitboxBase ID.
func (base *BitBoxBase) Identifier() string {
	return base.bitboxBaseID
}

// Config returns the Base's configuration.
func (base *BitBoxBase) Config() *bbbconfig.BBBConfig {
	return base.bbbConfig
}

// GetRegisterTime implements a getter for the timestamp of when the bitbox base was registered.
func (base *BitBoxBase) GetRegisterTime() time.Time {
	return base.registerTime
}

// isTestnet returns a boolean that is true when connected to a base serving testnet and false otherwise.
func (base *BitBoxBase) isTestnet() bool {
	return base.network == "testnet"
}

// Close implements a method to unset the bitboxBase.
func (base *BitBoxBase) Close() {
	base.rpcClient.Stop()
}

// Ping sends a get request to the BitBoxBase middleware root handler and returns true if successful.
func (base *BitBoxBase) Ping() (bool, error) {
	response, err := http.Get("http://" + base.address + ":" + base.port + "/")
	if err != nil {
		base.log.WithError(err).Error("No response from middleware at: ", base.address)
		return false, err
	}

	if response.StatusCode != http.StatusOK {
		base.log.Error("Received http status code from middleware other than 200")
		return false, nil
	}
	return true, nil
}

// attemptReconnectLoop attempts to reconnect to a rebooting base.
func (base *BitBoxBase) attemptReconnectLoop() {
	time.Sleep(15 * time.Second) // wait for Base to shut down before attempting to reconnect
	for {
		reply, err := base.Ping()
		if err != nil {
			base.log.Printf("Attempting to reconnect to BitBoxBase at %s. Middleware is not yet reachable.\n", base.address)
		}
		if reply {
			rpcClient, err := rpcclient.NewRPCClient(
				base.address+":"+base.port, base.bbbConfig, base.changeStatus, base.fireEvent, base.Ping)
			if err != nil {
				base.log.Println("Failed to create newRPCClient: ", err)
			}
			base.rpcClient = rpcClient
			err = base.EstablishConnection()
			if err != nil {
				base.log.Println("Could not re-establish connection: ", err)
			}
			err = base.ConnectRPCClient()
			if err != nil {
				base.log.Println("Could not re-establish noise encrypted RPC connection: ", err)
			}
			base.active = true
			base.onReconnected(base.bitboxBaseID)
			base.changeStatus(bitboxbasestatus.StatusLocked)
			base.log.Printf("Reconnected successfully to %s\n", base.address)
			break
		}
		time.Sleep(5 * time.Second)
	}
}
