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

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"

// Balance contains the available and incoming balance of an account.
type Balance struct {
	available coin.Amount
	incoming  coin.Amount
}

// NewBalance creates a new balance with the given amounts.
func NewBalance(available coin.Amount, incoming coin.Amount) *Balance {
	return &Balance{
		available: available,
		incoming:  incoming,
	}
}

// Available returns the sum of all unspent coins in the account.
// The amounts of unconfirmed outgoing transfers are no longer included (but their change is).
func (balance *Balance) Available() coin.Amount {
	return balance.available
}

// Incoming returns the sum of all unconfirmed transfers coming into the account.
func (balance *Balance) Incoming() coin.Amount {
	return balance.incoming
}
