package coin

import "github.com/shiftdevices/godbb/backend/signing"

// Address models a blockchain address to which coins can be sent.
type Address interface {
	Coin() Coin
	EncodeForMachines() []byte
	EncodeForHumans() string
}

// WalletAddress models an address in an own wallet at the keypath given by the configuration.
type WalletAddress interface {
	Address
	Configuration() *signing.Configuration
}
