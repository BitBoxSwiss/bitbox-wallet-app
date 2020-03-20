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
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
)

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

// TxStatus is the the status of the tx and helps the frontend show the appropriate information.
type TxStatus string

const (
	// TxStatusPending means the tx is unconfirmed.
	TxStatusPending TxStatus = "pending"
	// TxStatusComplete means the tx is complete, depending on the number of confirmations needed
	// for the respective coin.
	TxStatusComplete TxStatus = "complete"
	// TxStatusFailed means the tx is confirmed but considered failed, e.g. a ETH transaction which
	TxStatusFailed TxStatus = "failed"
)

// AddressAndAmount holds an address and the corresponding amount.
type AddressAndAmount struct {
	Address string
	// Amount is the amount sent to or received on the address in a transaction.
	Amount coin.Amount
	// Ours is true if the address is one of our receive addresses.
	Ours bool
}

// Transaction models a transaction with common transaction info.
type Transaction interface {
	// Fee is nil for a receiving tx. The fee is only displayed (and relevant) when sending funds
	// from the wallet.
	Fee() *coin.Amount

	// Time of confirmation. nil for unconfirmed tx or when the headers are not synced yet.
	Timestamp() *time.Time

	// TxID is the tx ID.
	TxID() string

	// NumConfirmations is the number of confirmations. 0 for unconfirmed.
	NumConfirmations() int

	// NumConfirmationsComplete is the number of confirmations needed for a tx to be considered
	// complete.
	NumConfirmationsComplete() int

	// Status is the tx status. See TxStatus docs for details.
	Status() TxStatus

	// Type returns the type of the transaction.
	Type() TxType

	// Amount is always >0 and is the amount received or sent (not including the fee).
	Amount() coin.Amount

	// Addresses money was sent to / received on.
	Addresses() []AddressAndAmount
}
