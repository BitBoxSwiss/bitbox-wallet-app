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
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
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

func mockCoin(t *testing.T) coinMock.CoinMock {
	t.Helper()
	return coinMock.CoinMock{
		UnitFunc: func(isFee bool) string {
			return "BTC"
		},

		ToUnitFunc: func(amount coin.Amount, isFee bool) float64 {
			result, _ := new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(1e8)).Float64()
			return result
		},
		CodeFunc: func() coin.Code {
			return coin.CodeBTC
		},
		FormatAmountFunc: func(amount coin.Amount, isFee bool) string {
			return new(big.Rat).SetFrac(amount.BigInt(), big.NewInt(1e8)).FloatString(8)
		},
		GetFormatUnitFunc: func(isFee bool) string {
			return "BTC"
		},
	}
}

func TestConversions(t *testing.T) {
	updater := rates.MockRateUpdater()
	defer updater.Stop()
	testCoin := mockCoin(t)

	conversions := coin.Conversions(coin.NewAmountFromInt64(12345678), &testCoin, false, updater)
	require.Equal(t, "2.59", conversions["USD"])
}

func TestConversionsAtTime(t *testing.T) {
	updater := rates.MockRateUpdater()
	defer updater.Stop()
	testCoin := mockCoin(t)

	timestamp := time.Unix(1598832062, 0)
	conversions, estimated := coin.ConversionsAtTime(coin.NewAmountFromInt64(12345678), &testCoin, false, updater, &timestamp)
	require.Equal(t, "0.12", conversions["USD"])
	require.False(t, estimated)

	timestamp = time.Unix(1598922501, 0)
	conversions, estimated = coin.ConversionsAtTime(coin.NewAmountFromInt64(12345678), &testCoin, false, updater, &timestamp)
	require.Equal(t, "0.37", conversions["USD"])
	require.False(t, estimated)

	timestamp = time.Now()
	conversions, estimated = coin.ConversionsAtTime(coin.NewAmountFromInt64(12345678), &testCoin, false, updater, &timestamp)
	require.Equal(t, "2.59", conversions["USD"])
	require.True(t, estimated)
}
