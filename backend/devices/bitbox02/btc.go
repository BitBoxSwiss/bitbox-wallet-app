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
	"bytes"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/golang/protobuf/proto"
)

// BTCPub queries the device for a btc, ltc, tbtc, tltc xpub or address.
func (device *Device) BTCPub(
	coin messages.BTCCoin,
	keypath []uint32,
	outputType messages.BTCPubRequest_OutputType,
	scriptType messages.BTCScriptType,
	display bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_BtcPub{
			BtcPub: &messages.BTCPubRequest{
				Coin:       coin,
				Keypath:    keypath,
				OutputType: outputType,
				ScriptType: scriptType,
				Display:    display,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.Response_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

func (device *Device) queryBtcSign(request proto.Message) (
	*messages.BTCSignNextResponse, error) {
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	next, ok := response.Response.(*messages.Response_BtcSignNext)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return next.BtcSignNext, nil

}

// BTCSign signs a bitcoin or bitcoin-like transaction.
func (device *Device) BTCSign(
	btcProposedTx *btc.ProposedTransaction) ([]*btcec.Signature, error) {
	coin := btcProposedTx.TXProposal.Coin.(*btc.Coin)
	tx := btcProposedTx.TXProposal.Transaction
	signatures := make([]*btcec.Signature, len(tx.TxIn))
	msgCoin, ok := btcMsgCoinMap[coin.Code()]
	if !ok {
		return nil, errp.Newf("coin not supported: %s", coin.Code())
	}
	scriptType := btcProposedTx.TXProposal.AccountConfiguration.ScriptType()
	msgScriptType, ok := btcMsgScriptTypeMap[scriptType]
	if !ok {
		return nil, errp.Newf("Unsupported script type %s", scriptType)
	}

	// account #0
	// TODO: check that all inputs and change are the same account, and use that one.
	bip44Account := uint32(hdkeychain.HardenedKeyStart)
	next, err := device.queryBtcSign(&messages.Request{
		Request: &messages.Request_BtcSignInit{
			BtcSignInit: &messages.BTCSignInitRequest{
				Coin:         msgCoin,
				ScriptType:   msgScriptType,
				Bip44Account: bip44Account,
				Version:      uint32(tx.Version),
				NumInputs:    uint32(len(tx.TxIn)),
				NumOutputs:   uint32(len(tx.TxOut)),
				Locktime:     tx.LockTime,
			}}})
	if err != nil {
		return nil, err
	}
	for {
		switch next.Type {
		case messages.BTCSignNextResponse_INPUT:
			inputIndex := next.Index
			txIn := tx.TxIn[inputIndex] // requested input
			prevOut := btcProposedTx.PreviousOutputs[txIn.PreviousOutPoint]

			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignInput{
					BtcSignInput: &messages.BTCSignInputRequest{
						PrevOutHash:  txIn.PreviousOutPoint.Hash[:],
						PrevOutIndex: txIn.PreviousOutPoint.Index,
						PrevOutValue: uint64(prevOut.Value),
						Sequence:     txIn.Sequence,
						Keypath: btcProposedTx.GetAddress(prevOut.ScriptHashHex()).
							Configuration.AbsoluteKeypath().ToUInt32(),
					}}})
			if err != nil {
				return nil, err
			}
			if next.HasSignature {
				sigR := big.NewInt(0).SetBytes(next.Signature[:32])
				sigS := big.NewInt(0).SetBytes(next.Signature[32:])
				signatures[inputIndex] = &btcec.Signature{
					R: sigR,
					S: sigS,
				}
			}
		case messages.BTCSignNextResponse_OUTPUT:
			txOut := tx.TxOut[next.Index] // requested output
			scriptClass, addresses, _, err := txscript.ExtractPkScriptAddrs(txOut.PkScript, coin.Net())
			if err != nil {
				return nil, errp.WithStack(err)
			}
			if len(addresses) != 1 {
				return nil, errp.New("couldn't parse pkScript")
			}
			msgOutputType, ok := btcMsgOutputTypeMap[scriptClass]
			if !ok {
				return nil, errp.Newf("unsupported output type: %d", scriptClass)
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
			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignOutput{
					BtcSignOutput: &messages.BTCSignOutputRequest{
						Ours:    isChange,
						Type:    msgOutputType,
						Value:   uint64(txOut.Value),
						Hash:    addresses[0].ScriptAddress(),
						Keypath: keypath,
					}}})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_DONE:
			return signatures, nil
		}
	}
}
