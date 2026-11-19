// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

// Sync and rate updates refresh frontend amounts. Only sync completion triggers new-transaction
// checks.
func TestAccountSyncAndRateEvents(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	defer backend.Close()
	account := &accountsMocks.InterfaceMock{
		ConfigFunc: func() *accounts.AccountConfig {
			return &accounts.AccountConfig{Code: "test-account"}
		},
		NotifierFunc: func() accounts.Notifier { return nil },
	}
	var events []observable.Event
	unobserve := backend.Observe(func(event observable.Event) {
		events = append(events, event)
	})
	defer unobserve()
	frontendEvent := observable.Event{Subject: "account/test-account/sync-done", Action: action.Replace}

	backend.handleAccountRegistryEvent(observable.Event{
		Subject: string(accountsTypes.EventRatesChanged),
		Action:  action.Replace,
		Object:  accountRegistryEvent{account: account},
	})
	require.Equal(t, []observable.Event{frontendEvent}, events)
	require.Empty(t, account.NotifierCalls())

	events = nil
	backend.handleAccountRegistryEvent(observable.Event{
		Subject: string(accountsTypes.EventSyncDone),
		Action:  action.Replace,
		Object:  accountRegistryEvent{account: account},
	})
	require.Equal(t, []observable.Event{frontendEvent}, events)
	require.Len(t, account.NotifierCalls(), 1)
}
