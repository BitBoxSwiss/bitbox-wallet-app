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
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/wire"
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

const (
	// Including SIGHASH op. Assumes signatures follow the low-S requirement.
	// See https://en.bitcoin.it/wiki/BIP_0062#DER_encoding
	signatureSize = 72
	pubkeySize    = 33
)

// Segwit v0 witnesses.
// <serialized sig> <serialized compressed pubkey>.
var witnessV0Size = wire.VarIntSerializeSize(2) +
	wire.VarIntSerializeSize(signatureSize) + signatureSize +
	wire.VarIntSerializeSize(pubkeySize) + pubkeySize

// sigScriptWitnessSize returns the maximum possible sigscript/witness size for a given address type.
// If there is no witness, 0 is returned.
func sigScriptWitnessSize(configuration *signing.Configuration) (int, int) {
	switch configuration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		// OP_DATA_72
		// 72 bytes of signature data (including SIGHASH op)
		// OP_DATA_33
		// 33 bytes of compressed pubkey
		// OP_73, OP_33 are data push ops.
		return 1 + 72 + 1 + 33, 0
	case signing.ScriptTypeP2WPKHP2SH:
		// OP_0 (1 byte) OP_20 (1 byte) pubkeyHash (20 bytes)
		const redeemScriptSize = 1 + 1 + 20
		// OP_DATA_22 (1 Byte) redeemScript (22 bytes)
		return 1 + redeemScriptSize, witnessV0Size
	case signing.ScriptTypeP2WPKH:
		return 0, witnessV0Size
	case signing.ScriptTypeP2TR:
		// Taproot key spend: <64 byte sig>
		return 0, wire.VarIntSerializeSize(1) + wire.VarIntSerializeSize(64) + 64
	default:
		panic("unknown address type")
	}
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
		_, witnessSize := sigScriptWitnessSize(inputConfiguration)
		if witnessSize > 0 {
			isSegwitTx = true
			break
		}
	}

	for _, inputConfiguration := range inputConfigurations {
		sigScriptSize, witnessSize := sigScriptWitnessSize(inputConfiguration)
		txWeight += nonWitness*calcInputSize(sigScriptSize) + witnessSize
		if isSegwitTx && witnessSize == 0 {
			// "Empty script witnesses are encoded as a zero byte"
			// https://github.com/bitcoin/bips/blob/d8a56c9f2b521bf4af5d588f217e7618cc44952c/bip-0144.mediawiki
			txWeight += wire.VarIntSerializeSize(0)
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
