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

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// Amount represents an amount in the smallest coin unit (e.g. satoshi).
type Amount struct {
	n *big.Int
}

// NewAmount creates a new amount.
func NewAmount(amount *big.Int) Amount {
	return Amount{n: new(big.Int).Set(amount)}
}

// NewAmountFromInt64 creates a new amount.
func NewAmountFromInt64(amount int64) Amount {
	return Amount{n: big.NewInt(amount)}
}

// NewAmountFromString parses a user given coin amount, converting it from the default coin unit to
// the smallest unit.
func NewAmountFromString(s string, unit *big.Int) (Amount, error) {
	// big.Rat parsing accepts rationals like "2/3". Exclude those, we only want decimals.
	if strings.ContainsRune(s, '/') {
		return Amount{}, errp.Newf("could not parse %q", s)
	}
	rat, ok := new(big.Rat).SetString(s)
	if !ok {
		return Amount{}, errp.Newf("could not parse %q", s)
	}
	rat.Mul(rat, new(big.Rat).SetInt(unit))
	if rat.Denom().Cmp(big.NewInt(1)) != 0 {
		return Amount{}, errp.Newf("invalid amount %q", s)
	}
	return Amount{n: rat.Num()}, nil
}

// Int64 returns the int64 representation of amount. If x cannot be represented in an int64, an
// error is returned.
func (amount Amount) Int64() (int64, error) {
	if !amount.n.IsInt64() {
		return 0, errp.Newf("%s overflows int64", amount.n)
	}
	return amount.n.Int64(), nil
}

// BigInt returns a copy of the underlying big integer.
func (amount Amount) BigInt() *big.Int {
	return new(big.Int).Set(amount.n)
}

// SendAmount is either a concrete amount, or "all"/"max". The concrete amount is user input and is
// parsed/validated in Amount().
type SendAmount struct {
	amount  string
	sendAll bool
}

// NewSendAmount creates a new SendAmount based on a concrete amount.
func NewSendAmount(amount string) SendAmount {
	return SendAmount{amount: amount, sendAll: false}
}

// NewSendAmountAll creates a new Sendall-amount.
func NewSendAmountAll() SendAmount {
	return SendAmount{amount: "", sendAll: true}
}

// Amount parses the amount and converts it from the default unit to the smallest unit (e.g. satoshi
// = 1e8). Returns an error if the amount is negative, or depending on allowZero, if it is zero.
func (sendAmount SendAmount) Amount(unit *big.Int, allowZero bool) (Amount, error) {
	if sendAmount.sendAll {
		panic("can only be called if SendAll is false")
	}
	amount, err := NewAmountFromString(sendAmount.amount, unit)
	if err != nil {
		return Amount{}, errp.WithStack(errors.ErrInvalidAmount)
	}
	if amount.BigInt().Sign() == -1 {
		return Amount{}, errp.WithStack(errors.ErrInvalidAmount)
	}
	if !allowZero && amount.BigInt().Sign() == 0 {
		return Amount{}, errp.WithStack(errors.ErrInvalidAmount)
	}
	return amount, nil
}

// SendAll returns if this represents a send-all input.
func (sendAmount *SendAmount) SendAll() bool {
	return sendAmount.sendAll
}
