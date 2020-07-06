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

package addresses

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/sirupsen/logrus"
)

// SingleAddress manages a chain of addresses derived from a configuration.
type SingleAddress struct {
	accountConfiguration *signing.Configuration
	address              *AccountAddress
	net                  *chaincfg.Params
	log                  *logrus.Entry
}

// NewSingleAddress creates as single address starting at m/<chainIndex> from the given configuration.
func NewSingleAddress(
	accountConfiguration *signing.Configuration,
	net *chaincfg.Params,
	log *logrus.Entry,
) *SingleAddress {
	return &SingleAddress{
		accountConfiguration: accountConfiguration,
		address:              nil,
		net:                  net,
		log: log.WithFields(logrus.Fields{"group": "addresses", "net": net.Name,
			"configuration": accountConfiguration.String()}),
	}
}

// GetUnused returns the address.
func (addresses *SingleAddress) GetUnused() []*AccountAddress {
	if addresses.address == nil {
		addresses.log.Panic("Concurrency error: Address not synced correctly")
	}
	return []*AccountAddress{addresses.address}
}

// LookupByScriptHashHex returns the address which matches the provided scriptHashHex. Returns nil
// if not found.
func (addresses *SingleAddress) LookupByScriptHashHex(hashHex blockchain.ScriptHashHex) *AccountAddress {
	if addresses.address == nil || addresses.address.PubkeyScriptHashHex() != hashHex {
		return nil
	}
	return addresses.address
}

// EnsureAddresses returns the address.
func (addresses *SingleAddress) EnsureAddresses() []*AccountAddress {
	if addresses.address == nil {
		addresses.address = NewAccountAddress(
			addresses.accountConfiguration,
			signing.NewEmptyRelativeKeypath(),
			addresses.net,
			addresses.log,
		)
		return []*AccountAddress{addresses.address}
	}
	return nil

}
