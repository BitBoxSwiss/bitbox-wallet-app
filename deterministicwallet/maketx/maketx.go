package maketx

import (
	"errors"
	"math/rand"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/util/errp"
)

func coinSelection(
	minAmount btcutil.Amount,
	outputs map[wire.OutPoint]*wire.TxOut,
) (btcutil.Amount, []wire.OutPoint, error) {
	outPoints := []wire.OutPoint{}
	for outPoint := range outputs {
		outPoints = append(outPoints, outPoint)
	}
	//sort.Sort(sort.Reverse(byAmount(outPoints)))
	selectedOutPoints := []wire.OutPoint{}
	outputsSum := btcutil.Amount(0)

	for _, outPoint := range outPoints {
		if outputsSum >= minAmount {
			break
		}
		selectedOutPoints = append(selectedOutPoints, outPoint)
		outputsSum += btcutil.Amount(outputs[outPoint].Value)
	}
	if outputsSum < minAmount {
		return 0, nil, errp.New("insufficient funds")
	}
	return outputsSum, selectedOutPoints, nil
}

func NewTx(
	spendableOutputs map[wire.OutPoint]*wire.TxOut,
	output *wire.TxOut,
	feePerKb btcutil.Amount,
	getChangePKScript func() ([]byte, error),
	random *rand.Rand,
) (*wire.MsgTx, []wire.OutPoint, error) {
	targetAmount := btcutil.Amount(output.Value)
	outputs := []*wire.TxOut{output}
	estimatedSize := EstimateSerializeSize(1, outputs, true)
	targetFee := FeeForSerializeSize(feePerKb, estimatedSize)

	for {
		selectedOutputsSum, selectedOutPoints, err := coinSelection(
			targetAmount+targetFee,
			spendableOutputs,
		)
		if err != nil {
			return nil, nil, err
		}

		txSize := EstimateSerializeSize(len(selectedOutPoints), outputs, true)
		maxRequiredFee := FeeForSerializeSize(feePerKb, txSize)
		if selectedOutputsSum-targetAmount < maxRequiredFee {
			targetFee = maxRequiredFee
			continue
		}

		inputs := make([]*wire.TxIn, len(selectedOutPoints))
		for i, outPoint := range selectedOutPoints {
			inputs[i] = wire.NewTxIn(&outPoint, nil, nil)
		}
		unsignedTransaction := &wire.MsgTx{
			Version:  wire.TxVersion,
			TxIn:     inputs,
			TxOut:    outputs,
			LockTime: 0,
		}
		changeAmount := selectedOutputsSum - targetAmount - maxRequiredFee
		if changeAmount != 0 && !IsDustAmount(changeAmount, P2PKHPkScriptSize, feePerKb) {
			changePKScript, err := getChangePKScript()
			if err != nil {
				return nil, nil, err
			}
			if len(changePKScript) > P2PKHPkScriptSize {
				return nil, nil, errors.New("fee estimation requires change " +
					"scripts no larger than P2PKH output scripts")
			}
			changeOutput := wire.NewTxOut(int64(changeAmount), changePKScript)
			unsignedTransaction.TxOut = append(unsignedTransaction.TxOut, changeOutput)
			// Put change output in a random position.
			numOutputs := len(unsignedTransaction.TxOut)
			newChangeIndex := random.Intn(numOutputs)
			unsignedTransaction.TxOut[numOutputs-1], unsignedTransaction.TxOut[newChangeIndex] =
				unsignedTransaction.TxOut[newChangeIndex], unsignedTransaction.TxOut[numOutputs-1]

		}

		return unsignedTransaction, selectedOutPoints, nil
	}
}
