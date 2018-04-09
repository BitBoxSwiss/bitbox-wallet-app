package addresses_test

import (
	"testing"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestNewAddressChain(t *testing.T) {
	log := logging.Log.WithGroup("addresses_test")
	xprvSerialized := "xprv9s21ZrQH143K2UBLkdzwqFV6PXipLq4VWMAcJNPUGcWiGbvpjNPAjiiVaBddzafxkPBqxQoNcLWNh5RkPLdPThhsAzLkuHBBjfZdriiyqaZ"
	xprv, err := hdkeychain.NewKeyFromString(xprvSerialized)
	require.NoError(t, err)
	xprv.SetNet(net)

	// Can't pass a private key.
	require.Panics(t,
		func() { addresses.NewAddressChain(xprv, net, 6, 0, addresses.AddressTypeP2PKH, log) })

	// Can't pass with the wrong net.
	xpub, err := xprv.Neuter()
	require.NoError(t, err)
	xpub.SetNet(&chaincfg.MainNetParams)
	require.Panics(t,
		func() { addresses.NewAddressChain(xpub, net, 6, 0, addresses.AddressTypeP2PKH, log) })

	// Public and matching net.
	xpub.SetNet(net)
	addresses.NewAddressChain(xpub, net, 6, 0, addresses.AddressTypeP2PKH, log)
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
	s.log = logging.Log.WithGroup("addresses_test")
	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}
	s.gapLimit = 6
	s.chainIndex = 1
	s.xpub = xpub
	s.addresses = addresses.NewAddressChain(
		xpub, net, s.gapLimit, s.chainIndex, addresses.AddressTypeP2PKH, s.log)
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
	newAddresses[0].HistoryStatus = client.TxHistory{tx1}.Status()
	// Need to call EnsureAddresses because the status of an address changed.
	require.Panics(s.T(), func() { _ = s.addresses.GetUnused() })
	_ = s.addresses.EnsureAddresses()
	require.NotEqual(s.T(), newAddresses[0], s.addresses.GetUnused())
	require.Equal(s.T(), newAddresses[1], s.addresses.GetUnused())
}

func (s *addressChainTestSuite) TestLookupByScriptHashHex() {
	newAddresses := s.addresses.EnsureAddresses()
	for _, address := range newAddresses {
		require.Equal(s.T(), address, s.addresses.LookupByScriptHashHex(address.ScriptHashHex()))
	}
	// Produce addresses beyond  the gapLimit to ensure the gapLimit does not confuse Contains().
	newAddresses[0].HistoryStatus = client.TxHistory{tx1}.Status()
	newAddresses = s.addresses.EnsureAddresses()
	require.Len(s.T(), newAddresses, 1)
	require.Equal(s.T(),
		newAddresses[0], s.addresses.LookupByScriptHashHex(newAddresses[0].ScriptHashHex()))

	address := addresses.NewAddress(pk, net, keyPath, addresses.AddressTypeP2PKH, s.log)
	require.Nil(s.T(), s.addresses.LookupByScriptHashHex(address.ScriptHashHex()))
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
		require.Equal(s.T(), getPubKey(index), address.TstPublicKey())
	}
	// Address statuses are still the same, so calling it again won't produce more addresses.
	newAddresses2 := s.addresses.EnsureAddresses()
	require.Empty(s.T(), newAddresses2)
}
