// Copyright 2021 Shift Crypto AG
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

package eth

import (
	"math/big"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/stretchr/testify/require"
)

func TestFeeTarget(t *testing.T) {
	require.Equal(t,
		accounts.FeeTargetCodeLow,
		(&feeTarget{code: accounts.FeeTargetCodeLow, gasPrice: big.NewInt(21.9e9)}).Code(),
	)
	require.Equal(t,
		"21.9 Gwei",
		(&feeTarget{code: accounts.FeeTargetCodeLow, gasPrice: big.NewInt(21.9e9)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"21 Gwei",
		(&feeTarget{code: accounts.FeeTargetCodeLow, gasPrice: big.NewInt(21e9)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"210 Gwei",
		(&feeTarget{code: accounts.FeeTargetCodeLow, gasPrice: big.NewInt(21e10)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"0.123 Gwei",
		(&feeTarget{code: accounts.FeeTargetCodeLow, gasPrice: big.NewInt(0.123e9)}).FormattedFeeRate(),
	)
}
