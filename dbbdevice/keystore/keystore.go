package keystore

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/util/errp"
)

// DBBKeyStore represents a HD account (for example m/44'/0'/0'), providing the account's xpub and a
// signing function for keys derived from it. It exists mainly because the path to the account is
// hardened, which means the device expects derivation paths from the master
type DBBKeyStore struct {
	device  *dbbdevice.DBBDevice
	keyPath string

	xpub *hdkeychain.ExtendedKey
}

// NewDBBKeyStore creates a new HD keystore. keyPath is the path to the account.
func NewDBBKeyStore(
	device *dbbdevice.DBBDevice, keyPath string, net *chaincfg.Params) (*DBBKeyStore, error) {
	xpub, err := device.XPub(keyPath)
	if err != nil {
		return nil, err
	}
	xpub.SetNet(net)

	return &DBBKeyStore{
		device:  device,
		keyPath: keyPath,

		xpub: xpub,
	}, nil
}

// XPub returns the xpub of the account.
// Implements deterministicwallet
func (keystore *DBBKeyStore) XPub() *hdkeychain.ExtendedKey {
	return keystore.xpub
}

// Sign wraps DBBDevice.Sign for signing with keys from the HD account.
// Implements deterministicwallet.HDKeyStoreInterface.
func (keystore *DBBKeyStore) Sign(
	signatureHashes [][]byte,
	relativeKeyPaths []string,
) ([]btcec.Signature, error) {
	keyPaths := make([]string, len(relativeKeyPaths))
	for i, path := range relativeKeyPaths {
		keyPaths[i] = keystore.keyPath + "/" + path
	}
	signatures, err := keystore.device.Sign(signatureHashes, keyPaths)
	if err != nil {
		if dbbdevice.IsErrorAbort(err) {
			return nil, errp.WithStack(deterministicwallet.ErrUserAborted)
		}
		return nil, err
	}
	return signatures, nil
}
