// Copyright (c) 2016 The btcsuite developers
// Use of this source code is governed by an ISC
// license that can be found in the LICENSE file.

// Package maketx provides transaction creation code for wallets.
package maketx

import (
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"
)

// FeeForSerializeSize calculates the required fee for a transaction of some
// arbitrary size given a mempool's relay fee policy.
func FeeForSerializeSize(relayFeePerKb btcutil.Amount, txSerializeSize int, logEntry *logrus.Entry) btcutil.Amount {
	fee := relayFeePerKb * btcutil.Amount(txSerializeSize) / 1000

	if fee == 0 && relayFeePerKb > 0 {
		fee = relayFeePerKb
	}

	if fee < 0 || fee > btcutil.MaxSatoshi {
		fee = btcutil.MaxSatoshi
	}
	logEntry.WithFields(logrus.Fields{"relayFeePerKb": relayFeePerKb, "txSerializeSize": txSerializeSize, "fee": fee}).Debug("Calculated fee is %s", fee)

	return fee
}

// IsDustAmount determines whether a transaction output value and script length would
// cause the output to be considered dust.  Transactions with dust outputs are
// not standard and are rejected by mempools with default policies.
func IsDustAmount(amount btcutil.Amount, scriptSize int, relayFeePerKb btcutil.Amount) bool {
	// Calculate the total (estimated) cost to the network.  This is
	// calculated using the serialize size of the output plus the serial
	// size of a transaction input which redeems it.  The output is assumed
	// to be compressed P2PKH as this is the most common script type.  Use
	// the average size of a compressed P2PKH redeem input (148) rather than
	// the largest possible (txsizes.RedeemP2PKHInputSize).
	totalSize := 8 + wire.VarIntSerializeSize(uint64(scriptSize)) +
		scriptSize + 148

	// Dust is defined as an output value where the total cost to the network
	// (output size + input size) is greater than 1/3 of the relay fee.
	return int64(amount)*1000/(3*int64(totalSize)) < int64(relayFeePerKb)
}

// SumOutputSerializeSizes sums up the serialized size of the supplied outputs.
func SumOutputSerializeSizes(outputs []*wire.TxOut) (serializeSize int) {
	for _, txOut := range outputs {
		serializeSize += txOut.SerializeSize()
	}
	return serializeSize
}

// EstimateSerializeSize returns a worst case serialize size estimate for a
// signed transaction that spends inputCount number of compressed P2PKH outputs
// and contains each transaction output from txOuts.  The estimated size is
// incremented for an additional P2PKH change output if addChangeOutput is true.
func EstimateSerializeSize(inputCount int, txOuts []*wire.TxOut, addChangeOutput bool) int {
	changeSize := 0
	outputCount := len(txOuts)
	if addChangeOutput {
		changeSize = P2PKHOutputSize
		outputCount++
	}

	// 8 additional bytes are for version and locktime
	return 8 + wire.VarIntSerializeSize(uint64(inputCount)) +
		wire.VarIntSerializeSize(uint64(outputCount)) +
		inputCount*RedeemP2PKHInputSize +
		SumOutputSerializeSizes(txOuts) +
		changeSize
}

// RedeemP2PKHSigScriptSize is the worst case (largest) serialize size
// of a transaction input script that redeems a compressed P2PKH output.
// It is calculated as:
//
//   - OP_DATA_73
//   - 72 bytes DER signature + 1 byte sighash
//   - OP_DATA_33
//   - 33 bytes serialized compressed pubkey
const RedeemP2PKHSigScriptSize = 1 + 73 + 1 + 33

// P2PKHPkScriptSize is the size of a transaction output script that
// pays to a compressed pubkey hash.  It is calculated as:
//
//   - OP_DUP
//   - OP_HASH160
//   - OP_DATA_20
//   - 20 bytes pubkey hash
//   - OP_EQUALVERIFY
//   - OP_CHECKSIG
const P2PKHPkScriptSize = 1 + 1 + 1 + 20 + 1 + 1

// P2PKHOutputSize is the serialize size of a transaction output with a
// P2PKH output script.  It is calculated as:
//
//   - 8 bytes output value
//   - 1 byte compact int encoding value 25
//   - 25 bytes P2PKH output script
const P2PKHOutputSize = 8 + 1 + P2PKHPkScriptSize

// RedeemP2PKHInputSize is the worst case (largest) serialize size of a
// transaction input redeeming a compressed P2PKH output.  It is
// calculated as:
//
//   - 32 bytes previous tx
//   - 4 bytes output index
//   - 1 byte compact int encoding value 107
//   - 107 bytes signature script
//   - 4 bytes sequence
const RedeemP2PKHInputSize = 32 + 4 + 1 + RedeemP2PKHSigScriptSize + 4
