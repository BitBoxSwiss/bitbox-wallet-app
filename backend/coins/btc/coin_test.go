// Copyright 2020 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

package btc_test

import (
	"encoding/hex"
	"math/big"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/suite"
)

const (
	explorer = "https://some-explorer.com"
)

func TestMain(m *testing.M) {
	test.TstSetupLogging()
	os.Exit(m.Run())
}

type testSuite struct {
	suite.Suite

	code coin.Code
	unit string
	net  *chaincfg.Params

	dbFolder string
	coin     *btc.Coin
}

func (s *testSuite) SetupTest() {
	s.dbFolder = test.TstTempDir("btc-dbfolder")

	s.coin = btc.NewCoin(s.code, "Some coin", s.unit, coin.BtcUnitDefault, s.net, s.dbFolder, nil,
		explorer, socksproxy.NewSocksProxy(false, ""))
	blockchainMock := &blockchainMock.BlockchainMock{}
	blockchainMock.MockHeadersSubscribe = func(
		result func(*types.Header)) {

	}
	s.coin.TstSetMakeBlockchain(func() blockchain.Interface { return blockchainMock })
	s.coin.Initialize()
}

func (s *testSuite) TearDownTest() {
	_ = os.RemoveAll(s.dbFolder)
}

func TestSuite(t *testing.T) {
	suite.Run(t, &testSuite{code: coin.CodeTBTC, unit: "TBTC", net: &chaincfg.TestNet3Params})
	suite.Run(t, &testSuite{code: coin.CodeBTC, unit: "BTC", net: &chaincfg.MainNetParams})
	suite.Run(t, &testSuite{code: coin.CodeTLTC, unit: "TLTC", net: &ltc.TestNet4Params})
	suite.Run(t, &testSuite{code: coin.CodeLTC, unit: "LTC", net: &ltc.MainNetParams})
}

func (s *testSuite) TestCoin() {
	s.Require().Equal(s.net, s.coin.Net())
	s.Require().Equal(s.code, s.coin.Code())
	s.Require().Equal("Some coin", s.coin.Name())
	s.Require().Equal(s.unit, s.coin.Unit(false))
	s.Require().Equal(s.unit, s.coin.Unit(true))
	s.Require().Equal(uint(8), s.coin.Decimals(false))
	s.Require().Equal(uint(8), s.coin.Decimals(true))
	s.Require().Equal(explorer, s.coin.BlockExplorerTransactionURLPrefix())
}

func (s *testSuite) TestFormatAmount() {
	for _, isFee := range []bool{false, true} {
		s.Require().Equal("12.34568910", s.coin.FormatAmount(
			coin.NewAmountFromInt64(1234568910), isFee))
		s.Require().Equal("0.00000000", s.coin.FormatAmount(
			coin.NewAmountFromInt64(0), isFee))
		s.Require().Equal("0.00000001", s.coin.FormatAmount(
			coin.NewAmountFromInt64(1), isFee))
	}
}

func (s *testSuite) TestToUnit() {
	for _, isFee := range []bool{false, true} {
		s.Require().Equal(float64(12.34568910), s.coin.ToUnit(
			coin.NewAmountFromInt64(1234568910), isFee))
		s.Require().Equal(float64(0), s.coin.ToUnit(
			coin.NewAmountFromInt64(0), isFee))
		s.Require().Equal(float64(0.00000001), s.coin.ToUnit(
			coin.NewAmountFromInt64(1), isFee))
	}
}

func (s *testSuite) TestSetAmount() {
	ratAmount1, _ := new(big.Rat).SetString("123.12345678")
	ratAmount2, _ := new(big.Rat).SetString("0")
	ratAmount3, _ := new(big.Rat).SetString("123")

	for _, isFee := range []bool{false, true} {
		s.Require().Equal("12312345678",
			s.coin.SetAmount(ratAmount1, isFee).BigInt().String())
		s.Require().Equal("0",
			s.coin.SetAmount(ratAmount2, isFee).BigInt().String())
		s.Require().Equal("12300000000",
			s.coin.SetAmount(ratAmount3, isFee).BigInt().String())
	}
}

func (s *testSuite) TestParseAmount() {
	btcAmount := "123.12345678"
	satAmount := "12312345678"
	intSatAmount := int64(12312345678)

	s.coin.SetFormatUnit("BTC")
	coinAmount, err := s.coin.ParseAmount(btcAmount)
	s.Require().NoError(err)
	intAmount, err := coinAmount.Int64()
	s.Require().NoError(err)
	s.Require().Equal(intSatAmount, intAmount)

	s.coin.SetFormatUnit("sat")
	coinAmount, err = s.coin.ParseAmount(satAmount)
	s.Require().NoError(err)
	intAmount, err = coinAmount.Int64()
	s.Require().NoError(err)
	s.Require().Equal(intSatAmount, intAmount)
}

