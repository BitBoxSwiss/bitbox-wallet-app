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

package bitbox02

import (
	"bytes"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	keystorePkg "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/sirupsen/logrus"
)

type keystore struct {
	device        *Device
	configuration *signing.Configuration
	cosignerIndex int
	log           *logrus.Entry
}

// Type implements keystore.Keystore.
func (keystore *keystore) Type() keystorePkg.Type {
	return keystorePkg.TypeHardware
}

// CosignerIndex implements keystore.Keystore.
func (keystore *keystore) CosignerIndex() int {
	return keystore.cosignerIndex
}

// SupportsAccount implements keystore.Keystore.
func (keystore *keystore) SupportsAccount(
	coin coin.Coin, multisig bool, meta interface{}) bool {
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		if (coin.Code() == coinpkg.CodeLTC || coin.Code() == coinpkg.CodeTLTC) && !keystore.device.SupportsLTC() {
			return false
		}
		scriptType := meta.(signing.ScriptType)
		return !multisig && scriptType != signing.ScriptTypeP2PKH
	case *eth.Coin:
		if specificCoin.ERC20Token() != nil {
			return keystore.device.SupportsERC20(specificCoin.ERC20Token().ContractAddress().String())
		}
		return keystore.device.SupportsETH(ethMsgCoinMap[coin.Code()])
	default:
		return false
	}
}

// SupportsUnifiedAccounts implements keystore.Keystore.
func (keystore *keystore) SupportsUnifiedAccounts() bool {
	return true
}

// CanVerifyAddress implements keystore.Keystore.
func (keystore *keystore) CanVerifyAddress(coin coinpkg.Coin) (bool, bool, error) {
	const optional = false
	switch coin.(type) {
	case *btc.Coin:
		_, ok := btcMsgCoinMap[coin.Code()]
		return ok, optional, nil
	case *eth.Coin:
		_, ok := ethMsgCoinMap[coin.Code()]
		return ok, optional, nil
	}
	return false, false, nil
}

// VerifyAddress implements keystore.Keystore.
func (keystore *keystore) VerifyAddress(
	configuration *signing.Configuration, coin coinpkg.Coin) error {
	canVerifyAddress, _, err := keystore.CanVerifyAddress(coin)
	if err != nil {
		return err
	}
	if !canVerifyAddress {
		panic("CanVerifyAddress must be true")
	}
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		msgScriptType, ok := btcMsgScriptTypeMap[configuration.ScriptType()]
		if !ok {
			panic("unsupported scripttype")
		}
		_, err = keystore.device.BTCAddress(
			btcMsgCoinMap[coin.Code()],
			configuration.AbsoluteKeypath().ToUInt32(),
			firmware.NewBTCScriptConfigSimple(msgScriptType),
			true,
		)
		if firmware.IsErrorAbort(err) {
			// No special action on user abort.
			return nil
		}
		if err != nil {
			return err
		}
	case *eth.Coin:
		msgCoin, ok := ethMsgCoinMap[coin.Code()]
		if !ok {
			return errp.New("unsupported coin")
		}
		// No contract address, displays 'Ethereum' etc. depending on `msgCoin`.
		contractAddress := []byte{}
		if specificCoin.ERC20Token() != nil {
			// Displays the erc20 unit based on the contract.
			contractAddress = specificCoin.ERC20Token().ContractAddress().Bytes()
		}
		_, err := keystore.device.ETHPub(
			msgCoin, configuration.AbsoluteKeypath().ToUInt32(),
			messages.ETHPubRequest_ADDRESS, true, contractAddress)
		if firmware.IsErrorAbort(err) {
			// No special action on user abort.
			return nil
		}
		if err != nil {
			return err
		}
	default:
		return errp.New("unsupported coin")
	}
	return nil
}

// CanVerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) CanVerifyExtendedPublicKey() bool {
	return true
}

