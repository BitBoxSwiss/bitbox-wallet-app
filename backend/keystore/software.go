package keystore

import (
	"crypto/sha256"
	"encoding/hex"

	"golang.org/x/crypto/pbkdf2"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/logging"
)

// SoftwareBasedKeystore implements a keystore in software.
type SoftwareBasedKeystore struct {
	cosignerIndex int
	// The master extended private key from which all keys are derived.
	master     *hdkeychain.ExtendedKey
	identifier string
	log        *logrus.Entry
}

// NewSoftwareBasedKeystore creates a new keystore with the given configuration, index and key.
func NewSoftwareBasedKeystore(
	cosignerIndex int,
	master *hdkeychain.ExtendedKey,
) *SoftwareBasedKeystore {
	publicKey, _ := master.ECPubKey()
	hash := sha256.Sum256(publicKey.SerializeCompressed())
	return &SoftwareBasedKeystore{
		cosignerIndex: cosignerIndex,
		master:        master,
		identifier:    hex.EncodeToString(hash[:]),
		log:           logging.Log.WithGroup("servewallet"),
	}
}

// NewSoftwareBasedKeystoreFromPIN creates a new unique keystore derived from the PIN.
func NewSoftwareBasedKeystoreFromPIN(pin string) *SoftwareBasedKeystore {
	seed := pbkdf2.Key([]byte(pin), []byte("BitBox"), 64, hdkeychain.RecommendedSeedLen, sha256.New)
	master, err := hdkeychain.NewMaster(seed[:], &chaincfg.TestNet3Params)
	if err != nil {
		panic(errp.WithStack(err))
	}
	return NewSoftwareBasedKeystore(0, master)
}

// Configuration implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) Configuration() *signing.Configuration {
	return nil
}

// CosignerIndex implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) CosignerIndex() int {
	return keystore.cosignerIndex
}

// Identifier implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) Identifier() (string, error) {
	return keystore.identifier, nil
}

// HasSecureOutput implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) HasSecureOutput() bool {
	return false
}

// OutputAddress implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) OutputAddress(signing.AbsoluteKeypath, coin.Coin) error {
	return errp.New("The software-based keystore has no secure output to display the address.")
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) ExtendedPublicKey(
	absoluteKeypath signing.AbsoluteKeypath,
) (*hdkeychain.ExtendedKey, error) {
	extendedPrivateKey, err := absoluteKeypath.Derive(keystore.master)
	if err != nil {
		return nil, err
	}
	return extendedPrivateKey.Neuter()
}

func (keystore *SoftwareBasedKeystore) sign(
	signatureHashes [][]byte,
	keyPaths []signing.AbsoluteKeypath,
) ([]btcec.Signature, error) {
	if len(signatureHashes) != len(keyPaths) {
		return nil, errp.New("The number of hashes to sign has to be equal to the number of paths.")
	}
	len := len(keyPaths)
	signatures := make([]btcec.Signature, len)
	for i := 0; i < len; i++ {
		xprv, err := keyPaths[i].Derive(keystore.master)
		if err != nil {
			return nil, err
		}
		prv, err := xprv.ECPrivKey()
		if err != nil {
			return nil, err
		}
		signature, err := prv.Sign(signatureHashes[i])
		if err != nil {
			return nil, err
		}
		signatures[i] = *signature
	}
	return signatures, nil
}

// SignTransaction implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) SignTransaction(
	proposedTransaction coin.ProposedTransaction,
) (coin.ProposedTransaction, error) {
	panic("Transaction signing is not yet supported by the software-based keystore!")
}