func (s *testSuite) TestAddressToPkScript() {
	type test struct {
		address     string
		pkScriptHex string
	}
	tbtcValidAddresses := []test{
		// p2pkh legacy
		{"myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL", "76a914c5a6c2d1cfdc329cd9d2f64de7655e152599c9b388ac"},
		// p2sh
		{"2NBecb6J3HmBBC8RDB9PC2h7EgT9iyza1N3", "a914c9deb2667a67c92b080b405fadd4ce12568b7c3287"},
		// p2wpkh native segwit
		{"tb1qp4p8rtxsg3ddz62pntl64s2ddctgtjudkdsg27", "00140d4271acd0445ad169419affaac14d6e1685cb8d"},
		// p2tr
		{"tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv", "5120a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c"},
	}
	btcValidAddresses := []test{
		// p2pkh legacy
		{"1GM1Wp6t3hJf6U5aq6dG62Pg3c9ePbiUQ9", "76a914a852a2934058f4ba584d38965965eb110ccb304488ac"},
		// p2sh
		{"3GZFjFASPoYh3zuLoJLapYpKHw7ikiH63z", "a914a3121543483fb34d13da19236b50aea601391b8f87"},
		// p2wpkh native segwit
		{"bc1qwqdg6squsna38e46795at95yu9atm8azzmyvckulcc7kytlcckxswvvzej", "0020701a8d401c84fb13e6baf169d59684e17abd9fa216c8cc5b9fc63d622ff8c58d"},
		// p2tr
		{"bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", "5120a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c"},
	}
	tltcValidAddresses := []test{
		// p2pkh legacy
		{"mjWrpYaAg7jg5fSXo7Mjt7xwbzRzuEBA39", "76a9142bdbeef518159dcf7192709c71a93de6230a3c4888ac"},
		// p2sh
		{"2N9JZjVcmguGeJHHnjaz4TuBkQdcKZxBC5H", "a914b023be234166b32144462038da9ff9102fd6db3b87"},
		// p2wpkh native segwit
		{"tltc1q2n65aaawmc94xsyznyr5939uztwjdz3rhvveq0", "001454f54ef7aede0b534082990742c4bc12dd268a23"},
	}
	ltcValidAddresses := []test{
		// p2pkh legacy
		{"Lc88gfaqBup8k9588fwaP1o73esVsUADoZ", "76a914b9605791ed1f22ab9193b9027ed49b73195dbb7188ac"},
		// p2sh
		{"MLJ3Dyx49mc4PQf3SfeW8ixeAtTE2G9Y74", "a91487f53a0e46928d96071cdff379378cefd813962787"},
		// p2wpkh native segwit
		{"ltc1qzr0n0a4xs0404fy5l7pl7pj8yj8q34ml27rlcs", "001410df37f6a683eafaa494ff83ff0647248e08d77f"},
	}

	var validAddresses []test
	var invalidAddresses []test
	switch s.code {
	case coin.CodeTBTC:
		validAddresses = tbtcValidAddresses
		invalidAddresses = append([]test{}, btcValidAddresses...)
		invalidAddresses = append(invalidAddresses, ltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tltcValidAddresses[2])
	case coin.CodeBTC:
		validAddresses = btcValidAddresses
		invalidAddresses = append([]test{}, tbtcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, ltcValidAddresses...)
	case coin.CodeTLTC:
		validAddresses = tltcValidAddresses
		invalidAddresses = append([]test{}, ltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, btcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tbtcValidAddresses[2])
	case coin.CodeLTC:
		validAddresses = ltcValidAddresses
		invalidAddresses = append([]test{}, tltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tbtcValidAddresses...)
		invalidAddresses = append(invalidAddresses, btcValidAddresses...)
	default:
		s.Require().Fail("not all cases tested")
	}
	for _, test := range validAddresses {
		pkScript, err := s.coin.AddressToPkScript(test.address)
		s.Require().NoError(err, test.address)
		s.Require().Equal(test.pkScriptHex, hex.EncodeToString(pkScript), test.address)
	}
	for _, test := range invalidAddresses {
		_, err := s.coin.AddressToPkScript(test.address)
		s.Require().Equal(errors.ErrInvalidAddress, errp.Cause(err), test.address)
	}

}
