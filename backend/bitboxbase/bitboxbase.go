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
	"io"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcclient"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum/client"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonrpc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/rpc"

	"github.com/sirupsen/logrus"
)

// Interface represents bitbox base.
type Interface interface {
	Init(testing bool)

	// Identifier returns the bitboxBaseID.
	Identifier() string

	// GetRPCClient returns the rpcClient so we can listen to its events.
	RPCClient() *rpcclient.RPCClient

	// Close tells the bitboxbase to close all connections.
	Close()

	// GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
	GetRegisterTime() time.Time

	// MiddlewareInfo returns some blockchain information.
	MiddlewareInfo() (rpcclient.SampleInfoResponse, error)

	// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly
	ConnectElectrum() error

	// Ping sends a get requset to the bitbox base middleware root handler and returns true if successful
	Ping() (bool, error)

	// MakeElectrumClient creates an Electrum client which talks to the base Electrum server.
	// The messages are going through the noise-encrypted channel.
	MakeElectrumClient() *client.ElectrumClient
}

// BitBoxBase provides the dictated bitboxbase api to communicate with the base
type BitBoxBase struct {
	bitboxBaseID        string //This is just the ip currently
	registerTime        time.Time
	address             string
	rpcClient           *rpcclient.RPCClient
	electrsRPCPort      string
	network             string
	log                 *logrus.Entry
	config              *config.Config
	bitboxBaseConfigDir string
}

type electrumBackend struct {
	conn io.ReadWriteCloser
}

func (eb *electrumBackend) EstablishConnection() (io.ReadWriteCloser, error) {
	return eb.conn, nil
}

func (eb *electrumBackend) ServerInfo() *rpc.ServerInfo {
	return &rpc.ServerInfo{
		Server: "base", // TODO: this is only used for logging, refactor
	}
}

//NewBitBoxBase creates a new bitboxBase instance
func NewBitBoxBase(address string, id string, config *config.Config, bitboxBaseConfigDir string, onUnregister func(string)) (*BitBoxBase, error) {
	bitboxBase := &BitBoxBase{
		log:                 logging.Get().WithGroup("bitboxbase"),
		bitboxBaseID:        id,
		address:             strings.Split(address, ":")[0],
		rpcClient:           rpcclient.NewRPCClient(address, bitboxBaseConfigDir, onUnregister, id),
		registerTime:        time.Now(),
		config:              config,
		bitboxBaseConfigDir: bitboxBaseConfigDir,
	}
	err := bitboxBase.rpcClient.Connect(bitboxBase.bitboxBaseID)
	if err != nil {
		return nil, err
	}

	response, err := bitboxBase.rpcClient.GetEnv()
	if err != nil {
		return nil, err
	}

	bitboxBase.network = response.Network
	bitboxBase.electrsRPCPort = response.ElectrsRPCPort
	return bitboxBase, err
}

// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly
func (base *BitBoxBase) ConnectElectrum() error {
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

// RPCClient returns ths current instance of the rpcClient
func (base *BitBoxBase) RPCClient() *rpcclient.RPCClient {
	return base.rpcClient
}

// MakeElectrumClient implements Interface.
func (base *BitBoxBase) MakeElectrumClient() *client.ElectrumClient {
	return client.NewElectrumClient(
		jsonrpc.NewRPCClient(
			[]rpc.Backend{
				&electrumBackend{conn: base.rpcClient.ElectrumConnection()},
			},
			func(error) {},
			base.log,
		),
		base.log)
}

// MiddlewareInfo returns the received MiddlewareInfo packet from the rpcClient
func (base *BitBoxBase) MiddlewareInfo() (rpcclient.SampleInfoResponse, error) {
	response, err := base.rpcClient.SampleInfo()
	if err != nil {
		// intercept error so the user is not confronted with weird rpc error message
		return response, errp.New("error received from sample info rpc call client")
	}
	return response, nil
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

// Init initializes the bitboxBase
func (base *BitBoxBase) Init(testing bool) {
}
