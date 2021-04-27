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

package bitbox

import (
	"encoding/binary"
	"fmt"

	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	keystorePkg "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/sirupsen/logrus"
)

type keystore struct {
	dbb *Device
	log *logrus.Entry
}

// Type implements keystore.Keystore.
func (keystore *keystore) Type() keystorePkg.Type {
	return keystorePkg.TypeHardware
}

// RootFingerprint implements keystore.Keystore.
func (keystore *keystore) RootFingerprint() ([]byte, error) {
	// The BitBox01 does not expose the root fingerprint, and it does not allow getting the xpub at
	// "m/".  We simply get an arbitrary child xpub and read the parentFingerprint property, which
	// equals the fingerprint at m/. This is part of the BIP32 specification.
	xpub, err := keystore.dbb.xpub("m/84'")
	if err != nil {
		return nil, err
	}
	fingerprint := make([]byte, 4)
	binary.BigEndian.PutUint32(fingerprint, xpub.ParentFingerprint())
	return fingerprint, nil
}

// SupportsAccount implements keystore.Keystore.
func (keystore *keystore) SupportsAccount(coin coin.Coin, meta interface{}) bool {
	switch coin.(type) {
	case *btc.Coin:
		return true
	default:
		return false
	}
}

// SupportsUnifiedAccounts implements keystore.Keystore.
func (keystore *keystore) SupportsUnifiedAccounts() bool {
	return false
}

// CanVerifyAddress implements keystore.Keystore.
func (keystore *keystore) CanVerifyAddress(coin coin.Coin) (bool, bool, error) {
	deviceInfo, err := keystore.dbb.DeviceInfo()
	if err != nil {
		return false, false, err
	}
	const optional = true
	return deviceInfo.Pairing && keystore.dbb.HasMobileChannel(), optional, nil
}

// VerifyAddress implements keystore.Keystore.
func (keystore *keystore) VerifyAddress(
	configuration *signing.Configuration, coin coin.Coin) error {
	canVerifyAddress, _, err := keystore.CanVerifyAddress(coin)
	if err != nil {
		return err
	}
	if !canVerifyAddress {
		panic("canVerifyAddress must be true")
	}
	return keystore.dbb.displayAddress(
		configuration.AbsoluteKeypath().Encode(), fmt.Sprintf("%s-%s", coin.Code(), string(configuration.ScriptType())))
}

// CanVerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) CanVerifyExtendedPublicKey() bool {
	return false
}

// VerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) VerifyExtendedPublicKey(coin coin.Coin, configuration *signing.Configuration) error {
	keystore.log.Panic("BitBox v1 does not have a screen to verify the xpub")
	return nil
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) ExtendedPublicKey(
	coin coin.Coin, keyPath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	return keystore.dbb.xpub(keyPath.Encode())
}

func (keystore *keystore) signBTCTransaction(btcProposedTx *btc.ProposedTransaction) error {
	keystore.log.Info("Sign btc transaction")
	signatureHashes := [][]byte{}
	keyPaths := []string{}
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
		keyPaths = append(keyPaths, address.Configuration.AbsoluteKeypath().Encode())

		// Special serialization of the unsigned transaction for the mobile verification app.
		txIn.SignatureScript = subScript
	}

	signatures, err := keystore.dbb.Sign(btcProposedTx, signatureHashes, keyPaths)
	if isErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return errp.WithMessage(err, "Failed to sign signature hash")
	}
	if len(signatures) != len(transaction.TxIn) {
		panic("number of signatures doesn't match number of inputs")
	}
	for i, signature := range signatures {
		signature := signature
		btcProposedTx.Signatures[i][0] = &signature.Signature
	}
	return nil
}

func (keystore *keystore) signETHTransaction(txProposal *eth.TxProposal) error {
	signatureHashes := [][]byte{
		txProposal.Signer.Hash(txProposal.Tx).Bytes(),
	}
	signatures, err := keystore.dbb.Sign(nil, signatureHashes, []string{txProposal.Keypath.Encode()})
	if isErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return err
	}
	if len(signatures) != 1 {
		panic("expecting one signature")
	}
	signature := signatures[0]
	// We serialize the sig (including the recid at the last byte) so we can use WithSignature()
	// without modifications, even though it deserializes it again immediately. We do this because
	// it also modifies the `V` value according to EIP155.
	sig := make([]byte, 65)
	copy(sig[:32], math.PaddedBigBytes(signature.R, 32))
	copy(sig[32:64], math.PaddedBigBytes(signature.S, 32))
	sig[64] = byte(signature.RecID)
	signedTx, err := txProposal.Tx.WithSignature(txProposal.Signer, sig)
	if err != nil {
		return err
	}
	txProposal.Tx = signedTx
	return nil
}

// SignTransaction implements keystore.Keystore.
func (keystore *keystore) SignTransaction(proposedTx interface{}) error {
	switch specificProposedTx := proposedTx.(type) {
	case *btc.ProposedTransaction:
		return keystore.signBTCTransaction(specificProposedTx)
	case *eth.TxProposal:
		return keystore.signETHTransaction(specificProposedTx)
	default:
		panic("unknown proposal type")
	}
}
