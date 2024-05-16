// Copyright (c) 2016 The btcsuite developers
// Use of this source code is governed by an ISC
// license that can be found in the LICENSE file.

// Package maketx provides transaction creation code for wallets.
package maketx

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/sirupsen/logrus"
)

// feeForSerializeSize calculates the required fee for a transaction of some
// arbitrary size given a mempool's relay fee policy.
func feeForSerializeSize(relayFeePerKb btcutil.Amount, txSerializeSize int, log *logrus.Entry) btcutil.Amount {
	fee := relayFeePerKb * btcutil.Amount(txSerializeSize) / 1000

	if fee == 0 && relayFeePerKb > 0 {
		fee = relayFeePerKb
	}

	if fee < 0 || fee > btcutil.MaxSatoshi {
		fee = btcutil.MaxSatoshi
	}
	log.WithFields(logrus.Fields{"relayFeePerKb": relayFeePerKb, "txSerializeSize": txSerializeSize, "fee": fee}).Debugf("Calculated fee is %s", fee)

	return fee
}

// isDustAmount determines whether a transaction output value and script length would
// cause the output to be considered dust.  Transactions with dust outputs are
// not standard and are rejected by mempools with default policies.
func isDustAmount(
	amount btcutil.Amount,
	pkScriptSize int,
	configuration *signing.Configuration,
	relayFeePerKb btcutil.Amount) bool {
	// Calculate the total (estimated) cost to the network.  This is
	// calculated using the serialize size of the output plus the serial
	// size of a transaction input which redeems it.
	sigScriptSize, _ := sigScriptWitnessSize(configuration)
	inputSize := calcInputSize(sigScriptSize)
	totalSize := outputSize(pkScriptSize) + inputSize

	// Dust is defined as an output value where the total cost to the network
	// (output size + input size) is greater than 1/3 of the relay fee.
	return int64(amount)*1000/(3*int64(totalSize)) < int64(relayFeePerKb)
}
