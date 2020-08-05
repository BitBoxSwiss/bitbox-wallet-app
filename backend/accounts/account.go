// Copyright 2018 Shift Devices AG
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
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/notes"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/safello"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
)

// AddressList is a list of addresses.
type AddressList []Address

// Interface is the API of a Account.
type Interface interface {
	observable.Interface

	Info() *Info
	Config() *AccountConfig
	// FilesFolder is path to a directory for account files, like databases, etc. Only available
	// after Initialize(). It must be unique not only up to the type, but also the exact
	// keystores/signing configuration (e.g. a btc-p2wpkh account for one xpub/xprv should have a
	// different ID).
	FilesFolder() string
	Coin() coin.Coin
	// Initialize only starts the synchronization, the account is not synced right afterwards.
	Initialize() error
	// Synced indicates whether the account has loaded and finished the initial sync.
	Synced() bool
	Offline() bool
	FatalError() bool
	Close()
	Notifier() Notifier
	Transactions() ([]Transaction, error)
	Balance() (*Balance, error)
	// SendTx signs and sends the active tx proposal, set by TxProposal. Errors if none available.
	SendTx() error
	FeeTargets() ([]FeeTarget, FeeTargetCode)
	TxProposal(string, coin.SendAmount, FeeTargetCode, map[wire.OutPoint]struct{}, []byte, string) (
		coin.Amount, coin.Amount, coin.Amount, error)
	// GetUnusedReceiveAddresses gets a list of list of receive addresses. The result can be one
	// list of addresses, or if there are multiple types of addresses (e.g. `bc1...` vs `3...`), a
	// list of lists.
	GetUnusedReceiveAddresses() []AddressList
	CanVerifyAddresses() (bool, bool, error)
	VerifyAddress(addressID string) (bool, error)

	// SafelloBuySupported returns true if the Safello Buy widget can be used with this account.
	SafelloBuySupported() bool
	// Safello returns the infos needed to load the Safello Buy widget. panics() if Safello is not
	// supported for this coin. Check support with `SafelloBuySupported()` before calling this.
	SafelloBuy() *safello.Buy

	Notes() *notes.Notes
	// SetTxNote sets a tx note and refreshes the account.
	SetTxNote(txID string, note string) error
}

// Info holds account information.
type Info struct {
	SigningConfigurations []*signing.Configuration `json:"signingConfigurations"`
}
