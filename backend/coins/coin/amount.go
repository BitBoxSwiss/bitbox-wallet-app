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
	amount *big.Int
}

// NewAmount creates a new amount.
func NewAmount(amount *big.Int) Amount {
	return Amount{amount: amount}
}

// NewAmountFromInt64 creates a new amount.
func NewAmountFromInt64(amount int64) Amount {
	return Amount{amount: big.NewInt(amount)}
}

// NewAmountFromString parses a user given coin amount, converting it from the default coin unit to
// the the smallest unit.
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
	return Amount{amount: rat.Num()}, nil
}

// Int64 returns the int64 representation of amount.
// If x cannot be represented in an int64, the result is undefined.
func (amount *Amount) Int64() int64 {
	return amount.amount.Int64()
}

// Int returns a copy of the underlying big integer.
func (amount *Amount) Int() *big.Int {
	return new(big.Int).Set(amount.amount)
}
