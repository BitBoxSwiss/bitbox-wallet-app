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
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type addressChainTestSuite struct {
	suite.Suite
	addresses     *addresses.AddressChain
	xpub          *hdkeychain.ExtendedKey
	gapLimit      int
	chainIndex    uint32
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
	s.chainIndex = 1
	s.xpub = xpub
	s.addresses = addresses.NewAddressChain(
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2PKH, []byte{1, 2, 3, 4}, signing.NewEmptyAbsoluteKeypath(), xpub),
		net,
		s.gapLimit,
		s.chainIndex,
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
	require.Error(s.T(), err)
	newAddresses, err := s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	// Gives the same addresses until the address history is changed.
	for i := 0; i < 3; i++ {
		unusedAddress, err := s.addresses.GetUnused()
		require.NoError(s.T(), err)
		require.Equal(s.T(), newAddresses[:s.gapLimit], unusedAddress)
	}
	firstAddress := newAddresses[0]
	// Need to call EnsureAddresses because the status of an address changed (first address is used).
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == firstAddress
	}
	_, err = s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	unusedAddresses, err := s.addresses.GetUnused()
	require.NoError(s.T(), err)
	require.NotEqual(s.T(), newAddresses[0], unusedAddresses[0])
	require.Equal(s.T(), newAddresses[1], unusedAddresses[0])
}

func (s *addressChainTestSuite) TestLookupByScriptHashHex() {
	s.isAddressUsed = func(*addresses.AccountAddress) bool { return false }
	newAddresses, err := s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	for _, address := range newAddresses {
		require.Equal(s.T(), address,
			s.addresses.LookupByScriptHashHex(address.PubkeyScriptHashHex()))
	}
	firstAddress := newAddresses[0]
	// Produce addresses beyond the gapLimit to ensure the gapLimit does not confuse
	// LookupByScriptHashHex().
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == firstAddress
	}
	newAddresses, err = s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	require.Len(s.T(), newAddresses, 1)
	require.Equal(s.T(),
		newAddresses[0], s.addresses.LookupByScriptHashHex(newAddresses[0].PubkeyScriptHashHex()))
	require.Nil(s.T(), s.addresses.LookupByScriptHashHex(test.GetAddress(signing.ScriptTypeP2PKH).PubkeyScriptHashHex()))
}

func (s *addressChainTestSuite) TestEnsureAddresses() {
	// No addresses in the beginning.
	s.isAddressUsed = func(*addresses.AccountAddress) bool { return false }
	_, err := s.addresses.GetUnused()
	require.Error(s.T(), err)

	newAddresses, err := s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	require.Len(s.T(), newAddresses, s.gapLimit)
	// Check that the pubkeys behind the new addresses are derived in sequence from the root xpub.
	getPubKey := func(index int) *btcec.PublicKey {
		chain, err := s.xpub.Derive(s.chainIndex)
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
	require.Len(s.T(), newAddresses, s.gapLimit)
	for index, address := range newAddresses {
		require.Equal(s.T(), uint32(index), address.Configuration.AbsoluteKeypath().ToUInt32()[1])
		require.Equal(s.T(), getPubKey(index), address.Configuration.PublicKey())
	}
	// Address statuses are still the same, so calling it again won't produce more addresses.
	addrs, err := s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	require.Empty(s.T(), addrs)

	usedAddress := newAddresses[s.gapLimit-1]
	s.isAddressUsed = func(addr *addresses.AccountAddress) bool {
		return addr == usedAddress
	}
	moreAddresses, err := s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	require.Len(s.T(), moreAddresses, s.gapLimit)
	require.Equal(s.T(), uint32(s.gapLimit), moreAddresses[0].Configuration.AbsoluteKeypath().ToUInt32()[1])

	// Repeating it does not add more the unused addresses are the same.
	addrs, err = s.addresses.EnsureAddresses()
	require.NoError(s.T(), err)
	require.Len(s.T(), addrs, 0)
}
