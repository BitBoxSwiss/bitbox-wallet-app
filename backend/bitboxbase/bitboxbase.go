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
	"encoding/json"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/updater"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// Interface represents bitbox base.
type Interface interface {
	Init(testing bool)

	// Identifier returns the bitboxBaseID.
	Identifier() string

	// GetUpdater returns the updater so we can listen to its events.
	GetUpdaterInstance() *updater.Updater

	// Close tells the bitboxbase to close all connections.
	Close()

	// GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
	GetRegisterTime() time.Time

	// BlockInfo returns some blockchain information.
	BlockInfo() string

	// ConnectElectrum connects to the electrs server on the base and configures the backend accordingly
	ConnectElectrum() error
}

// BitBoxBase provides the dictated bitboxbase api to communicate with the base
type BitBoxBase struct {
	bitboxBaseID    string //This is just the ip at the moment, but will be an actual unique string, once the noise pairing is implemented
	registerTime    time.Time
	address         string
	closed          bool
	updaterInstance *updater.Updater
	electrsRPCPort  string
	network         string
	log             *logrus.Entry
	config          *config.Config
}

// NewBitBoxBase creates a new bitboxBase instance
func NewBitBoxBase(address string, id string, config *config.Config) (*BitBoxBase, error) {
	bitboxBase := &BitBoxBase{
		log:             logging.Get().WithGroup("bitboxbase"),
		bitboxBaseID:    id,
		closed:          false,
		address:         strings.Split(address, ":")[0],
		updaterInstance: updater.NewUpdater(address),
		registerTime:    time.Now(),
		config:          config,
	}
	err := bitboxBase.GetUpdaterInstance().Connect(address, bitboxBase.bitboxBaseID)
	if err != nil {
		return nil, err
	}

	bodyBytes, err := bitboxBase.GetUpdaterInstance().GetEnv()
	if err != nil {
		return nil, err
	}
	var envData map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &envData); err != nil {
		bitboxBase.log.WithError(err).Error(" Failed to unmarshal GetEnv body bytes")
		// bitboxBase.GetUpdaterInstance().Stop()
		return bitboxBase, err
	}
	var ok bool
	bitboxBase.electrsRPCPort, ok = envData["electrsRPCPort"].(string)
	if !ok {
		bitboxBase.log.Error(" Getenv did not return an electrsRPCPort string field")
		return bitboxBase, err
	}
	bitboxBase.network, ok = envData["network"].(string)
	if !ok {
		bitboxBase.log.Error(" Getenv did not return a network string field")
		return bitboxBase, err
	}
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

// GetUpdaterInstance return ths current instance of the updater
func (base *BitBoxBase) GetUpdaterInstance() *updater.Updater {
	return base.updaterInstance
}

// BlockInfo returns the received blockinfo packet from the updater
func (base *BitBoxBase) BlockInfo() string {
	return base.GetUpdaterInstance().BlockInfo()
}

// Identifier implements a getter for the bitboxBase ID
func (base *BitBoxBase) Identifier() string {
	return base.bitboxBaseID
}

// GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
func (base *BitBoxBase) GetRegisterTime() time.Time {
	return base.registerTime
}

// isTestnet returns a boolean that is true when connected to a base serving testnet and false otherwise
func (base *BitBoxBase) isTestnet() bool {
	return base.network == "testnet"
}

// Close implements a method to unset the bitboxBase
func (base *BitBoxBase) Close() {
	base.GetUpdaterInstance().Stop()
	base.closed = true
}

// Init initializes the bitboxBase
func (base *BitBoxBase) Init(testing bool) {
}
