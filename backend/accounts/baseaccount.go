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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// BaseAccount is an account struct with common functionality to all coin accounts.
type BaseAccount struct {
	observable.Implementation
	Synchronizer *synchronizer.Synchronizer
	OnEvent      func(Event)

	code string
	name string

	// synced indicates whether the account has loaded and finished the initial sync of the
	// addresses.
	synced      bool
	keystores   *keystore.Keystores
	rateUpdater *rates.RateUpdater

	offline bool
}

// NewBaseAccount creates a new Account instance.
func NewBaseAccount(
	code string,
	name string,
	keystores *keystore.Keystores,
	onEvent func(Event),
	rateUpdater *rates.RateUpdater,
	log *logrus.Entry,
) *BaseAccount {
	account := &BaseAccount{
		code:        code,
		name:        name,
		keystores:   keystores,
		OnEvent:     onEvent,
		synced:      false,
		rateUpdater: rateUpdater,
	}
	account.Synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(EventSyncStarted) },
		func() {
			if !account.synced {
				account.synced = true
				onEvent(EventStatusChanged)
			}
			onEvent(EventSyncDone)
		},
		log,
	)
	return account
}

// Code implements Interface.
func (account *BaseAccount) Code() string {
	return account.code
}

// Name implements Interface.
func (account *BaseAccount) Name() string {
	return account.name
}

// Synced implements Interface.
func (account *BaseAccount) Synced() bool {
	return account.synced
}

// Close stops the account.
func (account *BaseAccount) Close() {
	account.synced = false
}

// Keystores implements Interface.
func (account *BaseAccount) Keystores() *keystore.Keystores {
	return account.keystores
}

// ResetSynced sets synced to false.
func (account *BaseAccount) ResetSynced() {
	account.synced = false
}

// RateUpdater implement Interface, currently just returning a dummy value.
func (account *BaseAccount) RateUpdater() *rates.RateUpdater {
	return account.rateUpdater
}

// Offline implements Interface.
func (account *BaseAccount) Offline() bool {
	return account.offline
}

// SetOffline sets the account offline status and emits the EventStatusChanged() if the status
// changed.
func (account *BaseAccount) SetOffline(offline bool) {
	wasOffline := account.offline
	account.offline = offline
	if wasOffline != offline {
		account.OnEvent(EventStatusChanged)
	}
}
