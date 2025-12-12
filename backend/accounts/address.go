// SPDX-License-Identifier: Apache-2.0

package accounts

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"

// Address models a blockchain address to which coins can be sent.
type Address interface {
	// ID is an identifier for the address.
	ID() string
	EncodeForHumans() string
	AbsoluteKeypath() signing.AbsoluteKeypath
}
