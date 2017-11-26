package deterministicwallet

import (
	"bytes"

	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"

	"github.com/shiftdevices/godbb/deterministicwallet/maketx"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/util/errp"
)

type SendAmount struct {
	amount  btcutil.Amount
	sendAll bool
}

func NewSendAmount(amount btcutil.Amount) (SendAmount, error) {
	if amount <= 0 {
		return SendAmount{}, errp.New("invalid amount")
	}
	return SendAmount{amount: amount, sendAll: false}, nil
}

func NewSendAmountAll() SendAmount {
	return SendAmount{amount: 0, sendAll: true}
}

func (wallet *DeterministicWallet) newTx(
	address btcutil.Address, amount SendAmount, feeTargetCode FeeTargetCode) (
	btcutil.Amount, *wire.MsgTx, []wire.OutPoint, error) {

	var feeTarget *FeeTarget
	for _, target := range wallet.feeTargets {
		if target.Code == feeTargetCode {
			feeTarget = target
			break
		}
	}
	if feeTarget == nil || feeTarget.FeeRatePerKb == nil {
		panic("fee target must exist")
	}

	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return 0, nil, nil, errp.WithStack(err)
	}
	if amount.sendAll {
		return maketx.NewTxSpendAll(
			wallet.transactions.UnspentOutputs(),
			pkScript,
			*feeTarget.FeeRatePerKb,
		)

	}
	transaction, selectedOutPoints, err := maketx.NewTx(
		wallet.transactions.UnspentOutputs(),
		wire.NewTxOut(int64(amount.amount), pkScript),
		*feeTarget.FeeRatePerKb,
		func() ([]byte, error) {
			return wallet.changeAddresses.GetUnused().PkScript(), nil
		},
		random,
	)
	if err != nil {
		return 0, nil, nil, err
	}
	return amount.amount, transaction, selectedOutPoints, err
}

// SendTx creates, signs and sends tx which sends `amount` to the recipient.
func (wallet *DeterministicWallet) SendTx(
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode) error {
	address, err := btcutil.DecodeAddress(recipientAddress, wallet.net)
	if err != nil {
		return errp.WithStack(err)
	}
	_, transaction, selectedOutPoints, err := wallet.newTx(
		address,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return err
	}
	previousOutputs := make([]*transactions.TxOut, len(selectedOutPoints))
	for i, outPoint := range selectedOutPoints {
		previousOutputs[i] = wallet.transactions.Output(outPoint)
	}
	if err := SignTransaction(wallet.keystore, transaction, previousOutputs); err != nil {
		return err
	}
	rawTX := &bytes.Buffer{}
	_ = transaction.SerializeNoWitness(rawTX)
	return wallet.blockchain.TransactionBroadcast(rawTX.Bytes())
}

// TxProposal creates a tx from the relevant input and returns information about it for display in
// the UI (the output amount and the fee).
func (wallet *DeterministicWallet) TxProposal(amount SendAmount, feeTargetCode FeeTargetCode) (
	btcutil.Amount, btcutil.Amount, error) {

	// Dummy recipient, we won't sent the tx, just return the fee.
	recipientAddress := wallet.receiveAddresses.GetUnused().Address
	sendAmount, transaction, _, err := wallet.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return 0, 0, err
	}

	txType, _, fee := wallet.ClassifyTransaction(transaction)
	if txType != transactions.TxTypeSend || fee == nil {
		panic("wrong tx format")
	}
	return sendAmount, *fee, nil
}
