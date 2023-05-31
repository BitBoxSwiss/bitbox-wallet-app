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
	"encoding/json"
	"math/big"
	"sort"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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

// TxStatus is the status of the tx and helps the frontend show the appropriate information.
type TxStatus string

const (
	// TxStatusPending means the tx is unconfirmed.
	TxStatusPending TxStatus = "pending"
	// TxStatusComplete means the tx is complete, depending on the number of confirmations needed
	// for the respective coin.
	TxStatusComplete TxStatus = "complete"
	// TxStatusFailed means the tx is confirmed but considered failed, e.g. a ETH transaction with a
	// too low gas limit.
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

// TransactionData holds transaction data to be shown to the user. It is as coin-agnostic as
// possible, but contains some fields that are only used by certain coins.
type TransactionData struct {
	// Fee is nil for a receiving tx. The fee is only displayed (and relevant) when sending funds
	// from the wallet.
	Fee *coin.Amount
	// FeeIsDifferentUnit is true if the fee is paid in a different unit than the main transaction
	// amount. Example: ERC20-tokens fees are paid in ETH.
	// When true, the fee amount does not count towards the balance of the account associated with
	// the transaction, but another account (e.g. counts towards the ETH account if the tx is an
	// ERC20-token account).
	FeeIsDifferentUnit bool
	// Time of confirmation. nil for unconfirmed tx or when the headers are not synced yet.
	Timestamp *time.Time
	// TxID is the tx ID.
	TxID string
	// InternalID is an ID for identifying this transaction. Usually it is the same as TxID(), but
	// e.g. in Ethereum, there can be multiple transaction entries for the same transaction ID
	// (e.g. an internal/smart contract tx shown semantically, as well as the raw zero value
	// contract execution tx).
	InternalID string
	// Height is the block number at which this tx confirmed, or 0 if unconfirmed. -1 if unconfirmed
	// with an unconfirmed parent.
	Height int
	// NumConfirmations is the number of confirmations. 0 for unconfirmed.
	NumConfirmations int
	// NumConfirmationsComplete is the number of confirmations needed for a tx to be considered
	// complete.
	NumConfirmationsComplete int
	// Status is the tx status. See TxStatus docs for details.
	Status TxStatus
	// Type returns the type of the transaction.
	Type TxType
	// Amount is always >0 and is the amount received or sent (not including the fee).
	Amount coin.Amount
	// Balance is balance of the account at the time of this transaction. It is the sum of all
	// transactions up to this point.
	// This value is only valid as part of `OrderedTransactions`.
	Balance coin.Amount

	// Addresses money was sent to / received on.
	Addresses []AddressAndAmount

	// --- Fields only used by BTC follow:

	// FeeRatePerKb is the fee rate of the tx (fee / tx size).
	FeeRatePerKb *btcutil.Amount
	// VSize is the tx virtual size in
	// "vbytes". https://bitcoincore.org/en/segwit_wallet_dev/#transaction-fee-estimation
	VSize int64
	// Size is the serialized tx size in bytes.
	Size int64
	// Weight is the tx weight.
	Weight           int64
	CreatedTimestamp *time.Time

	// --- Fields only used for ETH follow

	Gas     uint64
	Nonce   *uint64
	IsErc20 bool
}

// isConfirmed returns true if the transaction has at least one confirmation.
func (tx *TransactionData) isConfirmed() bool {
	return tx.Height > 0
}

// byHeight defines the methods needed to satisify sort.Interface to sort transactions by their
// height. Special case for unconfirmed transactions (height <=0), which come last. If the height
// is the same for two txs, they are sorted by the created (first seen) time instead.
type byHeight []*TransactionData

func (s byHeight) Len() int { return len(s) }
func (s byHeight) Less(i, j int) bool {
	// Secondary sort by the time we've first seen the tx in the app.
	if s[i].Height == s[j].Height && s[i].CreatedTimestamp != nil && s[j].CreatedTimestamp != nil {
		return s[i].CreatedTimestamp.Before(*s[j].CreatedTimestamp)
	}
	if s[j].Height <= 0 {
		return true
	}
	if s[i].Height <= 0 {
		return false
	}
	return s[i].Height < s[j].Height
}
func (s byHeight) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

// OrderedTransactions is a list of transactions sorted from newest to oldest.
type OrderedTransactions []*TransactionData

// NewOrderedTransactions sorts the transactions from newest to oldest.
// The input list is modified in place and must not be used anymore after calling this function.
func NewOrderedTransactions(txs []*TransactionData) OrderedTransactions {
	sort.Sort(sort.Reverse(byHeight(txs)))

	balance := big.NewInt(0)
	for i := len(txs) - 1; i >= 0; i-- {
		tx := txs[i]
		switch tx.Type {
		case TxTypeReceive:
			balance.Add(balance, tx.Amount.BigInt())
		case TxTypeSend:
			balance.Sub(balance, tx.Amount.BigInt())
			// Subtract fee as well.
			if tx.Fee != nil && !tx.FeeIsDifferentUnit {
				balance.Sub(balance, tx.Fee.BigInt())
			}
		case TxTypeSendSelf:
			// Subtract only fee.
			if tx.Fee != nil && !tx.FeeIsDifferentUnit {
				balance.Sub(balance, tx.Fee.BigInt())
			}
		}
		tx.Balance = coin.NewAmount(balance)
	}
	return txs
}

// TimeseriesEntry contains the balance of the account at the given time.
type TimeseriesEntry struct {
	Time  time.Time
	Value coin.Amount
}

// MarshalJSON serializes the entry as JSON.
func (c *TimeseriesEntry) MarshalJSON() ([]byte, error) {
	value, err := c.Value.Int64()
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Time  int64 `json:"time"`
		Value int64 `json:"value"`
	}{
		Time:  c.Time.Unix(),
		Value: value,
	})
}

// EarliestTime returns the timestamp of the latest transaction. Zero is returned if there is no
// transaction with a timestamp. Returns `errors.ErrNotAvailable` if timestamp data is missing.
func (txs OrderedTransactions) EarliestTime() (time.Time, error) {
	if len(txs) > 0 {
		tx := txs[len(txs)-1]
		if tx.Timestamp != nil {
			return *tx.Timestamp, nil
		}
		if tx.isConfirmed() {
			return time.Time{}, errp.WithStack(errors.ErrNotAvailable)
		}
	}
	return time.Time{}, nil
}

// Timeseries chunks the time between `start` and `end` into steps of `interval` duration, and
// provides the balance of the account at each step.
func (txs OrderedTransactions) Timeseries(
	start, end time.Time, interval time.Duration) ([]TimeseriesEntry, error) {
	for _, tx := range txs {
		if tx.isConfirmed() && tx.Timestamp == nil {
			return nil, errp.WithStack(errors.ErrNotAvailable)
		}
	}
	currentTime := start
	if currentTime.IsZero() {
		return nil, nil
	}

	result := []TimeseriesEntry{}
	for {
		// Find the latest tx before `currentTime`.
		nextIndex := sort.Search(len(txs), func(idx int) bool {
			tx := txs[idx]
			if !tx.isConfirmed() {
				return false
			}
			return tx.Timestamp.Before(currentTime) || tx.Timestamp.Equal(currentTime)
		})
		var value coin.Amount
		if nextIndex == len(txs) {
			value = coin.NewAmountFromInt64(0)
		} else {
			value = txs[nextIndex].Balance
		}

		result = append(result, TimeseriesEntry{
			Time:  currentTime,
			Value: value,
		})

		currentTime = currentTime.Add(interval)
		if currentTime.After(end) {
			break
		}
	}
	return result, nil
}
