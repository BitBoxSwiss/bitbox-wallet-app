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

package device

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device/event"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
)

// Interface represents a hardware wallet device.
type Interface interface {
	Init(testing bool) error
	// ProductName returns the product name of the device in lowercase/no spaces.
	// It acts as an identifier for the device type, not for display.
	// If you change a device's product name, be sure to check the frontend and other places which
	// assume this is a constant.
	ProductName() string

	// Identifier returns the hash of the type and the serial number.
	Identifier() string

	// FirmwareVersion() string

	// UserChosenName() string

	// ExtendedPublicKey returns the extended public key at the given absolute keypath.
	// ExtendedPublicKey(signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error)

	// Keystore returns the keystore provided by the device (or an nil if not seeded).
	KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystore.Keystore

	// Locked() bool

	// Unlock(string) error

	// Lock() error

	// SetOnEvent installs a callback which is called for various events.
	SetOnEvent(func(event.Event, interface{}))

	// Close tells the device to close all connections.
	Close()

	observable.Interface
}
