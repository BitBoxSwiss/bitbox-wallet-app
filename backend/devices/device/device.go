// SPDX-License-Identifier: Apache-2.0

package device

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device/event"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
)

// Interface represents a hardware wallet device.
type Interface interface {
	observable.Interface

	Init(testing bool) error
	// PlatformName returns the Platform name of the device in lowercase/no spaces.
	// It acts as an identifier for the device type, not for the specific model (e.g.
	// it return bitbox02 for both the bitbox02 and the bitbox02 nova).
	// If you change a device's platform name, be sure to check the frontend and other places which
	// assume this is a constant.
	PlatformName() string

	// ProductName is the actual model of the product in lowercase/no spaces
	// (e.g. bitbox, bitbox02, bitbox02nova).
	ProductName() string

	// Identifier returns the hash of the type and the serial number.
	Identifier() string

	// Keystore returns the keystore provided by the device (or an nil if not seeded).
	Keystore() keystore.Keystore

	// SetOnEvent installs a callback which is called for various events.
	SetOnEvent(func(event.Event, interface{}))

	// Close tells the device to close all connections.
	Close()
}
