// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package software

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	keystorePkg "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/pbkdf2"
)

// Keystore implements a keystore in software.
type Keystore struct {
	// The master extended private key from which all keys are derived.
	master     *hdkeychain.ExtendedKey
	identifier string
	log        *logrus.Entry
}

// NewKeystore creates a new keystore with the given configuration, index and key.
func NewKeystore(
	master *hdkeychain.ExtendedKey,
) *Keystore {
	publicKey, _ := master.ECPubKey()
	hash := sha256.Sum256(publicKey.SerializeCompressed())
	return &Keystore{
		master:     master,
		identifier: hex.EncodeToString(hash[:]),
		log:        logging.Get().WithGroup("software"),
	}
}

// NewKeystoreFromPIN creates a new unique keystore derived from the PIN.
func NewKeystoreFromPIN(pin string) *Keystore {
	seed := pbkdf2.Key([]byte(pin), []byte("BitBox"), 64, hdkeychain.RecommendedSeedLen, sha256.New)
	master, err := hdkeychain.NewMaster(seed, &chaincfg.TestNet3Params)
	if err != nil {
		panic(errp.WithStack(err))
	}
	return NewKeystore(master)
}

// Type implements keystore.Keystore.
func (keystore *Keystore) Type() keystorePkg.Type {
	return keystorePkg.TypeSoftware
}

// RootFingerprint implements keystore.Keystore.
func (keystore *Keystore) RootFingerprint() ([]byte, error) {
	// The bip32 Go lib we use does not expose a key's fingerprint. We simply get an arbitrary child
	// xpub and read the parentFingerprint field. This is part of the BIP32 specification.
	keypath, err := signing.NewAbsoluteKeypath("m/84'")
	if err != nil {
		return nil, err
	}
	xprv, err := keypath.Derive(keystore.master)
	if err != nil {
		return nil, err
	}
	fingerprint := make([]byte, 4)
	binary.BigEndian.PutUint32(fingerprint, xprv.ParentFingerprint())
	return fingerprint, nil
}

// Configuration implements keystore.Keystore.
func (keystore *Keystore) Configuration() *signing.Configuration {
	return nil
}

// SupportsCoin implements keystore.Keystore.
func (keystore *Keystore) SupportsCoin(coin coin.Coin) bool {
	switch coin.(type) {
	case *btc.Coin:
		return true
	default:
		return false
	}
}

// SupportsAccount implements keystore.Keystore.
func (keystore *Keystore) SupportsAccount(coin coin.Coin, meta interface{}) bool {
	return keystore.SupportsCoin(coin)
}

// SupportsUnifiedAccounts implements keystore.Keystore.
func (keystore *Keystore) SupportsUnifiedAccounts() bool {
	return true
}

// Identifier implements keystore.Keystore.
func (keystore *Keystore) Identifier() (string, error) {
	return keystore.identifier, nil
}

// CanVerifyAddress implements keystore.Keystore.
func (keystore *Keystore) CanVerifyAddress(coin.Coin) (bool, bool, error) {
	return false, false, nil
}

// VerifyAddress implements keystore.Keystore.
func (keystore *Keystore) VerifyAddress(*signing.Configuration, coin.Coin) error {
	return errp.New("The software-based keystore has no secure output to display the address.")
}

// CanVerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *Keystore) CanVerifyExtendedPublicKey() bool {
	return false
}

// VerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *Keystore) VerifyExtendedPublicKey(coin coin.Coin, configuration *signing.Configuration) error {
	return errp.New("The software-based keystore has no secure output to display the public key.")
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *Keystore) ExtendedPublicKey(
	coin coin.Coin, absoluteKeypath signing.AbsoluteKeypath,
) (*hdkeychain.ExtendedKey, error) {
	extendedPrivateKey, err := absoluteKeypath.Derive(keystore.master)
	if err != nil {
		return nil, err
	}
	return extendedPrivateKey.Neuter()
}

func (keystore *Keystore) sign(
	signatureHashes [][]byte,
	keyPaths []signing.AbsoluteKeypath,
) ([]btcec.Signature, error) {
	if len(signatureHashes) != len(keyPaths) {
		return nil, errp.New("The number of hashes to sign has to be equal to the number of paths.")
	}
	signatures := make([]btcec.Signature, len(keyPaths))
	for i, keyPath := range keyPaths {
		xprv, err := keyPath.Derive(keystore.master)
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
func (keystore *Keystore) SignTransaction(
	proposedTransaction interface{},
) error {
	btcProposedTx, ok := proposedTransaction.(*btc.ProposedTransaction)
	if !ok {
		panic("Only BTC supported for now.")
	}
	keystore.log.Info("Sign transaction.")
	signatureHashes := [][]byte{}
	keyPaths := []signing.AbsoluteKeypath{}
	transaction := btcProposedTx.TXProposal.Transaction
	for index, txIn := range transaction.TxIn {
		spentOutput, ok := btcProposedTx.PreviousOutputs[txIn.PreviousOutPoint]
		if !ok {
			keystore.log.Panic("There needs to be exactly one output being spent per input!")
		}
		address := btcProposedTx.GetAddress(spentOutput.ScriptHashHex())
		isSegwit, subScript := address.ScriptForHashToSign()
		var signatureHash []byte
		if isSegwit {
			var err error
			signatureHash, err = txscript.CalcWitnessSigHash(subScript, btcProposedTx.SigHashes,
				txscript.SigHashAll, transaction, index, spentOutput.Value)
			if err != nil {
				return errp.Wrap(err, "Failed to calculate SegWit signature hash")
			}
			keystore.log.Debug("Calculated segwit signature hash")
		} else {
			var err error
			signatureHash, err = txscript.CalcSignatureHash(
				subScript, txscript.SigHashAll, transaction, index)
			if err != nil {
				return errp.Wrap(err, "Failed to calculate legacy signature hash")
			}
			keystore.log.Debug("Calculated legacy signature hash")
		}

		signatureHashes = append(signatureHashes, signatureHash)
		keyPaths = append(keyPaths, address.Configuration.AbsoluteKeypath())
	}

	signatures, err := keystore.sign(signatureHashes, keyPaths)
	if err != nil {
		return errp.WithMessage(err, "Failed to sign signature hash")
	}
	if len(signatures) != len(transaction.TxIn) {
		panic("number of signatures doesn't match number of inputs")
	}
	for i, signature := range signatures {
		signature := signature
		btcProposedTx.Signatures[i][0] = &signature
	}
	return nil
}