func (keystore *keystore) VerifyExtendedPublicKey(
	coin coinpkg.Coin, keyPath signing.AbsoluteKeypath, configuration *signing.Configuration) error {
	if !keystore.CanVerifyExtendedPublicKey() {
		panic("CanVerifyExtendedPublicKey must be true")
	}
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		msgCoin, ok := btcMsgCoinMap[coin.Code()]
		if !ok {
			return errp.New("unsupported coin")
		}
		var msgXPubType messages.BTCPubRequest_XPubType
		switch specificCoin.Net().Net {
		case chaincfg.MainNetParams.Net, ltc.MainNetParams.Net:
			msgXPubTypes := map[signing.ScriptType]messages.BTCPubRequest_XPubType{
				signing.ScriptTypeP2WPKHP2SH: messages.BTCPubRequest_YPUB,
				signing.ScriptTypeP2WPKH:     messages.BTCPubRequest_ZPUB,
			}
			msgXPubType, ok = msgXPubTypes[configuration.ScriptType()]
			if !ok {
				msgXPubType = messages.BTCPubRequest_XPUB
			}
		case chaincfg.TestNet3Params.Net, ltc.TestNet4Params.Net:
			msgXPubType = messages.BTCPubRequest_TPUB
		default:
			msgXPubType = messages.BTCPubRequest_XPUB
		}
		_, err := keystore.device.BTCXPub(
			msgCoin, keyPath.ToUInt32(), msgXPubType, true)
		if firmware.IsErrorAbort(err) {
			// No special action taken on user abort.
			return nil
		}
		if err != nil {
			return err
		}
	case *eth.Coin:
		return errp.New("unsupported operation")
	}
	return nil
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) ExtendedPublicKey(
	coin coinpkg.Coin, keyPath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	switch coin.(type) {
	case *btc.Coin:
		msgCoin, ok := btcMsgCoinMap[coin.Code()]
		if !ok {
			return nil, errp.New("unsupported coin")
		}
		xpubStr, err := keystore.device.BTCXPub(
			msgCoin, keyPath.ToUInt32(),
			messages.BTCPubRequest_XPUB, false)
		if err != nil {
			return nil, err
		}
		return hdkeychain.NewKeyFromString(xpubStr)
	case *eth.Coin:
		msgCoin, ok := ethMsgCoinMap[coin.Code()]
		if !ok {
			return nil, errp.New("unsupported coin")
		}
		xpubStr, err := keystore.device.ETHPub(
			msgCoin, keyPath.ToUInt32(), messages.ETHPubRequest_XPUB, false, []byte{})
		if err != nil {
			return nil, err
		}
		return hdkeychain.NewKeyFromString(xpubStr)
	default:
		return nil, errp.New("unsupported coin")
	}
}

