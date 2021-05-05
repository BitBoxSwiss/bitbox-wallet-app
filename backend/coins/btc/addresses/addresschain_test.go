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

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var tx1 = &blockchain.TxInfo{
	Height: 10,
	TXHash: blockchain.TXHash(chainhash.HashH([]byte("tx1"))),
	Fee:    nil,
}

type addressChainTestSuite struct {
	suite.Suite
	addresses  *addresses.AddressChain
	xpub       *hdkeychain.ExtendedKey
	gapLimit   int
	chainIndex uint32
	log        *logrus.Entry
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
		signing.NewConfiguration(signing.ScriptTypeP2PKH, signing.NewEmptyAbsoluteKeypath(), xpub),
		net, s.gapLimit, s.chainIndex, s.log)
}

func TestAddressChainTestSuite(t *testing.T) {
	suite.Run(t, &addressChainTestSuite{})
}

func (s *addressChainTestSuite) TestGetUnused() {
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })
	newAddresses := s.addresses.EnsureAddresses()
	// Gives the same addresses until the address history is changed.
	for i := 0; i < 3; i++ {
		require.Equal(s.T(), newAddresses[:s.gapLimit], s.addresses.GetUnused())
	}
	newAddresses[0].HistoryStatus = blockchain.TxHistory{tx1}.Status()
	// Need to call EnsureAddresses because the status of an address changed.
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })
	_ = s.addresses.EnsureAddresses()
	require.NotEqual(s.T(), newAddresses[0], s.addresses.GetUnused()[0])
	require.Equal(s.T(), newAddresses[1], s.addresses.GetUnused()[0])
}

func (s *addressChainTestSuite) TestLookupByScriptHashHex() {
	newAddresses := s.addresses.EnsureAddresses()
	for _, address := range newAddresses {
		require.Equal(s.T(), address,
			s.addresses.LookupByScriptHashHex(address.PubkeyScriptHashHex()))
	}
	// Produce addresses beyond  the gapLimit to ensure the gapLimit does not confuse Contains().
	newAddresses[0].HistoryStatus = blockchain.TxHistory{tx1}.Status()
	newAddresses = s.addresses.EnsureAddresses()
	require.Len(s.T(), newAddresses, 1)
	require.Equal(s.T(),
		newAddresses[0], s.addresses.LookupByScriptHashHex(newAddresses[0].PubkeyScriptHashHex()))
	require.Nil(s.T(), s.addresses.LookupByScriptHashHex(test.GetAddress(signing.ScriptTypeP2PKH).PubkeyScriptHashHex()))
}

func (s *addressChainTestSuite) TestEnsureAddresses() {
	// No addresses in the beginning.
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })

	newAddresses := s.addresses.EnsureAddresses()
	require.Len(s.T(), newAddresses, s.gapLimit)
	// Check that the pubkeys behind the new addresses are derived in sequence from the root xpub.
	getPubKey := func(index int) *btcec.PublicKey {
		chain, err := s.xpub.Child(s.chainIndex)
		if err != nil {
			panic(err)
		}
		childXPub, err := chain.Child(uint32(index))
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
		require.Equal(s.T(), getPubKey(index), address.Configuration.PublicKey())
	}
	// Address statuses are still the same, so calling it again won't produce more addresses.
	require.Empty(s.T(), s.addresses.EnsureAddresses())

	newAddresses[s.gapLimit-1].HistoryStatus = "used"
	require.Len(s.T(), s.addresses.EnsureAddresses(), s.gapLimit)
}
