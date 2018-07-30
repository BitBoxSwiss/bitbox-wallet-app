// Copyright 2018 Shift Devices AG
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
	"fmt"

	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

type keystore struct {
	dbb           *Device
	configuration *signing.Configuration
	cosignerIndex int
	log           *logrus.Entry
}

// // Configuration implements keystore.Keystore.
// func (keystore *keystore) Configuration() *signing.Configuration {
// 	return keystore.configuration
// }

// CosignerIndex implements keystore.Keystore.
func (keystore *keystore) CosignerIndex() int {
	return keystore.cosignerIndex
}

// Identifier implements keystore.Keystore.
func (keystore *keystore) Identifier() (string, error) {
	deviceInfo, err := keystore.dbb.DeviceInfo()
	if err != nil {
		return "", err
	}
	return deviceInfo.ID, nil
}

// HasSecureOutput implements keystore.Keystore.
func (keystore *keystore) HasSecureOutput() bool {
	return keystore.dbb.channel != nil
}

// OutputAddress implements keystore.Keystore.
func (keystore *keystore) OutputAddress(
	keyPath signing.AbsoluteKeypath, scriptType signing.ScriptType, coin coin.Coin) error {
	if !keystore.HasSecureOutput() {
		panic("HasSecureOutput must be true")
	}
	return keystore.dbb.DisplayAddress(keyPath.Encode(), fmt.Sprintf("%s-%s", coin.Name(), string(scriptType)))
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) ExtendedPublicKey(
	keyPath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	return keystore.dbb.XPub(keyPath.Encode())
}

// SignTransaction implements keystore.Keystore.
func (keystore *keystore) SignTransaction(proposedTx coin.ProposedTransaction) error {
	btcProposedTx, ok := proposedTx.(*btc.ProposedTransaction)
	if !ok {
		panic("only btc")
	}
	keystore.log.Info("Sign transaction")
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

	signatures, err := keystore.dbb.Sign(btcProposedTx.TXProposal, signatureHashes, keyPaths)
	if err != nil {
		return errp.WithMessage(err, "Failed to sign signature hash")
	}
	if len(signatures) != len(transaction.TxIn) {
		panic("number of signatures doesn't match number of inputs")
	}
	for i, signature := range signatures {
		signature := signature
		btcProposedTx.Signatures[i][keystore.CosignerIndex()] = &signature
	}
	return nil
}
