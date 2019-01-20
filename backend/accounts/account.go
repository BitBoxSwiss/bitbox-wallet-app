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

package accounts

import (
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

// Interface is the API of a Account.
type Interface interface {
	Info() *Info
	// Code is a identifier for the account (to identify the account in databases, apis, etc.).
	Code() string
	Coin() coin.Coin
	// Name returns a human readable long name.
	Name() string
	// Initialize only starts the initialization, the account is not initialized right afterwards.
	Initialize() error
	Initialized() bool
	Offline() bool
	Close()
	Notifier() Notifier
	Transactions() []Transaction
	Balance() *Balance
	// Creates, signs and broadcasts a transaction. Returns keystore.ErrSigningAborted on user
	// abort.
	SendTx(string, coin.SendAmount, FeeTargetCode, map[wire.OutPoint]struct{}, []byte) error
	FeeTargets() ([]FeeTarget, FeeTargetCode)
	TxProposal(string, coin.SendAmount, FeeTargetCode, map[wire.OutPoint]struct{}, []byte) (
		coin.Amount, coin.Amount, coin.Amount, error)
	GetUnusedReceiveAddresses() []Address
	VerifyAddress(addressID string) (bool, error)
	ConvertToLegacyAddress(addressID string) (btcutil.Address, error)
	Keystores() *keystore.Keystores
}

// Info holds account information.
type Info struct {
	SigningConfiguration *signing.Configuration `json:"signingConfiguration"`
}
