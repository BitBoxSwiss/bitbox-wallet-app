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
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestBaseAccount(t *testing.T) {
	events := make(chan Event, 100)
	checkEvent := func() Event {
		select {
		case ev := <-events:
			return ev
		case <-time.After(time.Second):
			require.Fail(t, "expected event was not fired")
		}
		panic("can't reach")
	}
	const accountIdentifier = "test-account-identifier"
	cfg := &AccountConfig{
		Code:                  "test",
		Name:                  "Test",
		DBFolder:              test.TstTempDir("baseaccount_test_dbfolder"),
		NotesFolder:           test.TstTempDir("baseaccount_test_notesfolder"),
		Keystores:             nil,
		OnEvent:               func(event Event) { events <- event },
		RateUpdater:           nil,
		SigningConfigurations: nil,
		GetNotifier:           nil,
	}

	mockCoin := &mocks.CoinMock{
		SmallestUnitFunc: func() string {
			return "satoshi"
		},
	}
	account := NewBaseAccount(cfg, mockCoin, logging.Get().WithGroup("baseaccount_test"))
	require.NoError(t, account.Initialize(accountIdentifier))

	t.Run("config", func(t *testing.T) {
		require.Equal(t, cfg, account.Config())

	})

	t.Run("synchronizer", func(t *testing.T) {
		require.False(t, account.Synced())
		done := account.Synchronizer.IncRequestsCounter()
		require.Equal(t, EventSyncStarted, checkEvent())
		require.False(t, account.Synced())
		done()
		require.Equal(t, EventStatusChanged, checkEvent()) // synced changed
		require.Equal(t, EventSyncDone, checkEvent())
		require.True(t, account.Synced())

		// no status changed event when syncing again (syncing is already true)
		done = account.Synchronizer.IncRequestsCounter()
		require.Equal(t, EventSyncStarted, checkEvent())
		done()
		require.Equal(t, EventSyncDone, checkEvent())

		account.ResetSynced()
		require.False(t, account.Synced())
		account.ResetSynced()
		require.False(t, account.Synced())
	})

	t.Run("offline", func(t *testing.T) {
		require.NoError(t, account.Offline())
		account.SetOffline(errors.New("error"))
		require.Error(t, account.Offline())
		require.Equal(t, EventStatusChanged, checkEvent())
		account.SetOffline(nil)
		require.NoError(t, account.Offline())
		require.Equal(t, EventStatusChanged, checkEvent())
	})

	t.Run("notes", func(t *testing.T) {
		require.Equal(t, "", account.GetAndClearProposedTxNote())
		account.ProposeTxNote("test note")
		require.Equal(t, "test note", account.GetAndClearProposedTxNote())
		// Was cleared by the previous call.
		require.Equal(t, "", account.GetAndClearProposedTxNote())

		notes := account.Notes()
		require.NotNil(t, notes)

		require.NoError(t, account.SetTxNote("test-tx-id", "another test note"))
		require.Equal(t, EventStatusChanged, checkEvent())
		require.Equal(t, "another test note", notes.TxNote("test-tx-id"))
	})

	t.Run("exportCSV", func(t *testing.T) {
		export := func(transactions []*TransactionData) string {
			var result bytes.Buffer
			require.NoError(t, account.ExportCSV(&result, transactions))
			return result.String()
		}

		const header = "Time,Type,Amount,Unit,Fee,Address,Transaction ID,Note\n"

		require.Equal(t, header, export(nil))

		require.NoError(t, account.notes.SetTxNote("some-internal-tx-id", "some note, with a comma"))
		fee := coin.NewAmountFromInt64(101)
		timestamp := time.Date(2020, 2, 30, 16, 44, 20, 0, time.UTC)
		require.Equal(t,
			header+
				`2020-03-01T16:44:20Z,sent,123,satoshi,101,some-address,some-tx-id,"some note, with a comma"
2020-03-01T16:44:20Z,sent_to_yourself,456,satoshi,,another-address,some-tx-id,"some note, with a comma"
`,
			export([]*TransactionData{
				{
					Type:       TxTypeSend,
					TxID:       "some-tx-id",
					InternalID: "some-internal-tx-id",
					Fee:        &fee,
					Timestamp:  &timestamp,
					Addresses: []AddressAndAmount{
						{
							Address: "some-address",
							Amount:  coin.NewAmountFromInt64(123),
							Ours:    false,
						},
						{
							Address: "another-address",
							Amount:  coin.NewAmountFromInt64(456),
							Ours:    true,
						},
					},
				},
			}))

	})
}
