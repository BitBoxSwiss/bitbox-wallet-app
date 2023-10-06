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
	"sort"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/txsort"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/sirupsen/logrus"
)

// PreviousOutputs represents a UTXO set. It also implements `txscript.PrevOutputFetcher`.
type PreviousOutputs map[wire.OutPoint]*transactions.SpendableOutput

// FetchPrevOutput implements `txscript.PrevOutputFetcher`.
func (p PreviousOutputs) FetchPrevOutput(op wire.OutPoint) *wire.TxOut {
	return p[op].TxOut
}

// TxProposal is the data needed for a new transaction to be able to display it and sign it.
type TxProposal struct {
	// Coin is the coin this tx was made for.
	Coin coinpkg.Coin
	// Amount is the amount that is sent out. The fee is not included and is deducted on top.
	Amount btcutil.Amount
	// Fee is the mining fee used.
	Fee         btcutil.Amount
	Transaction *wire.MsgTx
	// ChangeAddress is the address of the wallet to which the change of the transaction is sent.
	ChangeAddress   *addresses.AccountAddress
	PreviousOutputs PreviousOutputs
}

// Total is amount+fee.
func (txProposal *TxProposal) Total() btcutil.Amount {
	return txProposal.Amount + txProposal.Fee
}

// UTXO contains the data needed of a spendable UTXO in a new tx.
type UTXO struct {
	TxOut         *wire.TxOut
	Configuration *signing.Configuration
}

type byValue struct {
	outPoints []wire.OutPoint
	outputs   map[wire.OutPoint]UTXO
}

func (p *byValue) Len() int { return len(p.outPoints) }
func (p *byValue) Less(i, j int) bool {
	if p.outputs[p.outPoints[i]].TxOut.Value == p.outputs[p.outPoints[j]].TxOut.Value {
		// Secondary sort to make coin selection deterministic.
		return chainhash.HashH(p.outputs[p.outPoints[i]].TxOut.PkScript).String() < chainhash.HashH(p.outputs[p.outPoints[j]].TxOut.PkScript).String()
	}
	return p.outputs[p.outPoints[i]].TxOut.Value < p.outputs[p.outPoints[j]].TxOut.Value
}
func (p *byValue) Swap(i, j int) { p.outPoints[i], p.outPoints[j] = p.outPoints[j], p.outPoints[i] }

func coinSelection(
	minAmount btcutil.Amount,
	outputs map[wire.OutPoint]UTXO,
) (btcutil.Amount, []wire.OutPoint, error) {
	outPoints := []wire.OutPoint{}
	for outPoint := range outputs {
		outPoints = append(outPoints, outPoint)
	}
	sort.Sort(sort.Reverse(&byValue{outPoints, outputs}))
	selectedOutPoints := []wire.OutPoint{}
	outputsSum := btcutil.Amount(0)

	for _, outPoint := range outPoints {
		if outputsSum >= minAmount {
			break
		}
		selectedOutPoints = append(selectedOutPoints, outPoint)
		outputsSum += btcutil.Amount(outputs[outPoint].TxOut.Value)
	}
	if outputsSum < minAmount {
		return 0, nil, errp.WithStack(errors.ErrInsufficientFunds)
	}
	return outputsSum, selectedOutPoints, nil
}

// toInputConfigurations converts selected inputs to input configurations.
// Currently, it just repeats one inputConfiguration, as all inputs are of the same type.
// When mixing input types in a transaction, this function needs to be extended.
func toInputConfigurations(
	spendableOutputs map[wire.OutPoint]UTXO,
	selectedOutPoints []wire.OutPoint,
) []*signing.Configuration {
	inputConfigurations := make([]*signing.Configuration, len(selectedOutPoints))
	for i, outPoint := range selectedOutPoints {
		inputConfigurations[i] = spendableOutputs[outPoint].Configuration
	}
	return inputConfigurations
}

// Enable RBF (Replace-by-fee) for Bitcoin. Litecoin does not have RBF.
func setRBF(coin coinpkg.Coin, tx *wire.MsgTx) {
	for _, txIn := range tx.TxIn {
		if coin.Code() == coinpkg.CodeBTC ||
			coin.Code() == coinpkg.CodeTBTC ||
			coin.Code() == coinpkg.CodeRBTC {
			// Enable RBF
			// https://github.com/bitcoin/bips/blob/master/bip-0125.mediawiki#summary
			// Locktime is also enabled by this (https://en.bitcoin.it/wiki/NLockTime), but we keep
			// the locktime at 0, which has no effect.
			txIn.Sequence = wire.MaxTxInSequenceNum - 2
		}
	}
}

