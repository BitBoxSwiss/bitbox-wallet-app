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

package coin_test

import (
	"fmt"
	"math"
	"math/big"
	"testing"
	"testing/quick"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestNewAmountFromString(t *testing.T) {
	for decimals := 0; decimals <= 20; decimals++ {
		decimals := decimals // avoids referencing the same variable across loop iterations
		unit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
		t.Run(fmt.Sprintf("decimals=%d", decimals), func(t *testing.T) {
			require.NoError(t, quick.Check(func(amount int64) bool {
				formatted := new(big.Rat).SetFrac(big.NewInt(amount), unit).FloatString(decimals)
				parsedAmount, err := coin.NewAmountFromString(formatted, unit)
				require.NoError(t, err)
				amountInt64, err := parsedAmount.Int64()
				require.NoError(t, err)
				return amountInt64 == amount
			}, nil))
		})
	}
	for _, fail := range []string{
		"",
		"1.2 not a number",
		"1/1000",
		"0.123456789", // only up to 8 decimals allowed
	} {
		fail := fail // avoids referencing the same variable across loop iterations
		t.Run(fail, func(t *testing.T) {
			_, err := coin.NewAmountFromString(fail, big.NewInt(1e8))
			require.Error(t, err)
		})
	}
	// parse 2^78
	veryBig, err := coin.NewAmountFromString("3022314549036572.93676544", big.NewInt(1e8))
	require.NoError(t, err)
	require.Equal(t,
		new(big.Int).Exp(big.NewInt(2), big.NewInt(78), nil),
		veryBig.BigInt(),
	)
}

func TestAmountCopy(t *testing.T) {
	amount := coin.NewAmountFromInt64(1)
	require.Equal(t, big.NewInt(1), amount.BigInt())
	// Modify copy, check that original does not change.
	amount.BigInt().SetInt64(2)
	require.Equal(t, big.NewInt(1), amount.BigInt())
}

func TestAmountInt64(t *testing.T) {
	amount, err := coin.NewAmount(big.NewInt(math.MaxInt64)).Int64()
	require.NoError(t, err)
	require.Equal(t, int64(math.MaxInt64), amount)

	amount, err = coin.NewAmount(big.NewInt(math.MinInt64)).Int64()
	require.NoError(t, err)
	require.Equal(t, int64(math.MinInt64), amount)

	_, err = coin.NewAmount(new(big.Int).Add(big.NewInt(math.MaxInt64), big.NewInt(1))).Int64()
	require.Error(t, err)

	_, err = coin.NewAmount(new(big.Int).Sub(big.NewInt(math.MinInt64), big.NewInt(1))).Int64()
	require.Error(t, err)
}

func TestSendAmount(t *testing.T) {
	sendAmount := coin.NewSendAmountAll()
	require.Panics(t, func() { _, _ = sendAmount.Amount(big.NewInt(0), false) })
	require.True(t, sendAmount.SendAll())

	for _, allowZero := range []bool{false, true} {
		_, err := coin.NewSendAmount("-1").Amount(big.NewInt(1), allowZero)
		require.Error(t, err)
	}

	_, err := coin.NewSendAmount("0").Amount(big.NewInt(1), false)
	require.Error(t, err)

	amount, err := coin.NewSendAmount("0").Amount(big.NewInt(1), true)
	require.NoError(t, err)
	require.Equal(t, int64(0), amount.BigInt().Int64())

}
