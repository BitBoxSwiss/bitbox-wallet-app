// Copyright 2021 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package btc

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/stretchr/testify/require"
)

func amt(v uint64) *btcutil.Amount {
	x := btcutil.Amount(v)
	return &x
}

func TestFeeTarget(t *testing.T) {
	require.Equal(t,
		accounts.FeeTargetCodeLow,
		(&FeeTarget{code: accounts.FeeTargetCodeLow}).Code(),
	)

	require.Equal(t,
		"0.123 sat/vB",
		(&FeeTarget{feeRatePerKb: amt(123)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"123.456 sat/vB",
		(&FeeTarget{feeRatePerKb: amt(123456)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"1 sat/vB",
		(&FeeTarget{feeRatePerKb: amt(1000)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"10 sat/vB",
		(&FeeTarget{feeRatePerKb: amt(10000)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"10.001 sat/vB",
		(&FeeTarget{feeRatePerKb: amt(10001)}).FormattedFeeRate(),
	)
}

func TestFeeTargets(t *testing.T) {
	// empty slice
	var feeTargets FeeTargets
	require.Nil(t, feeTargets.highest())

	// non-empty slice, with all nil feeRates
	feeTargets = FeeTargets{
		{blocks: 3, code: accounts.FeeTargetCodeMempoolHour},
		{blocks: 2, code: accounts.FeeTargetCodeMempoolHalfHour},
		{blocks: 1, code: accounts.FeeTargetCodeMempoolFastest},
	}
	require.Nil(t, feeTargets.highest())

	// non-empty slice, with all nil feeRates
	feeTargets = FeeTargets{
		{blocks: 3, code: accounts.FeeTargetCodeMempoolHour},
		{blocks: 2, code: accounts.FeeTargetCodeMempoolHalfHour},
		{blocks: 1, code: accounts.FeeTargetCodeMempoolFastest},
	}
	require.Nil(t, feeTargets.highest())

	// non-empty slice, with some nil feeRates
	feeTargetsSlice := []*FeeTarget{
		{blocks: 3, code: accounts.FeeTargetCodeMempoolHour, feeRatePerKb: amt(12)},
		{blocks: 2, code: accounts.FeeTargetCodeMempoolHalfHour},
		{blocks: 1, code: accounts.FeeTargetCodeMempoolFastest, feeRatePerKb: amt(123)},
	}
	feeTargets = feeTargetsSlice
	require.Equal(t, feeTargetsSlice[2], feeTargets.highest())

	// non-empty slice, with unsorted not-nil feeRates
	feeTargetsSlice = []*FeeTarget{
		{blocks: 3, code: accounts.FeeTargetCodeMempoolHour, feeRatePerKb: amt(12)},
		{blocks: 1, code: accounts.FeeTargetCodeMempoolFastest, feeRatePerKb: amt(1234)},
		{blocks: 2, code: accounts.FeeTargetCodeMempoolHalfHour, feeRatePerKb: amt(123)},
	}
	feeTargets = feeTargetsSlice
	require.Equal(t, feeTargetsSlice[1], feeTargets.highest())

}
