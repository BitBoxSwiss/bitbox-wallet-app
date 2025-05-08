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
	"encoding/hex"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
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
	expectedKeypath := signing.NewEmptyAbsoluteKeypath().
		Child(0, false).
		Child(10, false).
		Child(0, false).
		Child(0, false)
	s.Require().Equal(expectedKeypath, s.address.Configuration.AbsoluteKeypath())
	s.Require().Equal("moTM88EgqzATgCjSrcNfahXaT9uCy3FHh3", s.address.EncodeAddress())
	s.Require().True(s.address.IsForNet(net))
}

func (s *addressTestSuite) TestPubkeyScript() {
	payToAddrScript := []byte{0x76, 0xa9, 0x14, 0x57, 0x12, 0x66, 0x22, 0x63, 0x8b, 0x8d, 0xb3, 0x25, 0xa6, 0x1, 0x35, 0xe2, 0xfd, 0x88, 0x53, 0x74, 0x91, 0xa1, 0xe0, 0x88, 0xac}
	s.Require().Equal(payToAddrScript, s.address.PubkeyScript())
}

func (s *addressTestSuite) TestScriptHashHex() {
	s.Require().Equal(
		blockchain.ScriptHashHex("1f4444773ff74188b4d8ccff2a2efec0cae61efce152cafef97b6fadb96382b5"),
		s.address.PubkeyScriptHashHex())
}

func TestAddressP2TR(t *testing.T) {
	// Test vectors from https://github.com/bitcoin/bips/blob/a3a397c82384220fc871852c809f73898a4d547c/bip-0086.mediawiki#Test_vectors

	extendedPublicKey, err := hdkeychain.NewKeyFromString("xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ")
	require.NoError(t, err)
	keypath, err := signing.NewAbsoluteKeypath("m/86'/0'/0'")
	require.NoError(t, err)
	for _, test := range []struct {
		change           bool
		addressIndex     uint32
		expectedAddress  string
		expectedPkScript string
	}{
		{
			change:           false,
			addressIndex:     0,
			expectedAddress:  "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
			expectedPkScript: "5120a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c",
		},
		{
			change:           false,
			addressIndex:     1,
			expectedAddress:  "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
			expectedPkScript: "5120a82f29944d65b86ae6b5e5cc75e294ead6c59391a1edc5e016e3498c67fc7bbb",
		},
		{
			change:           true,
			addressIndex:     0,
			expectedAddress:  "bc1p3qkhfews2uk44qtvauqyr2ttdsw7svhkl9nkm9s9c3x4ax5h60wqwruhk7",
			expectedPkScript: "5120882d74e5d0572d5a816cef0041a96b6c1de832f6f9676d9605c44d5e9a97d3dc",
		},
	} {
		require.NoError(t, err)
		addr := addresses.NewAccountAddress(
			signing.NewBitcoinConfiguration(
				signing.ScriptTypeP2TR,
				[]byte{1, 2, 3, 4},
				keypath,
				extendedPublicKey,
			),
			types.Derivation{Change: test.change, AddressIndex: test.addressIndex},
			&chaincfg.MainNetParams,
			logging.Get().WithGroup("addresses_test"),
		)
		require.Equal(t, test.expectedAddress, addr.EncodeForHumans())
		require.Equal(t, test.expectedPkScript, hex.EncodeToString(addr.PubkeyScript()))
	}
}
