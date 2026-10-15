// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"errors"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

func newRegistryAccount(
	initialize func() error,
	closeAccount func(func(observable.Event)),
) (*accountsMocks.InterfaceMock, *func(observable.Event)) {
	var observer func(observable.Event)
	return &accountsMocks.InterfaceMock{
		ConfigFunc: func() *accounts.AccountConfig {
			return &accounts.AccountConfig{Code: "account-code"}
		},
		InitializeFunc: initialize,
		CloseFunc: func() {
			closeAccount(observer)
		},
		ObserveFunc: func(observe func(observable.Event)) func() {
			observer = observe
			return func() {
				observer = nil
			}
		},
	}, &observer
}

func TestAccountRegistryLifecycle(t *testing.T) {
	var initialized, uninitialized []accountsTypes.Code
	registry := newAccountRegistry(accountRegistryLifecycle{
		onInitialized: func(account accounts.Interface) {
			initialized = append(initialized, account.Config().Code)
		},
		onUninitialized: func(account accounts.Interface) {
			uninitialized = append(uninitialized, account.Config().Code)
		},
	})

	var closed bool
	account, observer := newRegistryAccount(
		func() error { return nil },
		func(notify func(observable.Event)) {
			closed = true
			notify(observable.Event{
				Subject: "status",
				Action:  action.Replace,
				Object:  "closed",
			})
		},
	)
	var events []observable.Event
	registry.Observe(func(event observable.Event) {
		events = append(events, event)
	})

	added, err := registry.add(account)
	require.NoError(t, err)
	require.True(t, added)
	require.Equal(t, []accountsTypes.Code{"account-code"}, initialized)
	require.Same(t, account, registry.lookup("account-code"))

	(*observer)(observable.Event{
		Subject: "balance",
		Action:  action.Replace,
		Object:  "updated",
	})
	require.Len(t, events, 1)
	require.Same(t, account, events[0].Object.(accountRegistryEvent).account)
	require.Equal(t, "updated", events[0].Object.(accountRegistryEvent).object)

	require.True(t, registry.remove("account-code"))
	require.True(t, closed)
	require.Equal(t, []accountsTypes.Code{"account-code"}, uninitialized)
	require.Len(t, events, 2, "the final event emitted by Close must be forwarded")
	require.Nil(t, *observer)
	require.Empty(t, registry.all())
}

func TestAccountRegistryRejectsDuplicateCode(t *testing.T) {
	registry := newAccountRegistry(accountRegistryLifecycle{})
	first, _ := newRegistryAccount(
		func() error { return nil },
		func(func(observable.Event)) {},
	)
	secondInitialized := false
	second, _ := newRegistryAccount(
		func() error {
			secondInitialized = true
			return nil
		},
		func(func(observable.Event)) {},
	)

	added, err := registry.add(first)
	require.NoError(t, err)
	require.True(t, added)
	added, err = registry.add(second)
	require.NoError(t, err)
	require.False(t, added)
	require.False(t, secondInitialized)
	require.Len(t, registry.all(), 1)
	require.Same(t, first, registry.lookup("account-code"))
}

func TestAccountRegistryRetainsInitializationFailure(t *testing.T) {
	initializeErr := errors.New("initialize")
	initialized := false
	registry := newAccountRegistry(accountRegistryLifecycle{
		onInitialized: func(accounts.Interface) {
			initialized = true
		},
	})
	account, _ := newRegistryAccount(
		func() error { return initializeErr },
		func(func(observable.Event)) {},
	)

	added, err := registry.add(account)
	require.ErrorIs(t, err, initializeErr)
	require.True(t, added)
	require.False(t, initialized)
	require.Same(t, account, registry.lookup("account-code"))
}
