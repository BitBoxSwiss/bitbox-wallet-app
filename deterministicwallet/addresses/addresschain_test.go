package addresses_test

import (
	"testing"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestNewAddressChain(t *testing.T) {
	xprvSerialized := "xprv9s21ZrQH143K2UBLkdzwqFV6PXipLq4VWMAcJNPUGcWiGbvpjNPAjiiVaBddzafxkPBqxQoNcLWNh5RkPLdPThhsAzLkuHBBjfZdriiyqaZ"
	xprv, err := hdkeychain.NewKeyFromString(xprvSerialized)
	require.NoError(t, err)
	net := &chaincfg.TestNet3Params
	xprv.SetNet(net)

	// Can't pass a private key.
	require.Panics(t, func() { addresses.NewAddressChain(xprv, net, 6, 0) })

	// Can't pass with the wrong net.
	xpub, err := xprv.Neuter()
	require.NoError(t, err)
	xpub.SetNet(&chaincfg.MainNetParams)
	require.Panics(t, func() { addresses.NewAddressChain(xpub, net, 6, 0) })

	// Public and matching net.
	xpub.SetNet(net)
	addresses.NewAddressChain(xpub, net, 6, 0)
}

type addressChainTestSuite struct {
	suite.Suite
	addresses  *addresses.AddressChain
	xpub       *hdkeychain.ExtendedKey
	gapLimit   int
	chainIndex uint32
}

func (s *addressChainTestSuite) SetupTest() {
	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}
	net := &chaincfg.TestNet3Params
	s.gapLimit = 6
	s.chainIndex = 1
	s.xpub = xpub
	s.addresses = addresses.NewAddressChain(xpub, net, s.gapLimit, s.chainIndex)
}

func TestAddressChainTestSuite(t *testing.T) {
	suite.Run(t, &addressChainTestSuite{})
}

func (s *addressChainTestSuite) TestGetUnused() {
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })
	newAddresses := s.addresses.EnsureAddresses()
	// Gives the same address until the address history is changed.
	for i := 0; i < 3; i++ {
		require.Equal(s.T(), newAddresses[0], s.addresses.GetUnused())
	}
	newAddresses[0].History = []*client.TX{tx1}
	// Need to call EnsureAddresses because the status of an address changed.
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })
	_ = s.addresses.EnsureAddresses()
	require.NotEqual(s.T(), newAddresses[0], s.addresses.GetUnused())
	require.Equal(s.T(), newAddresses[1], s.addresses.GetUnused())
}

func (s *addressChainTestSuite) TestContains() {
	newAddresses := s.addresses.EnsureAddresses()
	for _, address := range newAddresses {
		require.True(s.T(), s.addresses.Contains(address))
	}
	// Produce addresses beyond  the gapLimit to ensure the gapLimit does not confuse Contains().
	newAddresses[0].History = []*client.TX{tx1}
	newAddresses = s.addresses.EnsureAddresses()
	require.Len(s.T(), newAddresses, 1)
	require.True(s.T(), s.addresses.Contains(newAddresses[0]))

	address := addresses.NewAddress(pk, net, keyPath)
	require.False(s.T(), s.addresses.Contains(address))
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
	for index, address := range newAddresses {
		require.Equal(s.T(), getPubKey(index), address.PublicKey)
	}
	// Address statuses are still the same, so calling it again won't produce more addresses.
	newAddresses2 := s.addresses.EnsureAddresses()
	require.Empty(s.T(), newAddresses2)
}
