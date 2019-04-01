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

package bitbox02

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	keystorePkg "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/sirupsen/logrus"
)

type keystore struct {
	device        *Device
	configuration *signing.Configuration
	cosignerIndex int
	log           *logrus.Entry
}

// CosignerIndex implements keystore.Keystore.
func (keystore *keystore) CosignerIndex() int {
	return keystore.cosignerIndex
}

// CanVerifyAddress implements keystore.Keystore.
func (keystore *keystore) CanVerifyAddress(configuration *signing.Configuration, coin coinpkg.Coin) (bool, bool, error) {
	_, ok := msgCoinMap[coin.Code()]
	optional := false
	return ok, optional, nil
}

// VerifyAddress implements keystore.Keystore.
func (keystore *keystore) VerifyAddress(
	configuration *signing.Configuration, coin coinpkg.Coin) error {
	canVerifyAddress, _, err := keystore.CanVerifyAddress(configuration, coin)
	if err != nil {
		return err
	}
	if !canVerifyAddress {
		panic("CanVerifyAddress must be true")
	}
	msgScriptType, ok := map[signing.ScriptType]messages.BTCScriptType{
		signing.ScriptTypeP2PKH:      messages.BTCScriptType_SCRIPT_P2PKH,
		signing.ScriptTypeP2WPKHP2SH: messages.BTCScriptType_SCRIPT_P2WPKH_P2SH,
		signing.ScriptTypeP2WPKH:     messages.BTCScriptType_SCRIPT_P2WPKH,
	}[configuration.ScriptType()]
	if !ok {
		panic("unsupported script type")
	}
	_, err = keystore.device.BTCPub(
		msgCoinMap[coin.Code()], configuration.AbsoluteKeypath().ToUInt32(),
		messages.BTCPubRequest_ADDRESS, msgScriptType, true)
	return err
}

// CanVerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) CanVerifyExtendedPublicKey() bool {
	return true
}

func (keystore *keystore) VerifyExtendedPublicKey(coin coinpkg.Coin, keyPath signing.AbsoluteKeypath, configuration *signing.Configuration) error {
	if !keystore.CanVerifyExtendedPublicKey() {
		panic("CanVerifyExtendedPublicKey must be true")
	}
	msgCoin, ok := msgCoinMap[coin.Code()]
	if !ok {
		return errp.New("unsupported coin")
	}
	var msgOutputType messages.BTCPubRequest_OutputType
	btcCoin, ok := coin.(*btc.Coin)
	if !ok {
		return errp.New("A coin must be BTC based to support xpub verification")
	}
	switch btcCoin.Net().Net {
	case chaincfg.MainNetParams.Net, ltc.MainNetParams.Net:
		msgOutputTypes := map[signing.ScriptType]messages.BTCPubRequest_OutputType{
			signing.ScriptTypeP2PKH:      messages.BTCPubRequest_XPUB,
			signing.ScriptTypeP2WPKHP2SH: messages.BTCPubRequest_YPUB,
			signing.ScriptTypeP2WPKH:     messages.BTCPubRequest_ZPUB,
		}
		msgOutputType, ok = msgOutputTypes[configuration.ScriptType()]
		if !ok {
			msgOutputType = messages.BTCPubRequest_XPUB
		}
	case chaincfg.TestNet3Params.Net, ltc.TestNet4Params.Net:
		msgOutputType = messages.BTCPubRequest_TPUB
	default:
		msgOutputType = messages.BTCPubRequest_XPUB
	}
	_, err := keystore.device.BTCPub(
		msgCoin, keyPath.ToUInt32(), msgOutputType, messages.BTCScriptType_SCRIPT_UNKNOWN, true)
	if err != nil {
		return err
	}
	return nil
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) ExtendedPublicKey(
	coin coinpkg.Coin, keyPath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	msgCoin, ok := msgCoinMap[coin.Code()]
	if !ok {
		return nil, errp.New("unsupported coin")
	}
	var xpubStr string
	xpubStr, err := keystore.device.BTCPub(
		msgCoin, keyPath.ToUInt32(),
		messages.BTCPubRequest_XPUB, messages.BTCScriptType_SCRIPT_UNKNOWN, false)
	if err != nil {
		return nil, err
	}
	return hdkeychain.NewKeyFromString(xpubStr)
}

func (keystore *keystore) signBTCTransaction(btcProposedTx *btc.ProposedTransaction) error {
	signatures, err := keystore.device.BTCSign(btcProposedTx)
	if isErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return err
	}
	for index, signature := range signatures {
		signature := signature
		btcProposedTx.Signatures[index][keystore.CosignerIndex()] = signature
	}
	return nil
}

func (keystore *keystore) signETHTransaction(*eth.TxProposal) error {
	panic("todo")
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
