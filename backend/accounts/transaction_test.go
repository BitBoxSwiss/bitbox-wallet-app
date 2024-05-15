// Copyright 2020 Shift Crypto AG
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

package accounts

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestOrderedTransactions(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	fee := coin.NewAmountFromInt64(1)
	txs := []*TransactionData{
		{
			Timestamp: tt(time.Date(2020, 9, 15, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 10, 12, 0, 0, 0, time.UTC)),
			Height:    10,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(200),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 20, 12, 0, 0, 0, time.UTC)),
			Height:    20,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(300),
		},
		{
			Timestamp: nil,
			Height:    0,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(20),
		},
		{
			Timestamp: nil,
			Height:    -1, // unconfirmed parent
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(20),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 11, 12, 0, 0, 0, time.UTC)),
			Height:    11,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(10),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 21, 12, 0, 0, 0, time.UTC)),
			Height:    21,
			Type:      TxTypeSendSelf,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
		},
		{
			Timestamp:          tt(time.Date(2020, 9, 22, 12, 0, 0, 0, time.UTC)),
			Height:             220,
			Type:               TxTypeSend,
			Amount:             coin.NewAmountFromInt64(5),
			Fee:                &fee,
			FeeIsDifferentUnit: true,
		},
	}
	ordered := NewOrderedTransactions(txs)
	require.Equal(t, coin.NewAmountFromInt64(544), ordered[0].Balance)
	require.Equal(t, coin.NewAmountFromInt64(564), ordered[1].Balance)
	require.Equal(t, coin.NewAmountFromInt64(584), ordered[2].Balance)
	require.Equal(t, coin.NewAmountFromInt64(589), ordered[3].Balance)
	require.Equal(t, coin.NewAmountFromInt64(590), ordered[4].Balance)
	require.Equal(t, coin.NewAmountFromInt64(290), ordered[5].Balance)
	require.Equal(t, coin.NewAmountFromInt64(190), ordered[6].Balance)
	require.Equal(t, coin.NewAmountFromInt64(200), ordered[7].Balance)

	timeseries, err := ordered.Timeseries(
		time.Date(2020, 9, 9, 13, 0, 0, 0, time.UTC),
		time.Date(2020, 9, 21, 13, 0, 0, 0, time.UTC),
		24*time.Hour,
	)
	require.NoError(t, err)
	require.Equal(t, []TimeseriesEntry{
		{
			Time:  time.Date(2020, 9, 9, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(0),
		},
		{
			Time:  time.Date(2020, 9, 10, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(200),
		},
		{
			Time:  time.Date(2020, 9, 11, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 12, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 13, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 14, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(190),
		},
		{
			Time:  time.Date(2020, 9, 15, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 16, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 17, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 18, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 19, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(290),
		},
		{
			Time:  time.Date(2020, 9, 20, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(590),
		},
		{
			Time:  time.Date(2020, 9, 21, 13, 0, 0, 0, time.UTC),
			Value: coin.NewAmountFromInt64(589),
		},
	}, timeseries)
}

// TestOrderedTransactionsWithFailedTransactions tests that the cumulative balance takes into
// account failed transactions.  Ethereum transactions can be mined and fail anyway due to a too low
// gas limit, in which case the amount is not transferred, but the fees are still paid.
func TestOrderedTransactionsWithFailedTransactions(t *testing.T) {
	tt := func(t time.Time) *time.Time { return &t }
	fee := coin.NewAmountFromInt64(1)
	txs := []*TransactionData{
		{
			Timestamp: tt(time.Date(2020, 9, 15, 12, 0, 0, 0, time.UTC)),
			Height:    15,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(100),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 10, 12, 0, 0, 0, time.UTC)),
			Height:    10,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(200),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 20, 12, 0, 0, 0, time.UTC)),
			Height:    20,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(300),
		},
		{
			Timestamp: tt(time.Date(2020, 9, 21, 12, 0, 0, 0, time.UTC)),
			Height:    21,
			Type:      TxTypeSendSelf,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
		},
		{
			Timestamp: tt(time.Date(2020, 9, 22, 12, 0, 0, 0, time.UTC)),
			Height:    22,
			Type:      TxTypeSend,
			Amount:    coin.NewAmountFromInt64(50),
			Fee:       &fee,
			Status:    TxStatusFailed,
		},
		{
			Timestamp: tt(time.Date(2020, 9, 23, 12, 0, 0, 0, time.UTC)),
			Height:    23,
			Type:      TxTypeReceive,
			Amount:    coin.NewAmountFromInt64(1000),
			Fee:       &fee,
			Status:    TxStatusFailed,
		},
	}

	ordered := NewOrderedTransactions(txs)
	expectedBalances := []int64{
		598, // failed receive tx, nothing changes
		598, // failed send tx, only fee deducted
		599,
		600,
		300,
		200,
	}
	for i := range ordered {
		require.Equal(t, coin.NewAmountFromInt64(expectedBalances[i]), ordered[i].Balance, i)
	}
}
