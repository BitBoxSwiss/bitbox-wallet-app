// SPDX-License-Identifier: Apache-2.0

package maketx

import (
	"crypto/rand"
	"encoding/binary"
	mrand "math/rand"
	"sort"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/psbt"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
)

// PreviousOutputs represents a UTXO set. It also implements `txscript.PrevOutputFetcher`.
type PreviousOutputs map[wire.OutPoint]UTXO

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
	Fee btcutil.Amount
	// ChangeAddress is the address of the wallet to which the change of the transaction is sent.
	ChangeAddress   *addresses.AccountAddress
	PreviousOutputs PreviousOutputs
	PaymentRequest  *accounts.PaymentRequest
	// If not empty, we are sending to a silent payment recipient. The keystore needs access to this
	// to be able to generate the silent payment output. See BIP-352.
	SilentPaymentAddress string
	// OutIndex is the index of the output we send to.
	OutIndex int
	Psbt     *psbt.Packet
}

// SigHashes computes the hashes cache to speed up per-input sighash computations.
func (txProposal *TxProposal) SigHashes() *txscript.TxSigHashes {
	return txscript.NewTxSigHashes(txProposal.Psbt.UnsignedTx, txProposal.PreviousOutputs)
}

// Total is amount+fee.
func (txProposal *TxProposal) Total() btcutil.Amount {
	return txProposal.Amount + txProposal.Fee
}

