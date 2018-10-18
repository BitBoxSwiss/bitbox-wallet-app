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
	"math/big"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// Amount represents an amount in the smallest coin unit (e.g. satoshi).
type Amount struct {
	// Invariant: The number is non-negative.
	number *big.Int
}

// NewAmount creates a new amount by copying the given amount.
// Precondition: The given amount has to be non-negative.
func NewAmount(amount *big.Int) Amount {
	if amount.Sign() < 0 {
		panic("The amount has to be non-negative.")
	}
	return Amount{number: new(big.Int).Set(amount)}
}

// NewAmountFromInt64 creates a new amount.
// Precondition: The given amount has to be non-negative.
func NewAmountFromInt64(amount int64) Amount {
	if amount < 0 {
		panic("The amount has to be non-negative.")
	}
	return Amount{number: big.NewInt(amount)}
}

// NewAmountFromString parses the user-given amount, converting it from the default coin unit to the
// smallest unit.
// Precondition: The given unit has to be positive.
func NewAmountFromString(amount string, unit *big.Int) (Amount, error) {
	if unit.Sign() <= 0 {
		panic("The unit has to be positive.")
	}
	// big.Rat parsing accepts rationals like "2/3". Exclude those, we only want decimals.
	if strings.ContainsRune(amount, '/') {
		return Amount{}, errp.Newf("The amount %q may not contain a fraction.", amount)
	}
	rat, ok := new(big.Rat).SetString(amount)
	if !ok {
		return Amount{}, errp.Newf("Could not parse the amount %q.", amount)
	}
	if rat.Sign() < 0 {
		return Amount{}, errp.Newf("The amount %q may not be negative.", amount)
	}
	rat.Mul(rat, new(big.Rat).SetInt(unit))
	if rat.Denom().Cmp(big.NewInt(1)) != 0 {
		return Amount{}, errp.Newf("The amount %q cannot be represented in the given unit.", amount)
	}
	return Amount{number: rat.Num()}, nil
}

// Int64 returns the int64 representation of the amount.
// If the amount cannot be represented as an int64, an error is returned.
func (amount Amount) Int64() (int64, error) {
	if !amount.number.IsInt64() {
		return 0, errp.Newf("%s overflows int64", amount.number)
	}
	return amount.number.Int64(), nil
}

// BigInt returns a copy of the underlying big integer.
func (amount Amount) BigInt() *big.Int {
	return new(big.Int).Set(amount.number)
}

// Zero returns whether the amount is zero.
func (amount Amount) Zero() bool {
	return amount.number.Sign() == 0
}

// SendAmount is either a concrete amount or "all"/"max".
// This is necessary because an account cannot be emptied otherwise due to fee estimation.
type SendAmount struct {
	amount  Amount
	sendAll bool
}

// NewSendAmount creates a new SendAmount with the given amount.
// Precondition: The given amount has to be positive.
func NewSendAmount(amount Amount) SendAmount {
	if amount.Zero() {
		panic("The amount has to be positive.")
	}
	return SendAmount{amount: amount, sendAll: false}
}

// NewSendAllAmount creates a new send-all amount.
func NewSendAllAmount() SendAmount {
	return SendAmount{amount: Amount{}, sendAll: true}
}

// Amount returns the amount.
// This method may only be called for non-send-all amounts and panics otherwise.
func (sendAmount SendAmount) Amount() Amount {
	if sendAmount.sendAll {
		panic("can only be called if SendAll is false")
	}
	return sendAmount.amount
}

// SendAll returns whether this represents a send-all amount.
func (sendAmount SendAmount) SendAll() bool {
	return sendAmount.sendAll
}
