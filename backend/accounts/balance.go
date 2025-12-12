// SPDX-License-Identifier: Apache-2.0

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
