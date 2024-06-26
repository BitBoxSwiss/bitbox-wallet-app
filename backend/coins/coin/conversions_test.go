// Copyright 2022 Shift Devices AG
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
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestSat2Btc(t *testing.T) {
	require.Equal(t, "1.23456789", coin.Sat2Btc(big.NewRat(123456789, 1)).FloatString(8))
	require.Equal(t, "0.00012345", coin.Sat2Btc(big.NewRat(12345, 1)).FloatString(8))
}

func TestBtc2Sat(t *testing.T) {
	require.Equal(t, "123456789", coin.Btc2Sat(new(big.Rat).SetFloat64(1.23456789)).FloatString(0))
	require.Equal(t, "12345", coin.Btc2Sat(new(big.Rat).SetFloat64(0.00012345)).FloatString(0))
}
