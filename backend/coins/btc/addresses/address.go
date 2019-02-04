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

package addresses

import (
	"fmt"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/sirupsen/logrus"
)

// AccountAddress models an address that belongs to an account of the user.
// It contains all the information needed to receive and spend funds.
type AccountAddress struct {
	btcutil.Address

	// AccountConfiguration contains the absolute keypath and xpubs of the
	// account. AccountConfiguration + RelativeKeypath = Configuration.
	AccountConfiguration *signing.Configuration
	RelativeKeypath      signing.RelativeKeypath
	// Configuration contains the absolute keypath and the extended public keys of the address.
	Configuration *signing.Configuration

	// HistoryStatus is used to determine if the address status changed, and to determine if the
	// address has been used before or not. The status corresponds to
	// https://github.com/kyuupichan/electrumx/blob/46f245891cb62845f9eec0f9549526a7e569eb03/docs/protocol-basics.rst#status.
	HistoryStatus string

	// redeemScript stores the redeem script of a BIP16 P2SH output or nil if address type is P2PKH.
	redeemScript []byte

	log *logrus.Entry
}

// NewAccountAddress creates a new account address.
func NewAccountAddress(
	accountConfiguration *signing.Configuration,
	keyPath signing.RelativeKeypath,
	net *chaincfg.Params,
	log *logrus.Entry,
) *AccountAddress {
	configuration, err := accountConfiguration.Derive(keyPath)
	if err != nil {
		log.WithError(err).Panic("Failed to derive the configuration.")
	}

	log = log.WithFields(logrus.Fields{
		"key-path":      configuration.AbsoluteKeypath().Encode(),
		"configuration": configuration.String(),
	})
	log.Debug("Creating new account address")

	var redeemScript []byte
	var address btcutil.Address

	if configuration.Multisig() {
		sortedPublicKeys := configuration.SortedPublicKeys()
		addresses := make([]*btcutil.AddressPubKey, len(sortedPublicKeys))
		for index, publicKey := range sortedPublicKeys {
			addresses[index], err = btcutil.NewAddressPubKey(publicKey.SerializeCompressed(), net)
			if err != nil {
				log.WithError(err).Panic("Failed to get a P2PK address from a public key.")
			}
		}
		redeemScript, err = txscript.MultiSigScript(addresses, configuration.SigningThreshold())
		if err != nil {
			log.WithError(err).Panic("Failed to get the redeem script for multisig.")
		}
		address, err = btcutil.NewAddressScriptHash(redeemScript, net)
		if err != nil {
			log.WithError(err).Panic("Failed to get a P2SH address for multisig.")
		}
	} else {
		publicKeyHash := btcutil.Hash160(configuration.PublicKeys()[0].SerializeCompressed())
		switch configuration.ScriptType() {
		case signing.ScriptTypeP2PKH:
			address, err = btcutil.NewAddressPubKeyHash(publicKeyHash, net)
			if err != nil {
				log.WithError(err).Panic("Failed to get P2PKH addr. from public key hash.")
			}
		case signing.ScriptTypeP2WPKHP2SH:
			var segwitAddress *btcutil.AddressWitnessPubKeyHash
			segwitAddress, err = btcutil.NewAddressWitnessPubKeyHash(publicKeyHash, net)
			if err != nil {
				log.WithError(err).Panic("Failed to get p2wpkh-p2sh addr. from publ. key hash.")
			}
			redeemScript, err = txscript.PayToAddrScript(segwitAddress)
			if err != nil {
				log.WithError(err).Panic("Failed to get redeem script for segwit address.")
			}
			address, err = btcutil.NewAddressScriptHash(redeemScript, net)
			if err != nil {
				log.WithError(err).Panic("Failed to get a P2SH address for segwit.")
			}
		case signing.ScriptTypeP2WPKH:
			address, err = btcutil.NewAddressWitnessPubKeyHash(publicKeyHash, net)
			if err != nil {
				log.WithError(err).Panic("Failed to get p2wpkh addr. from publ. key hash.")
			}
		default:
			log.Panic(fmt.Sprintf("Unrecognized script type: %s", configuration.ScriptType()))
		}
	}

	return &AccountAddress{
		Address:              address,
		AccountConfiguration: accountConfiguration,
		RelativeKeypath:      keyPath,
		Configuration:        configuration,
		HistoryStatus:        "",
		redeemScript:         redeemScript,
		log:                  log,
	}
}

// ID implements coin.Address.
func (address *AccountAddress) ID() string {
	return string(address.PubkeyScriptHashHex())
}

