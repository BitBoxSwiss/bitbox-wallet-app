package device

import "github.com/shiftdevices/godbb/backend/keystore"

// Interface represents a hardware wallet device.
type Interface interface {
	// // ProductName returns the product name of the device in lowercase.
	ProductName() string

	SerialNumber() string

	// Identifier returns the hash of the type and the serial number.
	Identifier() string

	// FirmwareVersion() string

	// UserChosenName() string

	// Keystore returns the keystore provided by the device (or an nil if not seeded).
	Keystore() keystore.Keystore

	// Locked() bool

	// Unlock(string) error

	// Lock() error

	// observable.Interface
}
