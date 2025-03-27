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

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/notes"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/btcsuite/btcd/wire"
)

// AddressList is a list of addresses.
type AddressList struct {
	// ScriptType is the Bitcoin script type in case the addresses are of a Bitcoin simple type. Nil
	// otherwise.
	ScriptType *signing.ScriptType
	Addresses  []Address
}

// TextMemo represents a slip-0024 text memo.
type TextMemo struct {
	Note string
}

// PaymentRequest contains the data needed to fulfill a slip-0024 payment request.
// Text memos are the only memo type supported, currently.
type PaymentRequest struct {
	RecipientName string
	Memos         []TextMemo
	Nonce         []byte
	TotalAmount   uint64
	Signature     []byte
}

// TxProposalArgs are the arguments needed when creating a tx proposal.
type TxProposalArgs struct {
	RecipientAddress string
	Amount           coin.SendAmount
	FeeTargetCode    FeeTargetCode
	// Only applies if FeeTargetCode == Custom. It is provided in sat/vB for BTC/LTC and Gwei for ETH.
	CustomFee string
	// Option to always use the highest fee rate without specifying FeeTargetCode or CustomFee
	UseHighestFee  bool
	SelectedUTXOs  map[wire.OutPoint]struct{}
	Note           string
	PaymentRequest *PaymentRequest
}

// Interface is the API of a Account.
//
//go:generate moq -pkg mocks -out mocks/account.go . Interface
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
	// If there was a network connection issue, this returns the network error.
	Offline() error
	// FatalError indicates that there was a fatal error in handling the account. When this happens,
	// an error is shown to the user and the account is made unusable.
	FatalError() bool
	Close()
	Notifier() Notifier
	// Must enforce that initial sync is done before returning.
	Transactions() (OrderedTransactions, error)
	// Must enforce that initial sync is done before returning.
	Balance() (*Balance, error)
	// SendTx signs and sends the active tx proposal, set by TxProposal. Errors if none
	// available.
	SendTx(txNote string) error
	FeeTargets() ([]FeeTarget, FeeTargetCode)
	TxProposal(*TxProposalArgs) (coin.Amount, coin.Amount, coin.Amount, error)
	// GetUnusedReceiveAddresses gets a list of list of receive addresses. The result can be one
	// list of addresses, or if there are multiple types of addresses (e.g. `bc1...` vs `3...`), a
	// list of lists.
	GetUnusedReceiveAddresses() []AddressList
	CanVerifyAddresses() (bool, bool, error)
	VerifyAddress(addressID string) (bool, error)

	Notes() *notes.Notes
	TxNote(txID string) string
	// SetTxNote sets a tx note and refreshes the account.
	SetTxNote(txID string, note string) error

	// ExportCSV exports the given transaction in CSV format (comma-separated).
	ExportCSV(w io.Writer, transactions []*TransactionData) error
}

// Info holds account information.
type Info struct {
	SigningConfigurations []*signing.Configuration `json:"signingConfigurations"`
}
