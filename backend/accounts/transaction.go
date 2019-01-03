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

import "time"

// TxType is a type of transaction. See the TxType* constants.
type TxType string

const (
	// TxTypeReceive is a tx which sends funds to our account.
	TxTypeReceive TxType = "receive"
	// TxTypeSend is a tx which sends funds out of our account.
	TxTypeSend TxType = "send"
	// TxTypeSendSelf is a tx from out account to our account.
	TxTypeSendSelf TxType = "sendSelf"
)

// Transaction models a transaction with common transaction info.
type Transaction interface {
	// Fee is nil for a receiving tx. The fee is only displayed (and relevant) when sending funds
	// from the wallet.
	Fee() *Amount

	// Time of confirmation. nil for unconfirmed tx or when the headers are not synced yet.
	Timestamp() *time.Time

	// ID is the tx ID.
	ID() string

	// NumConfirmations is the number of confirmations. 0 for unconfirmed.
	NumConfirmations() int

	// Type returns the type of the transaction.
	Type() TxType

	// Amount is always >0 and is the amount received or sent (not including the fee).
	Amount() Amount

	// Addresses money was sent to / received on.
	Addresses() []string
}

// ProposedTransaction models a proposed but not yet fully signed transaction of the given coin.
type ProposedTransaction interface {
	// Coin() Coin
	// Fee() uint64
	// Inputs() []Input // Needed or rather make "private" (within implementation)?
	// Outputs() []Output

	// // ChangeAddress can be nil for account-based blockchains.
	// ChangeAddress() WalletAddress

	// // AccountConfiguration returns the configuration of the account whose inputs are spent.
	// AccountConfiguration() *signing.Configuration

	// // IsFullySigned returns whether each input is signed by the required amount of cosigners.
	// IsFullySigned() bool

	// // MakeSignedTransaction makes a signed transaction from the fully signed proposed transaction.
	// // Please note that this does not work for off-chain transactions.
	// MakeSignedTransaction() (SignedTransaction, error)
}
