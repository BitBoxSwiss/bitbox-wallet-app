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
	"math/big"
	"os"
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/digitalbitbox/block-client-go/electrum/types"
	"github.com/stretchr/testify/require"
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
	require.Equal(s.T(), s.net, s.coin.Net())
	require.Equal(s.T(), s.code, s.coin.Code())
	require.Equal(s.T(), "Some coin", s.coin.Name())
	require.Equal(s.T(), s.unit, s.coin.Unit(false))
	require.Equal(s.T(), s.unit, s.coin.Unit(true))
	require.Equal(s.T(), uint(8), s.coin.Decimals(false))
	require.Equal(s.T(), uint(8), s.coin.Decimals(true))
	require.Equal(s.T(), explorer, s.coin.BlockExplorerTransactionURLPrefix())
}

func (s *testSuite) TestFormatAmount() {
	for _, isFee := range []bool{false, true} {
		require.Equal(s.T(), "12.34568910", s.coin.FormatAmount(
			coin.NewAmountFromInt64(1234568910), isFee))
		require.Equal(s.T(), "0.00000000", s.coin.FormatAmount(
			coin.NewAmountFromInt64(0), isFee))
		require.Equal(s.T(), "0.00000001", s.coin.FormatAmount(
			coin.NewAmountFromInt64(1), isFee))
	}
}

func (s *testSuite) TestToUnit() {
	for _, isFee := range []bool{false, true} {
		require.Equal(s.T(), float64(12.34568910), s.coin.ToUnit(
			coin.NewAmountFromInt64(1234568910), isFee))
		require.Equal(s.T(), float64(0), s.coin.ToUnit(
			coin.NewAmountFromInt64(0), isFee))
		require.Equal(s.T(), float64(0.00000001), s.coin.ToUnit(
			coin.NewAmountFromInt64(1), isFee))
	}
}

func (s *testSuite) TestSetAmount() {
	ratAmount1, _ := new(big.Rat).SetString("123.12345678")
	ratAmount2, _ := new(big.Rat).SetString("0")
	ratAmount3, _ := new(big.Rat).SetString("123")

	for _, isFee := range []bool{false, true} {
		require.Equal(s.T(), "12312345678",
			s.coin.SetAmount(ratAmount1, isFee).BigInt().String())
		require.Equal(s.T(), "0",
			s.coin.SetAmount(ratAmount2, isFee).BigInt().String())
		require.Equal(s.T(), "12300000000",
			s.coin.SetAmount(ratAmount3, isFee).BigInt().String())
	}
}

func (s *testSuite) TestParseAmount() {
	btcAmount := "123.12345678"
	satAmount := "12312345678"
	intSatAmount := int64(12312345678)

	s.coin.SetFormatUnit("BTC")
	coinAmount, err := s.coin.ParseAmount(btcAmount)
	require.Equal(s.T(), err, nil)
	intAmount, err := coinAmount.Int64()
	require.Equal(s.T(), err, nil)
	require.Equal(s.T(), intSatAmount, intAmount)

	s.coin.SetFormatUnit("sat")
	coinAmount, err = s.coin.ParseAmount(satAmount)
	require.Equal(s.T(), err, nil)
	intAmount, err = coinAmount.Int64()
	require.Equal(s.T(), err, nil)
	require.Equal(s.T(), intSatAmount, intAmount)
}

func (s *testSuite) TestDecodeAddress() {
	tbtcValidAddresses := []string{
		"myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",                             // p2pkh legacy
		"2NBecb6J3HmBBC8RDB9PC2h7EgT9iyza1N3",                            // p2sh
		"tb1qp4p8rtxsg3ddz62pntl64s2ddctgtjudkdsg27",                     // p2wpkh native segwit
		"tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv", // p2tr
	}
	btcValidAddresses := []string{
		"1GM1Wp6t3hJf6U5aq6dG62Pg3c9ePbiUQ9",                             // p2pkh legacy
		"3GZFjFASPoYh3zuLoJLapYpKHw7ikiH63z",                             // p2sh
		"bc1qwqdg6squsna38e46795at95yu9atm8azzmyvckulcc7kytlcckxswvvzej", // p2wpkh native segwit
		"bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", // p2tr
	}
	tltcValidAddresses := []string{
		"mjWrpYaAg7jg5fSXo7Mjt7xwbzRzuEBA39",           // p2pkh legacy
		"2N9JZjVcmguGeJHHnjaz4TuBkQdcKZxBC5H",          // p2sh
		"tltc1q2n65aaawmc94xsyznyr5939uztwjdz3rhvveq0", // p2wpkh native segwit
	}
	ltcValidAddresses := []string{
		"Lc88gfaqBup8k9588fwaP1o73esVsUADoZ",          // p2pkh legacy
		"MLJ3Dyx49mc4PQf3SfeW8ixeAtTE2G9Y74",          // p2sh
		"ltc1qzr0n0a4xs0404fy5l7pl7pj8yj8q34ml27rlcs", // p2wpkh native segwit
	}

	var validAddresses []string
	var invalidAddresses []string
	switch s.code {
	case coin.CodeTBTC:
		validAddresses = tbtcValidAddresses
		invalidAddresses = append([]string{}, btcValidAddresses...)
		invalidAddresses = append(invalidAddresses, ltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tltcValidAddresses[2])
	case coin.CodeBTC:
		validAddresses = btcValidAddresses
		invalidAddresses = append([]string{}, tbtcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, ltcValidAddresses...)
	case coin.CodeTLTC:
		validAddresses = tltcValidAddresses
		invalidAddresses = append([]string{}, ltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, btcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tbtcValidAddresses[2])
	case coin.CodeLTC:
		validAddresses = ltcValidAddresses
		invalidAddresses = append([]string{}, tltcValidAddresses...)
		invalidAddresses = append(invalidAddresses, tbtcValidAddresses...)
		invalidAddresses = append(invalidAddresses, btcValidAddresses...)
	default:
		require.Fail(s.T(), "not all cases tested")
	}
	for _, validAddress := range validAddresses {
		addr, err := s.coin.DecodeAddress(validAddress)
		require.NoError(s.T(), err, validAddress)
		require.Equal(s.T(), validAddress, addr.EncodeAddress())
	}
	for _, invalidAddress := range invalidAddresses {
		_, err := s.coin.DecodeAddress(invalidAddress)
		require.Equal(s.T(), errors.ErrInvalidAddress, errp.Cause(err), invalidAddress)
	}

}