// NewTxSpendAll creates a transaction which spends all available unspent outputs.
func NewTxSpendAll(
	coin coinpkg.Coin,
	spendableOutputs map[wire.OutPoint]UTXO,
	outputPkScript []byte,
	feePerKb btcutil.Amount,
	log *logrus.Entry,
) (*TxProposal, error) {
	selectedOutPoints := []wire.OutPoint{}
	inputs := []*wire.TxIn{}
	previousOutputs := make(PreviousOutputs, len(spendableOutputs))
	outputsSum := btcutil.Amount(0)
	for outPoint, output := range spendableOutputs {
		outPoint := outPoint // avoid reference reuse due to range loop
		selectedOutPoints = append(selectedOutPoints, outPoint)
		outputsSum += btcutil.Amount(output.TxOut.Value)
		inputs = append(inputs, wire.NewTxIn(&outPoint, nil, nil))
		previousOutputs[outPoint] = &transactions.SpendableOutput{
			TxOut: spendableOutputs[outPoint].TxOut,
		}
	}
	txSize := estimateTxSize(
		toInputConfigurations(spendableOutputs, selectedOutPoints),
		len(outputPkScript),
		0)
	maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
	if outputsSum < maxRequiredFee {
		return nil, errp.WithStack(errors.ErrInsufficientFunds)
	}
	output := wire.NewTxOut(int64(outputsSum-maxRequiredFee), outputPkScript)
	unsignedTransaction := &wire.MsgTx{
		Version:  wire.TxVersion,
		TxIn:     inputs,
		TxOut:    []*wire.TxOut{output},
		LockTime: 0,
	}
	txsort.InPlaceSort(unsignedTransaction)
	log.WithField("fee", maxRequiredFee).Debug("Preparing transaction to spend all outputs")

	setRBF(coin, unsignedTransaction)
	return &TxProposal{
		Coin:            coin,
		Amount:          btcutil.Amount(output.Value),
		Fee:             maxRequiredFee,
		Transaction:     unsignedTransaction,
		PreviousOutputs: previousOutputs,
	}, nil
}

// NewTx creates a transaction from a set of unspent outputs, targeting an output value. A subset of
// the unspent outputs is selected to cover the needed amount.
//
// changeAddress: a change output to this address is added if needed.
func NewTx(
	coin coinpkg.Coin,
	spendableOutputs map[wire.OutPoint]UTXO,
	output *wire.TxOut,
	feePerKb btcutil.Amount,
	changeAddress *addresses.AccountAddress,
	log *logrus.Entry,
) (*TxProposal, error) {
	targetAmount := btcutil.Amount(output.Value)
	if targetAmount <= 0 {
		panic("amount must be positive")
	}
	outputs := []*wire.TxOut{output}
	changePKScript := changeAddress.PubkeyScript()

	targetFee := btcutil.Amount(0)
	for {
		selectedOutputsSum, selectedOutPoints, err := coinSelection(
			targetAmount+targetFee,
			spendableOutputs,
		)
		if err != nil {
			return nil, err
		}

		txSize := estimateTxSize(
			toInputConfigurations(spendableOutputs, selectedOutPoints),
			len(output.PkScript),
			len(changePKScript))
		maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
		if selectedOutputsSum-targetAmount < maxRequiredFee {
			targetFee = maxRequiredFee
			continue
		}

		inputs := make([]*wire.TxIn, len(selectedOutPoints))
		previousOutputs := make(PreviousOutputs, len(selectedOutPoints))
		for i, outPoint := range selectedOutPoints {
			outPoint := outPoint // avoids referencing the same variable across loop iterations
			inputs[i] = wire.NewTxIn(&outPoint, nil, nil)
			previousOutputs[outPoint] = &transactions.SpendableOutput{
				TxOut: spendableOutputs[outPoint].TxOut,
			}
		}
		unsignedTransaction := &wire.MsgTx{
			Version:  wire.TxVersion,
			TxIn:     inputs,
			TxOut:    outputs,
			LockTime: 0,
		}
		changeAmount := selectedOutputsSum - targetAmount - maxRequiredFee
		changeIsDust := isDustAmount(
			changeAmount, len(changePKScript), changeAddress.Configuration, feePerKb)
		finalFee := maxRequiredFee
		if changeIsDust {
			log.Info("change is dust")
			finalFee = selectedOutputsSum - targetAmount
		}
		if changeAmount != 0 && !changeIsDust {
			unsignedTransaction.TxOut = append(unsignedTransaction.TxOut,
				wire.NewTxOut(int64(changeAmount), changePKScript))
		} else {
			changeAddress = nil
		}
		txsort.InPlaceSort(unsignedTransaction)
		log.WithField("fee", finalFee).Debug("Preparing transaction")

		setRBF(coin, unsignedTransaction)
		return &TxProposal{
			Coin:            coin,
			Amount:          targetAmount,
			Fee:             finalFee,
			Transaction:     unsignedTransaction,
			ChangeAddress:   changeAddress,
			PreviousOutputs: previousOutputs,
		}, nil
	}
}
