package btc

import (
	"errors"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc/maketx"
)

// ErrUserAborted is returned when a signing operation is aborted by the user.
var ErrUserAborted = errors.New("aborted")

// KeyStoreWithoutKeyDerivation is an interface that does not support the derivation of additional
// public keys from its extended public key.
//go:generate mockery -name KeyStoreWithoutKeyDerivation
type KeyStoreWithoutKeyDerivation interface {
	// XPub returns the extended public key relative to which hashes are signed with a key path.
	// The returned key is guaranteed to be public and has the version bytes of Bitcoin.
	XPub() *hdkeychain.ExtendedKey

	// Sign signs every hash with the private key at the corresponding key path,
	// which is relative to the extended public key as returned by XPub().
	// If the user aborts the signing process, ErrUserAborted is returned.
	Sign(tx *maketx.TxProposal, hashes [][]byte, relativePaths []string) ([]btcec.Signature, error)

	// DisplayAddress triggers the display of the address at the given key path.
	DisplayAddress(keyPath string)
}
