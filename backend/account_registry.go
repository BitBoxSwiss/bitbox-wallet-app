// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
)

type accountRegistryLifecycle struct {
	onInitialized   func(accounts.Interface)
	onUninitialized func(accounts.Interface)
}

type accountRegistryEvent struct {
	account accounts.Interface
	object  interface{}
}

// accountRegistry owns loaded account membership, observation, and lifecycle.
//
// Backend.accountsAndKeystoreLock guards all access.
type accountRegistry struct {
	observable.Implementation

	accounts   AccountsList
	lifecycle  accountRegistryLifecycle
	unobserves map[accountsTypes.Code]func()
}

func newAccountRegistry(lifecycle accountRegistryLifecycle) accountRegistry {
	return accountRegistry{
		accounts:   AccountsList{},
		lifecycle:  lifecycle,
		unobserves: map[accountsTypes.Code]func(){},
	}
}

func (registry *accountRegistry) all() AccountsList {
	return slices.Clone(registry.accounts)
}

func (registry *accountRegistry) lookup(code accountsTypes.Code) accounts.Interface {
	return registry.accounts.lookup(code)
}

// add registers and initializes an account unless its code is already present. Initialization
// failures leave the account registered, matching the previous backend behavior.
func (registry *accountRegistry) add(account accounts.Interface) (bool, error) {
	code := account.Config().Code
	if registry.lookup(code) != nil {
		return false, nil
	}

	registry.accounts = append(registry.accounts, account)
	registry.unobserves[code] = account.Observe(func(event observable.Event) {
		registry.Notify(observable.Event{
			Subject: event.Subject,
			Action:  event.Action,
			Object: accountRegistryEvent{
				account: account,
				object:  event.Object,
			},
		})
	})

	if err := account.Initialize(); err != nil {
		return true, err
	}
	if registry.lifecycle.onInitialized != nil {
		registry.lifecycle.onInitialized(account)
	}
	return true, nil
}

func (registry *accountRegistry) remove(code accountsTypes.Code) bool {
	for index, account := range registry.accounts {
		if account.Config().Code != code {
			continue
		}

		registry.closeAccount(account)
		registry.accounts = slices.Delete(registry.accounts, index, index+1)
		return true
	}
	return false
}

func (registry *accountRegistry) closeAccount(account accounts.Interface) {
	if registry.lifecycle.onUninitialized != nil {
		registry.lifecycle.onUninitialized(account)
	}
	account.Close()

	code := account.Config().Code
	if unobserve := registry.unobserves[code]; unobserve != nil {
		// Close may emit a final status event.
		unobserve()
	}
	delete(registry.unobserves, code)
}
