// SPDX-License-Identifier: Apache-2.0

package coin_test

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestBtcUnitFormatAndParse(t *testing.T) {
	for _, tc := range []struct {
		btc, sats string
	}{
		{"0.00000000", "0"},
		{"0.00000001", "1"},
		{"-0.00000001", "-1"},
		{"1.00000000", "100000000"},
		{"12.34568910", "1234568910"},
		{"90071992.54740993", "9007199254740993"},
		{"3022314549036572.93676544", "302231454903657293676544"},
	} {
		t.Run(tc.sats, func(t *testing.T) {
			value, ok := new(big.Int).SetString(tc.sats, 10)
			require.True(t, ok)
			amount := coin.NewAmount(value)
			for _, unit := range []coin.BtcUnit{coin.BtcUnitDefault, coin.BtcUnitSats} {
				want := tc.btc
				if unit == coin.BtcUnitSats {
					want = tc.sats
				}
				require.Equal(t, want, unit.FormatAmount(amount))
				parsed, err := unit.ParseAmount(want)
				require.NoError(t, err)
				require.Equal(t, amount, parsed)
			}
		})
	}
}
