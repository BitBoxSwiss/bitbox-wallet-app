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
	"fmt"
	"math/big"

	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/btcec/v2/schnorr"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	keystorePkg "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
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

// Name implements keystore.Keystore.
func (keystore *Keystore) Name() (string, error) {
	fingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Software keystore %x", fingerprint), nil
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
	if !keystore.SupportsCoin(coin) {
		return false
	}
	switch coin.(type) {
	case *btc.Coin:
		scriptType := meta.(signing.ScriptType)
		return scriptType == signing.ScriptTypeP2PKH ||
			scriptType == signing.ScriptTypeP2WPKHP2SH ||
			scriptType == signing.ScriptTypeP2WPKH ||
			scriptType == signing.ScriptTypeP2TR

	default:
		return false
	}
}

// SupportsUnifiedAccounts implements keystore.Keystore.
func (keystore *Keystore) SupportsUnifiedAccounts() bool {
	return true
}

// SupportsMultipleAccounts implements keystore.Keystore.
func (keystore *Keystore) SupportsMultipleAccounts() bool {
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

// SignTransaction implements keystore.Keystore.
func (keystore *Keystore) SignTransaction(
	proposedTransaction interface{},
) error {
	btcProposedTx, ok := proposedTransaction.(*btc.ProposedTransaction)
	if !ok {
		panic("Only BTC supported for now.")
	}
	keystore.log.Info("Sign transaction.")
	transaction := btcProposedTx.TXProposal.Transaction
	signatures := make([]*types.Signature, len(transaction.TxIn))
	for index, txIn := range transaction.TxIn {
		spentOutput, ok := btcProposedTx.TXProposal.PreviousOutputs[txIn.PreviousOutPoint]
		if !ok {
			keystore.log.Error("There needs to be exactly one output being spent per input.")
			return errp.New("There needs to be exactly one output being spent per input.")
		}
		address := btcProposedTx.GetAddress(spentOutput.ScriptHashHex())

		xprv, err := address.Configuration.AbsoluteKeypath().Derive(keystore.master)
		if err != nil {
			return err
		}
		prv, err := xprv.ECPrivKey()
		if err != nil {
			return errp.WithStack(err)
		}

		if address.Configuration.ScriptType() == signing.ScriptTypeP2TR {
			prv = txscript.TweakTaprootPrivKey(*prv, nil)
			signatureHash, err := txscript.CalcTaprootSignatureHash(
				btcProposedTx.SigHashes, txscript.SigHashDefault, transaction,
				index, btcProposedTx.TXProposal.PreviousOutputs)
			if err != nil {
				return errp.Wrap(err, "Failed to calculate Taproot signature hash")
			}
			keystore.log.Debug("Calculated taproot signature hash")
			signature, err := schnorr.Sign(prv, signatureHash)
			if err != nil {
				return err
			}
			signatureSer := signature.Serialize()
			signatures[index] = &types.Signature{
				R: new(big.Int).SetBytes(signatureSer[:32]),
				S: new(big.Int).SetBytes(signatureSer[32:]),
			}
		} else {
			var signatureHash []byte
			isSegwit, subScript := address.ScriptForHashToSign()
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
			signature, err := ecdsa.SignCompact(prv, signatureHash, true)
			if err != nil {
				return err
			}
			signatures[index] = &types.Signature{
				R: new(big.Int).SetBytes(signature[1:33]),
				S: new(big.Int).SetBytes(signature[33:]),
			}
		}
	}

	btcProposedTx.Signatures = signatures
	return nil
}

// CanSignMessage implements keystore.Keystore.
func (keystore *Keystore) CanSignMessage(coin.Code) bool {
	return false
}

// SignBTCMessage implements keystore.Keystore.
func (keystore *Keystore) SignBTCMessage(message []byte, keypath signing.AbsoluteKeypath, scriptType signing.ScriptType) ([]byte, error) {
	return nil, errp.New("unsupported")
}

// SignETHMessage implements keystore.Keystore.
func (keystore *Keystore) SignETHMessage(message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
	return nil, errp.New("unsupported")
}

// SignETHTypedMessage implements keystore.Keystore.
func (keystore *Keystore) SignETHTypedMessage(chainId uint64, data []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
	return nil, errp.New("unsupported")
}

// SignETHWalletConnectTransaction implements keystore.Keystore.
func (keystore *Keystore) SignETHWalletConnectTransaction(chainID uint64, tx *ethTypes.Transaction, keypath signing.AbsoluteKeypath) ([]byte, error) {
	return nil, errp.New("unsupported")
}
