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

// AddressChain manages a chain of addresses derived from a configuration.
type AddressChain struct {
	accountConfiguration *signing.Configuration
	net                  *chaincfg.Params
	gapLimit             int
	chainIndex           uint32
	addresses            []*AccountAddress
	log                  *logrus.Entry
}

// NewAddressChain creates an address chain starting at m/<chainIndex> from the given configuration.
func NewAddressChain(
	accountConfiguration *signing.Configuration,
	net *chaincfg.Params,
	gapLimit int,
	chainIndex uint32,
	log *logrus.Entry,
) *AddressChain {
	return &AddressChain{
		accountConfiguration: accountConfiguration,
		net:                  net,
		gapLimit:             gapLimit,
		chainIndex:           chainIndex,
		addresses:            []*AccountAddress{},
		log: log.WithFields(logrus.Fields{"group": "addresses", "net": net.Name,
			"gap-limit": gapLimit, "configuration": accountConfiguration.String()}),
	}
}

// GetUnused returns the last `gapLimit` unused addresses. EnsureAddresses() must be called
// beforehand.
func (addresses *AddressChain) GetUnused() []*AccountAddress {
	unusedTailCount := addresses.unusedTailCount()
	if unusedTailCount < addresses.gapLimit {
		addresses.log.Panic("Concurrency error: Addresses not synced correctly")
	}
	return addresses.addresses[len(addresses.addresses)-unusedTailCount:]
}

// addAddress appends a new address at the end of the chain.
func (addresses *AddressChain) addAddress() *AccountAddress {
	addresses.log.Debug("Add new address to chain")
	index := uint32(len(addresses.addresses))
	address := NewAccountAddress(
		addresses.accountConfiguration,
		signing.NewEmptyRelativeKeypath().Child(addresses.chainIndex, signing.NonHardened).Child(index, signing.NonHardened),
		addresses.net,
		addresses.log,
	)
	addresses.addresses = append(addresses.addresses, address)
	return address
}

// unusedTailCount returns the number of unused addresses at the end of the chain.
func (addresses *AddressChain) unusedTailCount() int {
	count := 0
	for i := len(addresses.addresses) - 1; i >= 0; i-- {
		if addresses.addresses[i].isUsed() {
			break
		}
		count++
	}
	addresses.log.WithField("tail-count", count).Debug("Unused tail count")
	return count
}

// LookupByScriptHashHex returns the address which matches the provided scriptHashHex. Returns nil
// if not found.
func (addresses *AddressChain) LookupByScriptHashHex(hashHex blockchain.ScriptHashHex) *AccountAddress {
	// todo: add map for constant time lookup
	for _, address := range addresses.addresses {
		if address.PubkeyScriptHashHex() == hashHex {
			return address
		}
	}
	return nil
}

// EnsureAddresses appends addresses to the address chain until there are `gapLimit` unused unused
// ones, and returns the new addresses.
func (addresses *AddressChain) EnsureAddresses() []*AccountAddress {
	addedAddresses := []*AccountAddress{}
	unusedAddressCount := addresses.unusedTailCount()
	for i := 0; i < addresses.gapLimit-unusedAddressCount; i++ {
		addedAddresses = append(addedAddresses, addresses.addAddress())
	}
	return addedAddresses
}
