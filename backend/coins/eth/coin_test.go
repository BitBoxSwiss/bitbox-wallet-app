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

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type testSuite struct {
	suite.Suite
	coin *Coin
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
}

func TestSuite(t *testing.T) {
	suite.Run(t, new(testSuite))
}

func (s *testSuite) TestFormatAmount() {
	require.Equal(s.T(),
		"0.000000000000000001",
		s.coin.FormatAmount(coin.NewAmountFromInt64(1), false),
	)
	require.Equal(s.T(),
		"0.000000000001",
		s.coin.FormatAmount(coin.NewAmountFromInt64(1000000), false),
	)
	require.Equal(s.T(),
		"1",
		s.coin.FormatAmount(coin.NewAmountFromInt64(1e18), false),
	)
	require.Equal(s.T(),
		"100",
		s.coin.FormatAmount(coin.NewAmount(new(big.Int).Exp(big.NewInt(10), big.NewInt(20), nil)), false),
	)
	require.Equal(s.T(),
		"1.234",
		s.coin.FormatAmount(coin.NewAmountFromInt64(1.234e18), false),
	)
}

func (s *testSuite) TestSetAmount() {
	ratAmount1, _ := new(big.Rat).SetString("123.123456789012345678")
	ratAmount2, _ := new(big.Rat).SetString("0")
	ratAmount3, _ := new(big.Rat).SetString("123")

	for _, isFee := range []bool{false, true} {
		require.Equal(s.T(), "123123456789012345678",
			s.coin.SetAmount(ratAmount1, isFee).BigInt().String())
		require.Equal(s.T(), "0",
			s.coin.SetAmount(ratAmount2, isFee).BigInt().String())
		require.Equal(s.T(), "123000000000000000000",
			s.coin.SetAmount(ratAmount3, isFee).BigInt().String())
	}
}
