package addresses_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses/test"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var net = &chaincfg.TestNet3Params

var absoluteKeypath = signing.NewEmptyAbsoluteKeypath().Child(0, false).Child(10, false)

type addressTestSuite struct {
	suite.Suite

	address *addresses.AccountAddress
}

func TestAddressTestSuite(t *testing.T) {
	testSuite := new(addressTestSuite)
	testSuite.address = test.GetAddress(addresses.AddressTypeP2PKH)
	suite.Run(t, testSuite)
}

func (s *addressTestSuite) TestNewAddress() {
	require.Equal(s.T(), absoluteKeypath, s.address.Configuration.AbsoluteKeypath())
	require.Equal(s.T(), "n2gAErwJCuPmnQuhzPkkWi2haGz9oQxjnX", s.address.EncodeAddress())
	require.Equal(s.T(), "", s.address.HistoryStatus)
	require.True(s.T(), s.address.IsForNet(net))
}

func (s *addressTestSuite) TestPubkeyScript() {
	payToAddrScript := []byte{
		0x76, 0xa9, 0x14, 0xe8, 0x18, 0x5b, 0x34, 0x52, 0x22, 0xbe, 0x2b, 0x77, 0x2f,
		0x7a, 0xef, 0x16, 0x2c, 0x11, 0x85, 0x73, 0x2, 0x9d, 0xf4, 0x88, 0xac}
	require.Equal(s.T(), payToAddrScript, s.address.PubkeyScript())
}

func (s *addressTestSuite) TestScriptHashHex() {
	require.Equal(s.T(),
		client.ScriptHashHex("0466d0029406f583feadaccb91c7b5b855eb5d6782316cafa4f390b7c784436b"),
		s.address.PubkeyScriptHashHex())
}
