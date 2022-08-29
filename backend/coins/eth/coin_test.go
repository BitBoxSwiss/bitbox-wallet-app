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
)

func TestCoin(t *testing.T) {
	c := NewCoin(
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

	require.Equal(t,
		"0.000000000000000001",
		c.FormatAmount(coin.NewAmountFromInt64(1), false),
	)
	require.Equal(t,
		"0.000000000001",
		c.FormatAmount(coin.NewAmountFromInt64(1000000), false),
	)
	require.Equal(t,
		"1",
		c.FormatAmount(coin.NewAmountFromInt64(1e18), false),
	)
	require.Equal(t,
		"100",
		c.FormatAmount(coin.NewAmount(new(big.Int).Exp(big.NewInt(10), big.NewInt(20), nil)), false),
	)
	require.Equal(t,
		"1.234",
		c.FormatAmount(coin.NewAmountFromInt64(1.234e18), false),
	)

	ratAmount1, _ := new(big.Rat).SetString("123.123456789012345678")
	ratAmount2, _ := new(big.Rat).SetString("0")
	ratAmount3, _ := new(big.Rat).SetString("123")

	for _, isFee := range []bool{false, true} {
		require.Equal(t, "123123456789012345678",
			c.SetAmount(ratAmount1, isFee).BigInt().String())
		require.Equal(t, "0",
			c.SetAmount(ratAmount2, isFee).BigInt().String())
		require.Equal(t, "123000000000000000000",
			c.SetAmount(ratAmount3, isFee).BigInt().String())
	}
}
