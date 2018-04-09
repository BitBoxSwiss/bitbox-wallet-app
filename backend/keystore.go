package backend

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

// keyStoreWithHardenedKeyDerivation is an interface that supports the derivation of additional
// hardened public keys from its extended public key.
type keyStoreWithHardenedKeyDerivation interface {
	// XPub returns the extended public key at the given key path, which can include hardened keys.
	XPub(keyPath string) (*hdkeychain.ExtendedKey, error)

	// Sign signs every hash with the private key at the corresponding key path.
	Sign(hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)

	// DisplayAddress triggers the display of the address at the given key path.
	DisplayAddress(keyPath string)
}

// relativeKeyStore implements KeyStoreWithoutKeyDerivation using keyStoreWithHardenedKeyDerivation.
type relativeKeyStore struct {
	keyStore keyStoreWithHardenedKeyDerivation
	keyPath  string
	xPub     *hdkeychain.ExtendedKey
	logEntry *logrus.Entry
}

// newRelativeKeyStore creates a new relativeKeyStore.
// The extended public key is loaded from the given key store at the given key path.
func newRelativeKeyStore(
	keyStore keyStoreWithHardenedKeyDerivation,
	keyPath string,
	logEntry *logrus.Entry,
) (*relativeKeyStore, error) {
	logEntry.WithField("keypath", keyPath).Debug("Creating new relative keystore with keyPath")
	xPub, err := keyStore.XPub(keyPath)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to fetch the xPub")
	}

	return &relativeKeyStore{
		keyStore: keyStore,
		keyPath:  keyPath,
		xPub:     xPub,
		logEntry: logEntry,
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
	rks.logEntry.WithField("relative-keypaths", relativeKeyPaths).Info("Sign")
	keyPaths := make([]string, len(relativeKeyPaths))
	for i, path := range relativeKeyPaths {
		keyPaths[i] = rks.keyPath + "/" + path
	}
	signatures, err := rks.keyStore.Sign(signatureHashes, keyPaths)
	if err != nil {
		if bitbox.IsErrorAbort(err) {
			rks.logEntry.WithField("relative-keypaths", relativeKeyPaths).Info("Signing aborted")
			return nil, errp.WithStack(btc.ErrUserAborted)
		}
		rks.logEntry.WithFields(logrus.Fields{"relative-keypaths": relativeKeyPaths, "error": err}).Error("Failed to sign the signature hash")
		return nil, err
	}
	rks.logEntry.WithField("relative-keypaths", relativeKeyPaths).Info("Signing successful")
	return signatures, nil
}

// DisplayAddress triggers the display of the address at the given key path.
func (rks *relativeKeyStore) DisplayAddress(keyPath string) {
	rks.keyStore.DisplayAddress(rks.keyPath + "/" + keyPath)
}
