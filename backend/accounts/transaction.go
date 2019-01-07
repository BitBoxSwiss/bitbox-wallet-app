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

	coin "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/common"
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

// Transaction models a transaction with common transaction info.
type Transaction interface {
	// Fee is nil for a receiving tx. The fee is only displayed (and relevant) when sending funds
	// from the wallet.
	Fee() *coin.Amount

	// Time of confirmation. nil for unconfirmed tx or when the headers are not synced yet.
	Timestamp() *time.Time

	// ID is the tx ID.
	ID() string

	// NumConfirmations is the number of confirmations. 0 for unconfirmed.
	NumConfirmations() int

	// Type returns the type of the transaction.
	Type() TxType

	// Amount is always >0 and is the amount received or sent (not including the fee).
	Amount() coin.Amount

	// Addresses money was sent to / received on.
	Addresses() []string
}
