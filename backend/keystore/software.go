package keystore

import (
	"crypto/sha256"
	"encoding/hex"

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
	configuration *signing.Configuration
	cosignerIndex int
	// The master extended private key from which all keys are derived.
	master     *hdkeychain.ExtendedKey
	identifier string
	log        *logrus.Entry
}

// NewSoftwareBasedKeystore creates a new keystore with the given configuration, index and key.
func NewSoftwareBasedKeystore(
	configuration *signing.Configuration,
	cosignerIndex int,
	master *hdkeychain.ExtendedKey,
) *SoftwareBasedKeystore {
	publicKey, _ := master.ECPubKey()
	hash := sha256.Sum256(publicKey.SerializeCompressed())
	return &SoftwareBasedKeystore{
		configuration: configuration,
		cosignerIndex: cosignerIndex,
		master:        master,
		identifier:    hex.EncodeToString(hash[:]),
		log:           logging.Log.WithGroup("servewallet"),
	}
}

// NewSoftwareBasedKeystoreWithRandomSeed creates a new keystore with a random seed.
func NewSoftwareBasedKeystoreWithRandomSeed(
	configuration *signing.Configuration,
	cosignerIndex int,
) (*SoftwareBasedKeystore, error) {
	seed, err := hdkeychain.GenerateSeed(hdkeychain.RecommendedSeedLen)
	if err != nil {
		return nil, errp.Wrap(err, "Could not generate a seed for the software-based keystore.")
	}
	master, err := hdkeychain.NewMaster(seed, &chaincfg.TestNet3Params)
	if err != nil {
		return nil, errp.Wrap(err, "Could not derive a master extended private key from the seed.")
	}
	return NewSoftwareBasedKeystore(configuration, cosignerIndex, master), nil
}

// Configuration implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) Configuration() *signing.Configuration {
	return keystore.configuration
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

// DisplayAddress implements keystore.Keystore.
func (keystore *SoftwareBasedKeystore) DisplayAddress(signing.AbsoluteKeypath, coin.Interface) error {
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
	proposedTransaction interface{},
) (coin.ProposedTransaction, error) {
	panic("Transaction signing is not yet supported by the software-based keystore!")
}