// UTXO contains the data needed of a spendable UTXO in a new tx.
type UTXO struct {
	TxOut   *wire.TxOut
	Address *addresses.AccountAddress
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
		inputConfigurations[i] = spendableOutputs[outPoint].Address.AccountConfiguration
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

// OutputInfo carries info for the transaction output script sending funds to the recipient.
type OutputInfo struct {
	silentPaymentAddress string
	pkScript             []byte
}

func (o *OutputInfo) pkScriptLen() int {
	if o.silentPaymentAddress != "" {
		// Length of a Taproot output, which a silent payment output will result in.
		return 34
	}
	return len(o.pkScript)
}

// NewOutputInfoSilentPayment creates an output info when sending to a silent payment address.
func NewOutputInfoSilentPayment(address string) *OutputInfo {
	return &OutputInfo{silentPaymentAddress: address}
}

// NewOutputInfo creates an output info when sending directly to a pubkey script.
func NewOutputInfo(pkScript []byte) *OutputInfo {
	return &OutputInfo{pkScript: pkScript}
}

// NewTxSpendAll creates a transaction which spends all available unspent outputs.
func NewTxSpendAll(
	coin coinpkg.Coin,
	spendableOutputs map[wire.OutPoint]UTXO,
	outputInfo *OutputInfo,
	feePerKb btcutil.Amount,
	log *logrus.Entry,
) (*TxProposal, error) {
	selectedOutPoints := []wire.OutPoint{}
	inputs := []*wire.TxIn{}
	outputsSum := btcutil.Amount(0)
	for outPoint, output := range spendableOutputs {
		selectedOutPoints = append(selectedOutPoints, outPoint)
		outputsSum += btcutil.Amount(output.TxOut.Value)
		inputs = append(inputs, wire.NewTxIn(&outPoint, nil, nil))
	}
	txSize := estimateTxSize(
		toInputConfigurations(spendableOutputs, selectedOutPoints),
		outputInfo.pkScriptLen(),
		0)
	maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
	if outputsSum < maxRequiredFee {
		return nil, errp.WithStack(errors.ErrInsufficientFunds)
	}
	output := wire.NewTxOut(int64(outputsSum-maxRequiredFee), outputInfo.pkScript)
	unsignedTransaction := &wire.MsgTx{
		Version:  wire.TxVersion,
		TxIn:     inputs,
		TxOut:    []*wire.TxOut{output},
		LockTime: 0,
	}

	secureRand := mrand.New(mrand.NewSource(secureSeed()))
	shuffleTxInputsAndOutputs(unsignedTransaction, secureRand)

	log.WithField("fee", maxRequiredFee).Debug("Preparing transaction to spend all outputs")

	setRBF(coin, unsignedTransaction)
	psbt, err := psbt.NewFromUnsignedTx(unsignedTransaction)
	if err != nil {
		return nil, err
	}
	return &TxProposal{
		Coin:                 coin,
		Amount:               btcutil.Amount(output.Value),
		Fee:                  maxRequiredFee,
		PreviousOutputs:      spendableOutputs,
		SilentPaymentAddress: outputInfo.silentPaymentAddress,
		// Only one output in send-all
		OutIndex: 0,
		Psbt:     psbt,
	}, nil
}

// NewTx creates a transaction from a set of unspent outputs, targeting an output value. A subset of
// the unspent outputs is selected to cover the needed amount.
//
// changeAddress: a change output to this address is added if needed.
func NewTx(
	coin coinpkg.Coin,
	spendableOutputs map[wire.OutPoint]UTXO,
	outputInfo *OutputInfo,
	outputAmount int64,
	feePerKb btcutil.Amount,
	changeAddress *addresses.AccountAddress,
	log *logrus.Entry,
) (*TxProposal, error) {
	output := wire.NewTxOut(outputAmount, outputInfo.pkScript)

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
			outputInfo.pkScriptLen(),
			len(changePKScript))
		maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
		if selectedOutputsSum-targetAmount < maxRequiredFee {
			targetFee = maxRequiredFee
			continue
		}

		inputs := make([]*wire.TxIn, len(selectedOutPoints))
		previousOutputs := make(PreviousOutputs, len(selectedOutPoints))
		for i, outPoint := range selectedOutPoints {
			inputs[i] = wire.NewTxIn(&outPoint, nil, nil)
			previousOutputs[outPoint] = spendableOutputs[outPoint]
		}
		unsignedTransaction := &wire.MsgTx{
			Version:  wire.TxVersion,
			TxIn:     inputs,
			TxOut:    outputs,
			LockTime: 0,
		}
		changeAmount := selectedOutputsSum - targetAmount - maxRequiredFee
		changeIsDust := isDustAmount(
			changeAmount, len(changePKScript), changeAddress.AccountConfiguration, feePerKb)
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

		secureRand := mrand.New(mrand.NewSource(secureSeed()))
		shuffleTxInputsAndOutputs(unsignedTransaction, secureRand)

		log.WithField("fee", finalFee).Debug("Preparing transaction")

		outIndex := -1
		for i, txOut := range unsignedTransaction.TxOut {
			if txOut == output {
				outIndex = i
				break
			}
		}
		if outIndex == -1 {
			return nil, errp.New("could not identify output")
		}

		setRBF(coin, unsignedTransaction)
		psbt, err := psbt.NewFromUnsignedTx(unsignedTransaction)
		if err != nil {
			return nil, err
		}

		return &TxProposal{
			Coin:                 coin,
			Amount:               targetAmount,
			Fee:                  finalFee,
			ChangeAddress:        changeAddress,
			PreviousOutputs:      previousOutputs,
			SilentPaymentAddress: outputInfo.silentPaymentAddress,
			OutIndex:             outIndex,
			Psbt:                 psbt,
		}, nil
	}
}

// shuffleTxInputsAndOutputs shuffles both the TxIn and TxOut slices of a wire.MsgTx.
func shuffleTxInputsAndOutputs(tx *wire.MsgTx, secureRand *mrand.Rand) {
	// Shuffle inputs
	secureRand.Shuffle(len(tx.TxIn), func(i, j int) {
		tx.TxIn[i], tx.TxIn[j] = tx.TxIn[j], tx.TxIn[i]
	})

	// Shuffle outputs
	secureRand.Shuffle(len(tx.TxOut), func(i, j int) {
		tx.TxOut[i], tx.TxOut[j] = tx.TxOut[j], tx.TxOut[i]
	})
}

// secureSeed generates a secure seed value.
func secureSeed() int64 {
	var b [8]byte
	_, err := rand.Read(b[:])
	if err != nil {
		return time.Now().UnixNano() // use timestamp as fallback seed
	}
	return int64(binary.LittleEndian.Uint64(b[:]))
}
