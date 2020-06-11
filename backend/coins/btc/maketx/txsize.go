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

package maketx

import (
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

func calcInputSize(sigScriptSize int) int {
	// inputSize: 32 prevHash + 4 prevIndex + sigScript + 4 sequence
	return 32 + 4 + wire.VarIntSerializeSize(uint64(sigScriptSize)) + sigScriptSize + 4
}

func outputSize(pkScriptSize int) int {
	if pkScriptSize == 0 {
		return 0
	}
	return 8 + wire.VarIntSerializeSize(uint64(pkScriptSize)) + pkScriptSize
}

// estimateTxSize gives the worst case tx size estimate. The unit of the result is vbyte (virtual
// bytes), for the purpose of fee calculation.
// https://en.bitcoin.it/wiki/Weight_units
//
// Witnesses, if present, are assumed to have the following format:
// <serialized sig> <serialized compressed pubkey>
//
// inputConfigurations defines the number of inputs and the input configurations in the tx.
// outputPkScriptSize is the size of the output pkScript. One output is assumed (apart from change).
// changePkScriptSize  is the size of the change pkScript. A value of 0 means that there is no change output.
// This function computes the virtual size of a transaction, taking segwit discount into account.
func estimateTxSize(
	inputConfigurations []*signing.Configuration,
	outputPkScriptSize int,
	changePkScriptSize int) int {
	outputCount := 2 // 1 output + 1 change output
	if changePkScriptSize == 0 {
		outputCount = 1
	}

	const (
		versionSize  = 4
		lockTimeSize = 4
		// factor for non-witness fields, https://en.bitcoin.it/wiki/Weight_units#Weight_for_legacy_transactions
		nonWitness = 4
	)

	txWeight := nonWitness * (versionSize + lockTimeSize + wire.VarIntSerializeSize(uint64(len(inputConfigurations))) +
		wire.VarIntSerializeSize(uint64(outputCount)) +
		outputSize(outputPkScriptSize) +
		outputSize(changePkScriptSize))

	isSegwitTx := false
	for _, inputConfiguration := range inputConfigurations {
		_, hasWitness := addresses.SigScriptWitnessSize(inputConfiguration)
		if hasWitness {
			isSegwitTx = true
			break
		}
	}

	for _, inputConfiguration := range inputConfigurations {
		sigScriptSize, hasWitness := addresses.SigScriptWitnessSize(inputConfiguration)
		txWeight += nonWitness * calcInputSize(sigScriptSize)
		if isSegwitTx {
			const (
				// Including SIGHASH op. Assumes signatures follow the low-S requirement.
				// See https://en.bitcoin.it/wiki/BIP_0062#DER_encoding
				signatureSize = 72
				pubkeySize    = 33
			)
			if hasWitness {
				// For now, every input has a witness serialization of this format:
				// <serialized sig> <serialized compressed pubkey>
				txWeight += wire.VarIntSerializeSize(2) +
					wire.VarIntSerializeSize(signatureSize) + signatureSize +
					wire.VarIntSerializeSize(pubkeySize) + pubkeySize
			} else {
				// "Empty script witnesses are encoded as a zero byte"
				// https://github.com/bitcoin/bips/blob/d8a56c9f2b521bf4af5d588f217e7618cc44952c/bip-0144.mediawiki
				txWeight += wire.VarIntSerializeSize(0)
			}
		}
	}
	if isSegwitTx {
		txWeight += 2 // segwit marker + segwit flag
	}
	// return txWeight/4 rounded up.
	if txWeight%4 == 0 {
		return txWeight / 4
	}
	return txWeight/4 + 1
}
