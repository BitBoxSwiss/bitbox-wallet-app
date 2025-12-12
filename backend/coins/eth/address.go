// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/ethereum/go-ethereum/common"
)

// Address holds an Ethereum address and implements coin.Address.
type Address struct {
	common.Address
	absoluteKeypath signing.AbsoluteKeypath
}

// ID implements coin.Address.
func (address Address) ID() string {
	return address.Address.Hex()
}

// EncodeForHumans implements coin.Address.
func (address Address) EncodeForHumans() string {
	return address.Address.Hex()
}

// AbsoluteKeypath implements coin.Address.
func (address Address) AbsoluteKeypath() signing.AbsoluteKeypath {
	return address.absoluteKeypath
}
