package btc

import (
	"errors"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
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
	Sign(hashes [][]byte, relativeKeyPaths []string) ([]btcec.Signature, error)
}

// KeyStoreWithHardenedKeyDerivation is an interface that supports the derivation of additional
// hardened public keys from its extended public key.
type KeyStoreWithHardenedKeyDerivation interface {
	// XPub returns the extended public key at the given key path, which can include hardened keys.
	XPub(keyPath string) (*hdkeychain.ExtendedKey, error)

	// Sign signs every hash with the private key at the corresponding key path.
	// If the user aborts the signing process, ErrUserAborted is returned.
	Sign(hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)
}

// RelativeKeyStore implements KeyStoreWithoutKeyDerivation using KeyStoreWithHardenedKeyDerivation.
type RelativeKeyStore struct {
	keyStore KeyStoreWithHardenedKeyDerivation
	keyPath  string
	xPub     *hdkeychain.ExtendedKey
}

// NewRelativeKeyStore creates a new RelativeKeyStore.
// The extended public key is loaded from the given key store at the given key path.
func NewRelativeKeyStore(
	keyStore KeyStoreWithHardenedKeyDerivation,
	keyPath string,
) (*RelativeKeyStore, error) {
	xPub, err := keyStore.XPub(keyPath)
	if err != nil {
		return nil, err
	}

	return &RelativeKeyStore{
		keyStore: keyStore,
		keyPath:  keyPath,
		xPub:     xPub,
	}, nil
}

// XPub returns the extended public key relative to which hashes are signed with a key path.
// The returned key is guaranteed to be public and has the version bytes of Bitcoin.
func (rks *RelativeKeyStore) XPub() *hdkeychain.ExtendedKey {
	return rks.xPub
}

// Sign signs every hash with the private key at the corresponding key path,
// which is relative to the extended public key as returned by XPub().
// If the user aborts the signing process, ErrUserAborted is returned.
func (rks *RelativeKeyStore) Sign(
	signatureHashes [][]byte,
	relativeKeyPaths []string,
) ([]btcec.Signature, error) {
	keyPaths := make([]string, len(relativeKeyPaths))
	for i, path := range relativeKeyPaths {
		keyPaths[i] = rks.keyPath + "/" + path
	}
	signatures, err := rks.keyStore.Sign(signatureHashes, keyPaths)
	if err != nil {
		if bitbox.IsErrorAbort(err) {
			return nil, errp.WithStack(ErrUserAborted)
		}
		return nil, err
	}
	return signatures, nil
}
