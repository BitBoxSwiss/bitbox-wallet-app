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
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/signing"
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

// estimateTxSize gives the worst case tx size estimate. All inputs are assumed to be of the same
// structure.
// inputCount is the number of inputs in the tx.
// inputConfiguration defines the structure of every input.
// outputPkScriptSize is the size of the output pkScript. One output is assumed (apart from change).
// changePkScriptSize  is the size of the change pkScript. A value of 0 means that there is no change output.
// This function computes the virtual size of a transaction, taking segwit discount into account.
func estimateTxSize(
	inputCount int,
	inputConfiguration *signing.Configuration,
	outputPkScriptSize int,
	changePkScriptSize int) int {
	const (
		outputCount  = 2 // 1 output + 1 change output
		versionSize  = 4
		lockTimeSize = 4
		nonWitness   = 4 // factor for non-witness fields
	)
	sigScriptSize, hasWitness := addresses.SigScriptWitnessSize(inputConfiguration)
	inputSize := calcInputSize(sigScriptSize)

	txWeight := nonWitness * (versionSize + lockTimeSize + wire.VarIntSerializeSize(uint64(inputCount)) +
		wire.VarIntSerializeSize(uint64(outputCount)) +
		inputCount*inputSize +
		outputSize(outputPkScriptSize) +
		outputSize(changePkScriptSize))
	if hasWitness {
		// For now, every input has a witness serialization of this format:
		// <serialized sig> <serialized compressed pubkey>
		const (
			signatureSize = 73 // including SIGHASH op
			pubkeySize    = 33
		)
		witnessSize := wire.VarIntSerializeSize(2) +
			wire.VarIntSerializeSize(signatureSize) + signatureSize +
			wire.VarIntSerializeSize(pubkeySize) + pubkeySize
		txWeight += inputCount * witnessSize
		txWeight += 2 // segwit marker + segwit flag
	}
	// return txWeight/4 rounded up.
	if txWeight%4 == 0 {
		return txWeight / 4
	}
	return txWeight/4 + 1
}