// EncodeForHumans implements coin.EncodeForHumans.
func (address *AccountAddress) EncodeForHumans() string {
	return address.EncodeAddress()
}

func (address *AccountAddress) isUsed() bool {
	return address.HistoryStatus != ""
}

// PubkeyScript returns the pubkey script of this address. Use this in a tx output to receive funds.
func (address *AccountAddress) PubkeyScript() []byte {
	script, err := txscript.PayToAddrScript(address.Address)
	if err != nil {
		address.log.WithError(err).Panic("Failed to get the pubkey script for an address.")
	}
	return script
}

// PubkeyScriptHashHex returns the hash of the pubkey script in hex format.
// It is used to subscribe to notifications at the ElectrumX server.
func (address *AccountAddress) PubkeyScriptHashHex() blockchain.ScriptHashHex {
	return blockchain.ScriptHashHex(chainhash.HashH(address.PubkeyScript()).String())
}

// ScriptForHashToSign returns whether this address is a segwit output and the script used when
// calculating the hash to be signed in a transaction. This info is needed when trying to spend
// from this address.
func (address *AccountAddress) ScriptForHashToSign() (bool, []byte) {
	if address.Configuration.Multisig() {
		return false, address.redeemScript
	}
	switch address.Configuration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		return false, address.PubkeyScript()
	case signing.ScriptTypeP2WPKHP2SH:
		return true, address.redeemScript
	case signing.ScriptTypeP2WPKH:
		return true, address.PubkeyScript()
	default:
		address.log.Panic("Unrecognized address type.")
	}
	panic("The end of the function cannot be reached.")
}

func index(publicKey *btcec.PublicKey, sortedPublicKeys []*btcec.PublicKey) int {
	for index, sortedPublicKey := range sortedPublicKeys {
		if sortedPublicKey.IsEqual(publicKey) {
			return index
		}
	}
	panic("Could not find a public key among the sorted public keys.")
}

// SignatureScript returns the signature script (and witness) needed to spend from this address.
// The signatures have to be provided in the order of the configuration (and some can be nil).
func (address *AccountAddress) SignatureScript(
	signatures []*btcec.Signature,
) ([]byte, wire.TxWitness) {
	if len(signatures) != address.Configuration.NumberOfSigners() {
		address.log.Panic("The wrong number of signatures were provided.")
	}
	if address.Configuration.Multisig() {
		length := address.Configuration.NumberOfSigners()
		publicKeys := address.Configuration.PublicKeys()
		sortedPublicKeys := address.Configuration.SortedPublicKeys()
		sortedSignatures := make([]*btcec.Signature, length)
		for i := 0; i < length; i++ {
			sortedSignatures[index(publicKeys[i], sortedPublicKeys)] = signatures[i]
		}
		scriptBuilder := txscript.NewScriptBuilder().AddOp(txscript.OP_0)
		for _, signature := range sortedSignatures {
			if signature != nil {
				scriptBuilder.AddData(append(signature.Serialize(), byte(txscript.SigHashAll)))
			}
		}
		signatureScript, err := scriptBuilder.AddData(address.redeemScript).Script()
		if err != nil {
			address.log.WithError(err).Panic("Failed to build signa. script for multisig.")
		}
		return signatureScript, nil
	}
	signature := signatures[0]
	if signature == nil {
		address.log.Panic("At least one signature has to be provided.")
	}
	publicKey := address.Configuration.PublicKeys()[0]
	switch address.Configuration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		signatureScript, err := txscript.NewScriptBuilder().
			AddData(append(signature.Serialize(), byte(txscript.SigHashAll))).
			AddData(publicKey.SerializeCompressed()).
			Script()
		if err != nil {
			address.log.WithError(err).Panic("Failed to build signature script for P2PKH.")
		}
		return signatureScript, nil
	case signing.ScriptTypeP2WPKHP2SH:
		signatureScript, err := txscript.NewScriptBuilder().
			AddData(address.redeemScript).
			Script()
		if err != nil {
			address.log.WithError(err).Panic("Failed to build segwit signature script.")
		}
		txWitness := wire.TxWitness{
			append(signature.Serialize(), byte(txscript.SigHashAll)),
			publicKey.SerializeCompressed(),
		}
		return signatureScript, txWitness
	case signing.ScriptTypeP2WPKH:
		txWitness := wire.TxWitness{
			append(signature.Serialize(), byte(txscript.SigHashAll)),
			publicKey.SerializeCompressed(),
		}
		return []byte{}, txWitness
	default:
		address.log.Panic("Unrecognized address type.")
	}
	panic("The end of the function cannot be reached.")
}
