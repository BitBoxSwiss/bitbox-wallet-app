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

import "github.com/digitalbitbox/bitbox-wallet-app/backend/signing"

// Address models a blockchain address to which coins can be sent.
type Address interface {
	// Coin() Coin
	// EncodeForMachines() []byte
	EncodeForHumans() string

	// ID is an identifier for the address.
	ID() string
}

// AccountAddress models an address in an own account at the keypath given by the configuration.
type AccountAddress interface {
	Address
	Configuration() *signing.Configuration
}
