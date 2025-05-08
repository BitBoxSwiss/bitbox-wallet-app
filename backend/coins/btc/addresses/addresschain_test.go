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

package addresses_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/suite"
)

type addressChainTestSuite struct {
	suite.Suite
	addresses     *addresses.AddressChain
	xpub          *hdkeychain.ExtendedKey
	gapLimit      int
	change        bool
	isAddressUsed func(*addresses.AccountAddress) bool
	log           *logrus.Entry
}

func (s *addressChainTestSuite) SetupTest() {
	s.log = logging.Get().WithGroup("addresses_test")
	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM" +
		"58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}
	s.gapLimit = 6
	s.change = true
	s.xpub = xpub
	s.addresses = addresses.NewAddressChain(
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2PKH, []byte{1, 2, 3, 4}, signing.NewEmptyAbsoluteKeypath(), xpub),
		net,
		s.gapLimit,
		s.change,
		func(address *addresses.AccountAddress) (bool, error) {
			return s.isAddressUsed(address), nil
		},
		s.log)
}

func TestAddressChainTestSuite(t *testing.T) {
	suite.Run(t, &addressChainTestSuite{})
}

func (s *addressChainTestSuite) TestGetUnused() {
	s.isAddressUsed = func(*addresses.AccountAddress) bool { return false }
	_, err := s.addresses.GetUnused()
	s.Require().Error(err)
	newAddresses, err := s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	// Gives the same addresses until the address history is changed.
	for i := 0; i < 3; i++ {
		unusedAddress, err := s.addresses.GetUnused()
		s.Require().NoError(err)
		s.Require().Equal(newAddresses[:s.gapLimit], unusedAddress)
	}
	firstAddress := newAddresses[0]
	// Need to call EnsureAddresses because the status of an address changed (first address is used).
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == firstAddress
	}
	_, err = s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	unusedAddresses, err := s.addresses.GetUnused()
	s.Require().NoError(err)
	s.Require().NotEqual(newAddresses[0], unusedAddresses[0])
	s.Require().Equal(newAddresses[1], unusedAddresses[0])
}

func (s *addressChainTestSuite) TestLookupByScriptHashHex() {
	s.isAddressUsed = func(*addresses.AccountAddress) bool { return false }
	newAddresses, err := s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	for _, address := range newAddresses {
		s.Require().Equal(address,
			s.addresses.LookupByScriptHashHex(address.PubkeyScriptHashHex()))
	}
	firstAddress := newAddresses[0]
	// Produce addresses beyond the gapLimit to ensure the gapLimit does not confuse
	// LookupByScriptHashHex().
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == firstAddress
	}
	newAddresses, err = s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	s.Require().Len(newAddresses, 1)
	s.Require().Equal(
		newAddresses[0], s.addresses.LookupByScriptHashHex(newAddresses[0].PubkeyScriptHashHex()))
	s.Require().Nil(s.addresses.LookupByScriptHashHex(test.GetAddress(signing.ScriptTypeP2PKH).PubkeyScriptHashHex()))
}

func (s *addressChainTestSuite) TestEnsureAddresses() {
	// No addresses in the beginning.
	s.isAddressUsed = func(*addresses.AccountAddress) bool { return false }
	_, err := s.addresses.GetUnused()
	s.Require().Error(err)

	newAddresses, err := s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	s.Require().Len(newAddresses, s.gapLimit)
	// Check that the pubkeys behind the new addresses are derived in sequence from the root xpub.
	getPubKey := func(index int) *btcec.PublicKey {
		chainIndex := uint32(0)
		if s.change {
			chainIndex = 1
		}
		chain, err := s.xpub.Derive(chainIndex)
		if err != nil {
			panic(err)
		}
		childXPub, err := chain.Derive(uint32(index))
		if err != nil {
			panic(err)
		}
		publicKey, err := childXPub.ECPubKey()
		if err != nil {
			panic(err)
		}
		return publicKey
	}
	s.Require().Len(newAddresses, s.gapLimit)
	for index, address := range newAddresses {
		s.Require().Equal(uint32(index), address.Configuration.AbsoluteKeypath().ToUInt32()[1])
		s.Require().Equal(getPubKey(index), address.Configuration.PublicKey())
	}
	// Address statuses are still the same, so calling it again won't produce more addresses.
	addrs, err := s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	s.Require().Empty(addrs)

	usedAddress := newAddresses[s.gapLimit-1]
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == usedAddress
	}
	moreAddresses, err := s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	s.Require().Len(moreAddresses, s.gapLimit)
	s.Require().Equal(uint32(s.gapLimit), moreAddresses[0].Configuration.AbsoluteKeypath().ToUInt32()[1])

	// Repeating it does not add more the unused addresses are the same.
	addrs, err = s.addresses.EnsureAddresses()
	s.Require().NoError(err)
	s.Require().Empty(addrs)
}
