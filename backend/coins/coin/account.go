// Copyright 2018 Shift Devices AG
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

package coin

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin/fee"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
)

// Account contains transfers of the given coin.
type Account interface {
	observable.Interface

	// Configuration at the keypath of the account.
	Configuration() *signing.Configuration

	// Identifier returns the hash of the configuration.
	Identifier() string

	// Coin to which the account belongs.
	Coin() Coin

	// Name returns a human readable long name.
	Name() string

	// KeystoreAvailable returns whether a keystore is available to sign transactions.
	KeystoreAvailable() bool

	// Initialize initializes the account.
	// Be careful when to initialize the account as this can take several seconds.
	Initialize() error

	// Initialized returns whether the account is initialized.
	Initialized() bool

	// Balance returns the total amount of coins in the account.
	// This method may only be called once the account is initialized and panics otherwise.
	Balance() Balance

	// ReceiveAddresses returns unused addresses (just one in case of account-based coins).
	// This method may only be called once the account is initialized and panics otherwise.
	ReceiveAddresses() []AccountAddress

	// ProposeTransaction proposes a transaction with the given outputs and fee level.
	// Please note that for account-based coins, there may only be a single output.
	// Please also note that only one of the outputs may contain a send-all amount.
	// This method may only be called once the account is initialized and panics otherwise.
	ProposeTransaction([]Output, fee.Level) ProposedTransaction

	// HasTransactions returns whether the account contains any transactions.
	// An account that does not contain any transactions can be skipped during recovery.
	// This method may only be called once the account is initialized and panics otherwise.
	HasTransactions() bool

	// TODO: Add from and to indexes for pagination and filters to the following methods.

	// ProposedTransactions returns all transactions that have been proposed but not yet broadcast.
	// This method may only be called once the account is initialized and panics otherwise.
	ProposedTransactions() []ProposedTransaction

	// PendingTransfers returns all transfers that have been broadcast but not yet confirmed.
	// This method may only be called once the account is initialized and panics otherwise.
	PendingTransfers() []PendingTransfer

	// ConfirmedTransfers returns all transfers that have been confirmed by the network.
	// This method may only be called once the account is initialized and panics otherwise.
	ConfirmedTransfers() []ConfirmedTransfer
}
