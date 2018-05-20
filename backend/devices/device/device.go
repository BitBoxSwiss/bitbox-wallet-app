package device

import (
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/backend/signing"
)

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventKeystoreAvailable is fired when the device's keystore becomes available (e.g. after
	// unlocking it).
	EventKeystoreAvailable Event = "keystoreAvailable"
	// EventKeystoreGone is fired when the device's keystoer becomes unavailable, e.g. after a
	// reset. NOTE: it is not fired when the keystore is replaced. In that case, only
	// EventKeystoreAvailable is fired.
	EventKeystoreGone Event = "keystoreGone"
)

// Interface represents a hardware wallet device.
type Interface interface {
	Init(testing bool)
	// ProductName returns the product name of the device in lowercase.
	ProductName() string

	// Identifier returns the hash of the type and the serial number.
	Identifier() string

	// FirmwareVersion() string

	// UserChosenName() string

	// ExtendedPublicKey returns the extended public key at the given absolute keypath.
	ExtendedPublicKey(signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error)

	// Keystore returns the keystore provided by the device (or an nil if not seeded).
	KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystore.Keystore

	// Locked() bool

	// Unlock(string) error

	// Lock() error

	// SetOnEvent installs a callback which is called for various events.
	SetOnEvent(func(Event))

	// observable.Interface
}