func (keystore *keystore) signBTCTransaction(btcProposedTx *btc.ProposedTransaction) error {
	tx := btcProposedTx.TXProposal.Transaction

	scriptConfigs := make([]*messages.BTCScriptConfigWithKeypath, len(btcProposedTx.AccountSigningConfigurations))
	for i, cfg := range btcProposedTx.AccountSigningConfigurations {
		msgScriptType, ok := btcMsgScriptTypeMap[cfg.ScriptType()]
		if !ok {
			return errp.Newf("Unsupported script type %s", cfg.ScriptType())
		}
		scriptConfigs[i] = &messages.BTCScriptConfigWithKeypath{
			ScriptConfig: firmware.NewBTCScriptConfigSimple(msgScriptType),
			Keypath:      cfg.AbsoluteKeypath().ToUInt32(),
		}
	}
	coin := btcProposedTx.TXProposal.Coin.(*btc.Coin)
	msgCoin, ok := btcMsgCoinMap[coin.Code()]
	if !ok {
		return errp.Newf("coin not supported: %s", coin.Code())
	}

	inputs := make([]*firmware.BTCTxInput, len(tx.TxIn))
	for inputIndex, txIn := range tx.TxIn {
		prevOut := btcProposedTx.PreviousOutputs[txIn.PreviousOutPoint]

		prevTx := btcProposedTx.GetPrevTx(txIn.PreviousOutPoint.Hash)

		prevTxInputs := make([]*messages.BTCPrevTxInputRequest, len(prevTx.TxIn))
		for prevInputIndex, prevTxIn := range prevTx.TxIn {
			prevTxInputs[prevInputIndex] = &messages.BTCPrevTxInputRequest{
				PrevOutHash:     prevTxIn.PreviousOutPoint.Hash[:],
				PrevOutIndex:    prevTxIn.PreviousOutPoint.Index,
				SignatureScript: prevTxIn.SignatureScript,
				Sequence:        prevTxIn.Sequence,
			}
		}
		prevTxOuputs := make([]*messages.BTCPrevTxOutputRequest, len(prevTx.TxOut))
		for prevOutputIndex, prevTxOut := range prevTx.TxOut {
			prevTxOuputs[prevOutputIndex] = &messages.BTCPrevTxOutputRequest{
				Value:        uint64(prevTxOut.Value),
				PubkeyScript: prevTxOut.PkScript,
			}
		}
		inputAddress := btcProposedTx.GetAddress(prevOut.ScriptHashHex())

		// Find the script config index. Assumption: there is only one entry per script type, so we
		// don't have to check that the keypath prefix matches.
		var scriptConfigIndex uint32
		for i, cfg := range btcProposedTx.AccountSigningConfigurations {
			if cfg.ScriptType() == inputAddress.Configuration.ScriptType() {
				scriptConfigIndex = uint32(i)
				break
			}
		}

		inputs[inputIndex] = &firmware.BTCTxInput{
			Input: &messages.BTCSignInputRequest{
				PrevOutHash:       txIn.PreviousOutPoint.Hash[:],
				PrevOutIndex:      txIn.PreviousOutPoint.Index,
				PrevOutValue:      uint64(prevOut.Value),
				Sequence:          txIn.Sequence,
				Keypath:           inputAddress.Configuration.AbsoluteKeypath().ToUInt32(),
				ScriptConfigIndex: scriptConfigIndex,
			},
			PrevTx: &firmware.BTCPrevTx{
				Version:  uint32(prevTx.Version),
				Inputs:   prevTxInputs,
				Outputs:  prevTxOuputs,
				Locktime: prevTx.LockTime,
			},
		}
	}
	outputs := make([]*messages.BTCSignOutputRequest, len(tx.TxOut))
	for index, txOut := range tx.TxOut {
		scriptClass, addresses, _, err := txscript.ExtractPkScriptAddrs(txOut.PkScript, coin.Net())
		if err != nil {
			return errp.WithStack(err)
		}
		if len(addresses) != 1 {
			return errp.New("couldn't parse pkScript")
		}
		msgOutputType, ok := btcMsgOutputTypeMap[scriptClass]
		if !ok {
			return errp.Newf("unsupported output type: %d", scriptClass)
		}
		changeAddress := btcProposedTx.TXProposal.ChangeAddress
		isChange := changeAddress != nil && bytes.Equal(
			changeAddress.PubkeyScript(),
			txOut.PkScript,
		)
		var keypath []uint32
		if isChange {
			keypath = changeAddress.Configuration.AbsoluteKeypath().ToUInt32()
		}
		outputs[index] = &messages.BTCSignOutputRequest{
			Ours:    isChange,
			Type:    msgOutputType,
			Value:   uint64(txOut.Value),
			Hash:    addresses[0].ScriptAddress(),
			Keypath: keypath,
		}
	}

	signatures, err := keystore.device.BTCSign(
		msgCoin,
		scriptConfigs,
		&firmware.BTCTx{
			Version:  uint32(tx.Version),
			Inputs:   inputs,
			Outputs:  outputs,
			Locktime: tx.LockTime,
		},
	)
	if firmware.IsErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return err
	}
	for index, signature := range signatures {
		btcProposedTx.Signatures[index][keystore.CosignerIndex()] = &btcec.Signature{
			R: big.NewInt(0).SetBytes(signature[:32]),
			S: big.NewInt(0).SetBytes(signature[32:]),
		}
	}
	return nil
}

func (keystore *keystore) signETHTransaction(txProposal *eth.TxProposal) error {
	msgCoin, ok := ethMsgCoinMap[txProposal.Coin.Code()]
	if !ok {
		return errp.New("unsupported coin")
	}
	tx := txProposal.Tx
	recipient := tx.To()
	if recipient == nil {
		return errp.New("contract creation not supported")
	}
	signature, err := keystore.device.ETHSign(
		msgCoin,
		txProposal.Keypath.ToUInt32(),
		tx.Nonce(),
		tx.GasPrice(),
		tx.Gas(),
		*recipient,
		tx.Value(),
		tx.Data(),
	)
	if firmware.IsErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return err
	}
	signedTx, err := txProposal.Tx.WithSignature(txProposal.Signer, signature)
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
