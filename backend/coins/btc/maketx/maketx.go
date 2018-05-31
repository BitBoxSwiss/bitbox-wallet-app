package maketx

import (
	"errors"
	"sort"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/txsort"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

// ErrInsufficientFunds is returned when there are not enough funds to cover the target amount and
// fee.
var ErrInsufficientFunds = errors.New("insufficient funds")

// TxProposal is the data needed for a new transaction to be able to display it and sign it.
type TxProposal struct {
	// Coin is the coin this tx was made for.
	Coin                 coin.Coin
	AccountConfiguration *signing.Configuration
	// Amount is the amount that is sent out. The fee is not included and is deducted on top.
	Amount btcutil.Amount
	// Fee is the mining fee used.
	Fee         btcutil.Amount
	Transaction *wire.MsgTx
	// ChangeAddress is the address of the wallet to which the change of the transaction is sent.
	ChangeAddress *addresses.AccountAddress
}

// Total is amount+fee.
func (txProposal *TxProposal) Total() btcutil.Amount {
	return txProposal.Amount + txProposal.Fee
}

type byValue struct {
	outPoints []wire.OutPoint
	outputs   map[wire.OutPoint]*wire.TxOut
}

func (p *byValue) Len() int { return len(p.outPoints) }
func (p *byValue) Less(i, j int) bool {
	if p.outputs[p.outPoints[i]].Value == p.outputs[p.outPoints[j]].Value {
		// Secondary sort to make coin selection deterministic.
		return chainhash.HashH(p.outputs[p.outPoints[i]].PkScript).String() < chainhash.HashH(p.outputs[p.outPoints[j]].PkScript).String()
	}
	return p.outputs[p.outPoints[i]].Value < p.outputs[p.outPoints[j]].Value
}
func (p *byValue) Swap(i, j int) { p.outPoints[i], p.outPoints[j] = p.outPoints[j], p.outPoints[i] }

func coinSelection(
	minAmount btcutil.Amount,
	outputs map[wire.OutPoint]*wire.TxOut,
	log *logrus.Entry,
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
		outputsSum += btcutil.Amount(outputs[outPoint].Value)
	}
	if outputsSum < minAmount {
		return 0, nil, errp.WithStack(ErrInsufficientFunds)
	}
	return outputsSum, selectedOutPoints, nil
}

// NewTxSpendAll creates a transaction which spends all available unspent outputs.
func NewTxSpendAll(
	coin coin.Coin,
	inputConfiguration *signing.Configuration,
	spendableOutputs map[wire.OutPoint]*wire.TxOut,
	outputPkScript []byte,
	feePerKb btcutil.Amount,
	log *logrus.Entry,
) (*TxProposal, error) {
	selectedOutPoints := []wire.OutPoint{}
	inputs := []*wire.TxIn{}
	outputsSum := btcutil.Amount(0)
	for outPoint, output := range spendableOutputs {
		outPoint := outPoint // avoid reference reuse due to range loop
		selectedOutPoints = append(selectedOutPoints, outPoint)
		outputsSum += btcutil.Amount(output.Value)
		inputs = append(inputs, wire.NewTxIn(&outPoint, nil, nil))
	}
	output := wire.NewTxOut(0, outputPkScript)
	txSize := estimateTxSize(len(selectedOutPoints), inputConfiguration, len(outputPkScript), 0)
	maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
	if outputsSum < maxRequiredFee {
		return nil, errp.WithStack(ErrInsufficientFunds)
	}
	output = wire.NewTxOut(int64(outputsSum-maxRequiredFee), outputPkScript)
	unsignedTransaction := &wire.MsgTx{
		Version:  wire.TxVersion,
		TxIn:     inputs,
		TxOut:    []*wire.TxOut{output},
		LockTime: 0,
	}
	txsort.InPlaceSort(unsignedTransaction)
	log.WithField("fee", maxRequiredFee).Debug("Preparing transaction to spend all outputs")
	return &TxProposal{
		Coin:                 coin,
		AccountConfiguration: inputConfiguration,
		Amount:               btcutil.Amount(output.Value),
		Fee:                  maxRequiredFee,
		Transaction:          unsignedTransaction,
	}, nil
}

// NewTx creates a transaction from a set of unspent outputs, targeting an output value. A subset of
// the unspent outputs is selected to cover the needed amount. A change output is added if needed.
func NewTx(
	coin coin.Coin,
	inputConfiguration *signing.Configuration,
	spendableOutputs map[wire.OutPoint]*wire.TxOut,
	output *wire.TxOut,
	feePerKb btcutil.Amount,
	getChangeAddress func() *addresses.AccountAddress,
	log *logrus.Entry,
) (*TxProposal, error) {
	targetAmount := btcutil.Amount(output.Value)
	if targetAmount <= 0 {
		panic("amount must be positive")
	}
	outputs := []*wire.TxOut{output}
	changeAddress := getChangeAddress()
	changePKScript := changeAddress.PubkeyScript()
	estimatedSize := estimateTxSize(1, inputConfiguration, len(output.PkScript), len(changePKScript))
	targetFee := feeForSerializeSize(feePerKb, estimatedSize, log)
	for {
		selectedOutputsSum, selectedOutPoints, err := coinSelection(
			targetAmount+targetFee,
			spendableOutputs,
			log,
		)
		if err != nil {
			return nil, err
		}

		txSize := estimateTxSize(len(selectedOutPoints), inputConfiguration, len(output.PkScript), len(changePKScript))
		maxRequiredFee := feeForSerializeSize(feePerKb, txSize, log)
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
		return &TxProposal{
			Coin:                 coin,
			AccountConfiguration: inputConfiguration,
			Amount:               targetAmount,
			Fee:                  finalFee,
			Transaction:          unsignedTransaction,
			ChangeAddress:        changeAddress,
		}, nil
	}
}
