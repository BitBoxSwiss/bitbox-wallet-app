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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// AccountConfig holds account configuration.
type AccountConfig struct {
	// Code is an identifier for the account *type* (part of account database filenames, apis, etc.).
	// Type as in btc-p2wpkh, eth-erc20-usdt, etc.
	Code string
	// Name returns a human readable long name.
	Name string
	// DBFolder is the folder for all accounts. Full path.
	DBFolder                 string
	Keystores                *keystore.Keystores
	OnEvent                  func(Event)
	RateUpdater              *rates.RateUpdater
	GetSigningConfigurations func() (signing.Configurations, error)
}

// BaseAccount is an account struct with common functionality to all coin accounts.
type BaseAccount struct {
	observable.Implementation
	Synchronizer *synchronizer.Synchronizer

	config *AccountConfig

	// synced indicates whether the account has loaded and finished the initial sync of the
	// addresses.
	synced  bool
	offline bool
}

// NewBaseAccount creates a new Account instance.
func NewBaseAccount(config *AccountConfig, log *logrus.Entry) *BaseAccount {
	account := &BaseAccount{
		config: config,
	}
	account.Synchronizer = synchronizer.NewSynchronizer(
		func() { config.OnEvent(EventSyncStarted) },
		func() {
			if !account.synced {
				account.synced = true
				config.OnEvent(EventStatusChanged)
			}
			config.OnEvent(EventSyncDone)
		},
		log,
	)
	return account
}

// Config implements Interface.
func (account *BaseAccount) Config() *AccountConfig {
	return account.config
}

// Synced implements Interface.
func (account *BaseAccount) Synced() bool {
	return account.synced
}

// Close stops the account.
func (account *BaseAccount) Close() {
	account.synced = false
}

// ResetSynced sets synced to false.
func (account *BaseAccount) ResetSynced() {
	account.synced = false
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
		account.config.OnEvent(EventStatusChanged)
	}
}
