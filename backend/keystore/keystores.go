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

package keystore

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// Keystores models a collection of keystores that can be passed to accounts to perform signing
// operations.
type Keystores struct {
	keystores []Keystore
}

// NewKeystores returns a collection of the given keystores.
func NewKeystores(keystores ...Keystore) *Keystores {
	return &Keystores{
		keystores: keystores,
	}
}

// Count returns the number of keystores in the collection.
func (keystores *Keystores) Count() int {
	return len(keystores.keystores)
}

// Add adds the given keystore to the collection of keystores.
func (keystores *Keystores) Add(keystore Keystore) error {
	for _, element := range keystores.keystores {
		if element == keystore {
			return errp.New("The collection already contains the given keystore.")
		}
	}
	keystores.keystores = append(keystores.keystores, keystore)
	return nil
}

// Remove removes the given keystore from the collection of keystores.
func (keystores *Keystores) Remove(keystore Keystore) error {
	for index, element := range keystores.keystores {
		if element == keystore {
			indexOfLastElement := len(keystores.keystores) - 1
			keystores.keystores[index] = keystores.keystores[indexOfLastElement]
			keystores.keystores[indexOfLastElement] = nil // Prevent memory leak
			keystores.keystores = keystores.keystores[:indexOfLastElement]
			return nil
		}
	}
	return errp.New("The collection does not contain the given keystore.")
}

// CanVerifyAddresses returns whether any of the keystores can verify an address.
func (keystores *Keystores) CanVerifyAddresses(coin coin.Coin) (bool, bool, error) {
	for _, keystore := range keystores.keystores {
		canVerifyAddress, optional, err := keystore.CanVerifyAddress(coin)
		if err != nil {
			return false, false, err
		}
		if canVerifyAddress {
			return true, optional, nil
		}
	}
	return false, false, nil
}

// VerifyAddress outputs the address for the given coin with the given configuration on all
// keystores that have a secure output.
func (keystores *Keystores) VerifyAddress(
	configuration *signing.Configuration,
	coin coin.Coin,
) error {
	found := false
	for _, keystore := range keystores.keystores {
		canVerifyAddress, _, err := keystore.CanVerifyAddress(coin)
		if err != nil {
			return err
		}
		if canVerifyAddress {
			if err := keystore.VerifyAddress(configuration, coin); err != nil {
				return err
			}
			found = true
		}
	}
	if !found {
		return errp.New("There is currently no keystore to securely output the address.")
	}
	return nil
}

// CanVerifyExtendedPublicKeys returns the indices of the keystores that support secure verification.
func (keystores *Keystores) CanVerifyExtendedPublicKeys() []int {
	canVerifyExtendedPublicKey := []int{}
	for index, keystore := range keystores.keystores {
		if keystore.CanVerifyExtendedPublicKey() {
			canVerifyExtendedPublicKey = append(canVerifyExtendedPublicKey, index)
		}
	}
	return canVerifyExtendedPublicKey
}

// SignTransaction signs the given proposed transaction on all keystores. Returns ErrSigningAborted
// if the user aborts.
func (keystores *Keystores) SignTransaction(proposedTransaction interface{}) error {
	for _, keystore := range keystores.keystores {
		if err := keystore.SignTransaction(proposedTransaction); err != nil {
			return err
		}
	}
	return nil
}

// Keystores returns all keystores.
func (keystores *Keystores) Keystores() []Keystore {
	return keystores.keystores
}
