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
