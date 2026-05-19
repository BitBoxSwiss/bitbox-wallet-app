// SPDX-License-Identifier: Apache-2.0

package coin_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestBIP44CoinType(t *testing.T) {
	tests := []struct {
		name     string
		code     coin.Code
		coinType uint32
	}{
		{name: "btc", code: coin.CodeBTC, coinType: 0},
		{name: "tbtc", code: coin.CodeTBTC, coinType: 1},
		{name: "rbtc", code: coin.CodeRBTC, coinType: 1},
		{name: "ltc", code: coin.CodeLTC, coinType: 2},
		{name: "tltc", code: coin.CodeTLTC, coinType: 1},
		{name: "eth", code: coin.CodeETH, coinType: 60},
		{name: "sepeth", code: coin.CodeSEPETH, coinType: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			coinType, ok := coin.BIP44CoinType(test.code)
			require.True(t, ok)
			require.Equal(t, test.coinType, coinType)
		})
	}
}

func TestBIP44CoinTypeUnsupportedCoin(t *testing.T) {
	_, ok := coin.BIP44CoinType("doge")
	require.False(t, ok)
}
