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
	"io"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/notes"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/safello"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
)

// AddressList is a list of addresses.
type AddressList []Address

// TxProposalArgs are the arguments needed when creating a tx proposal.
type TxProposalArgs struct {
	RecipientAddress string
	Amount           coin.SendAmount
	// Only applies to BTC/LTC.
	FeeTargetCode FeeTargetCode
	// Only applies to BTC/LTC and if FeeTargetCode == Custom. Technically it is vKb (virtual Kb)
	// since fees are computed from a transaction's weight (measured in weight units or virtual
	// bytes), but we keep the `Kb` unit to be consistent with the rest of the codebase and Bitcoin
	// Core.
	FeePerKb      btcutil.Amount
	SelectedUTXOs map[wire.OutPoint]struct{}
	Data          []byte
	Note          string
}

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
	// Must enforce that initial sync is done before returning.
	Transactions() (OrderedTransactions, error)
	// Must enforce that initial sync is done before returning.
	Balance() (*Balance, error)
	// SendTx signs and sends the active tx proposal, set by TxProposal. Errors if none
	// available. The note, if set by ProposeTxNote(), is persisted for the transaction.
	SendTx() error
	FeeTargets() ([]FeeTarget, FeeTargetCode)
	TxProposal(*TxProposalArgs) (coin.Amount, coin.Amount, coin.Amount, error)
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
	// ProposeTxnote stores a note. The note is is persisted in the notes database upon calling
	// SendTx(). This function must be called before `SendTx()`.
	ProposeTxNote(string)
	// SetTxNote sets a tx note and refreshes the account.
	SetTxNote(txID string, note string) error

	// ExportCSV exports the given transaction in CSV format (comma-separated).
	ExportCSV(w io.Writer, transactions []*TransactionData) error
}

// Info holds account information.
type Info struct {
	SigningConfigurations []*signing.Configuration `json:"signingConfigurations"`
}
