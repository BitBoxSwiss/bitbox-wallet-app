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
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	testlog "github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestMain(m *testing.M) {
	testlog.TstSetupLogging()
	os.Exit(m.Run())
}

var net = &chaincfg.TestNet3Params

var absoluteKeypath = signing.NewEmptyAbsoluteKeypath().Child(0, false).Child(10, false)

type addressTestSuite struct {
	suite.Suite

	address *addresses.AccountAddress
}

func TestAddressTestSuite(t *testing.T) {
	testSuite := new(addressTestSuite)
	testSuite.address = test.GetAddress(signing.ScriptTypeP2PKH)
	suite.Run(t, testSuite)
}

func (s *addressTestSuite) TestNewAddress() {
	s.Require().Equal(absoluteKeypath, s.address.Configuration.AbsoluteKeypath())
	s.Require().Equal("n2gAErwJCuPmnQuhzPkkWi2haGz9oQxjnX", s.address.EncodeAddress())
	s.Require().True(s.address.IsForNet(net))
}

func (s *addressTestSuite) TestPubkeyScript() {
	payToAddrScript := []byte{
		0x76, 0xa9, 0x14, 0xe8, 0x18, 0x5b, 0x34, 0x52, 0x22, 0xbe, 0x2b, 0x77, 0x2f,
		0x7a, 0xef, 0x16, 0x2c, 0x11, 0x85, 0x73, 0x2, 0x9d, 0xf4, 0x88, 0xac}
	s.Require().Equal(payToAddrScript, s.address.PubkeyScript())
}

func (s *addressTestSuite) TestScriptHashHex() {
	s.Require().Equal(
		blockchain.ScriptHashHex("0466d0029406f583feadaccb91c7b5b855eb5d6782316cafa4f390b7c784436b"),
		s.address.PubkeyScriptHashHex())
}

func TestAddressP2TR(t *testing.T) {
	// Test vectors from https://github.com/bitcoin/bips/blob/a3a397c82384220fc871852c809f73898a4d547c/bip-0086.mediawiki#Test_vectors

	extendedPublicKey, err := hdkeychain.NewKeyFromString("xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ")
	require.NoError(t, err)
	keypath, err := signing.NewAbsoluteKeypath("m/86'/0'/0'")
	require.NoError(t, err)
	for _, test := range []struct {
		path            string
		expectedAddress string
	}{
		{
			path:            "0/0",
			expectedAddress: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
		},
		{
			path:            "0/1",
			expectedAddress: "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
		},
		{
			path:            "1/0",
			expectedAddress: "bc1p3qkhfews2uk44qtvauqyr2ttdsw7svhkl9nkm9s9c3x4ax5h60wqwruhk7",
		},
	} {
		relKeypath, err := signing.NewRelativeKeypath(test.path)
		require.NoError(t, err)
		addr := addresses.NewAccountAddress(
			signing.NewBitcoinConfiguration(
				signing.ScriptTypeP2TR,
				[]byte{1, 2, 3, 4},
				keypath,
				extendedPublicKey,
			),
			relKeypath,
			&chaincfg.MainNetParams,
			logging.Get().WithGroup("addresses_test"),
		)
		require.Equal(t, test.expectedAddress, addr.EncodeForHumans())
	}
}
