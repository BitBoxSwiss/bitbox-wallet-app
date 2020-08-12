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
		Code:                     "test",
		Name:                     "Test",
		DBFolder:                 test.TstTempDir("baseaccount_test_dbfolder"),
		NotesFolder:              test.TstTempDir("baseaccount_test_notesfolder"),
		Keystores:                nil,
		OnEvent:                  func(event Event) { events <- event },
		RateUpdater:              nil,
		GetSigningConfigurations: nil,
		GetNotifier:              nil,
	}
	account := NewBaseAccount(cfg, logging.Get().WithGroup("baseaccount_test"))
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
		require.False(t, account.Offline())
		account.SetOffline(true)
		require.True(t, account.Offline())
		require.Equal(t, EventStatusChanged, checkEvent())
		account.SetOffline(false)
		require.False(t, account.Offline())
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
}
