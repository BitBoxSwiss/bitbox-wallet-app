package backend

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
)

// keyStoreWithHardenedKeyDerivation is an interface that supports the derivation of additional
// hardened public keys from its extended public key.
type keyStoreWithHardenedKeyDerivation interface {
	// XPub returns the extended public key at the given key path, which can include hardened keys.
	XPub(keyPath string) (*hdkeychain.ExtendedKey, error)

	// Sign signs every hash with the private key at the corresponding key path.
	Sign(hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)
}

// relativeKeyStore implements KeyStoreWithoutKeyDerivation using keyStoreWithHardenedKeyDerivation.
type relativeKeyStore struct {
	keyStore keyStoreWithHardenedKeyDerivation
	keyPath  string
	xPub     *hdkeychain.ExtendedKey
}

// newRelativeKeyStore creates a new relativeKeyStore.
// The extended public key is loaded from the given key store at the given key path.
func newRelativeKeyStore(
	keyStore keyStoreWithHardenedKeyDerivation,
	keyPath string,
) (*relativeKeyStore, error) {
	xPub, err := keyStore.XPub(keyPath)
	if err != nil {
		return nil, err
	}

	return &relativeKeyStore{
		keyStore: keyStore,
		keyPath:  keyPath,
		xPub:     xPub,
	}, nil
}

// XPub returns the extended public key relative to which hashes are signed with a key path.
// The returned key is guaranteed to be public and has the version bytes of Bitcoin.
func (rks *relativeKeyStore) XPub() *hdkeychain.ExtendedKey {
	return rks.xPub
}

// Sign signs every hash with the private key at the corresponding key path,
// which is relative to the extended public key as returned by XPub().
// If the user aborts the signing process, ErrUserAborted is returned.
func (rks *relativeKeyStore) Sign(
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
			return nil, errp.WithStack(btc.ErrUserAborted)
		}
		return nil, err
	}
	return signatures, nil
}
