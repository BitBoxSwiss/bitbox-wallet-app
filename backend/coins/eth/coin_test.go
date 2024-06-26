// Copyright 2021 Shift Crypto AG
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

package eth

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/suite"
)

type testSuite struct {
	suite.Suite
	coin      *Coin
	ERC20Coin *Coin
}

func (s *testSuite) SetupTest() {
	s.coin = NewCoin(
		nil,
		coin.CodeETH,
		"Ethereum",
		"ETH",
		"ETH",
		params.MainnetChainConfig,
		"",
		nil,
		nil,
	)

	s.ERC20Coin = NewCoin(
		nil,
		"ERC20TEST",
		"ERC20Test",
		"TOK",
		"ETH",
		params.MainnetChainConfig,
		"",
		nil,
		erc20.NewToken("0x0000000000000000000000000000000000000001", 12),
	)
}

func TestSuite(t *testing.T) {
	suite.Run(t, new(testSuite))
}

func (s *testSuite) TestFormatAmount() {

	for _, isFee := range []bool{false, true} {
		s.Require().Equal(
			"0.000000000000000001",
			s.coin.FormatAmount(coin.NewAmountFromInt64(1), isFee),
		)
		s.Require().Equal(
			"0.000000000001",
			s.coin.FormatAmount(coin.NewAmountFromInt64(1000000), isFee),
		)
		s.Require().Equal(
			"1",
			s.coin.FormatAmount(coin.NewAmountFromInt64(1e18), isFee),
		)
		s.Require().Equal(
			"100",
			s.coin.FormatAmount(coin.NewAmount(new(big.Int).Exp(big.NewInt(10), big.NewInt(20), nil)), isFee),
		)
		s.Require().Equal(
			"1.234",
			s.coin.FormatAmount(coin.NewAmountFromInt64(1.234e18), isFee),
		)
	}
	s.Require().Equal(
		"123456.789012345678",
		s.ERC20Coin.FormatAmount(coin.NewAmountFromInt64(123456789012345678), false),
	)
	s.Require().Equal(
		"0.123456789012345678",
		s.ERC20Coin.FormatAmount(coin.NewAmountFromInt64(123456789012345678), true),
	)
}

func (s *testSuite) TestSetAmount() {
	ratAmount1, _ := new(big.Rat).SetString("123.123456789012345678")
	ratAmount2, _ := new(big.Rat).SetString("0")
	ratAmount3, _ := new(big.Rat).SetString("123")

	for _, isFee := range []bool{false, true} {
		s.Require().Equal("123123456789012345678",
			s.coin.SetAmount(ratAmount1, isFee).BigInt().String())
		s.Require().Equal("0",
			s.coin.SetAmount(ratAmount2, isFee).BigInt().String())
		s.Require().Equal("123000000000000000000",
			s.coin.SetAmount(ratAmount3, isFee).BigInt().String())
	}
	s.Require().Equal("123123456789012345678",
		s.ERC20Coin.SetAmount(ratAmount1, true).BigInt().String())
	s.Require().Equal("123123456789012",
		s.ERC20Coin.SetAmount(ratAmount1, false).BigInt().String())
}

func (s *testSuite) TestParseAmount() {
	ethAmount := "1.123456789012345678"
	intWeiAmount := int64(1123456789012345678)

	coinAmount, err := s.coin.ParseAmount(ethAmount)
	s.Require().NoError(err)
	intAmount, err := coinAmount.Int64()
	s.Require().NoError(err)
	s.Require().Equal(intWeiAmount, intAmount)

	coinAmount, err = s.coin.ParseAmount(ethAmount)
	s.Require().NoError(err)
	intAmount, err = coinAmount.Int64()
	s.Require().NoError(err)
	s.Require().Equal(intWeiAmount, intAmount)
}

func (s *testSuite) TestGetFormatUnit() {
	s.Require().Equal("ETH", s.coin.GetFormatUnit(true))
	s.Require().Equal("ETH", s.coin.GetFormatUnit(false))
	s.Require().Equal("ETH", s.ERC20Coin.GetFormatUnit(true))
	s.Require().Equal("TOK", s.ERC20Coin.GetFormatUnit(false))
}

func (s *testSuite) TestUnit() {
	s.Require().Equal("ETH", s.coin.Unit(true))
	s.Require().Equal("ETH", s.coin.Unit(false))
	s.Require().Equal("ETH", s.ERC20Coin.Unit(true))
	s.Require().Equal("TOK", s.ERC20Coin.Unit(false))
}
