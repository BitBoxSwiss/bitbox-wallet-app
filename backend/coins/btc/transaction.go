package btc

import (
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"

	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/util/errp"
)

// SendAmount is either a concrete amount, or "all"/"max".
type SendAmount struct {
	amount  btcutil.Amount
	sendAll bool
}

// NewSendAmount creates a new SendAmount based on a concrete amount.
func NewSendAmount(amount btcutil.Amount) (SendAmount, error) {
	if amount <= 0 {
		return SendAmount{}, errp.New("invalid amount")
	}
	return SendAmount{amount: amount, sendAll: false}, nil
}

// NewSendAmountAll creates a new Sendall-amount.
func NewSendAmountAll() SendAmount {
	return SendAmount{amount: 0, sendAll: true}
}

// newTx creates a new tx to the given recipient address. It also returns a set of used wallet
// outputs, which contains all outputs that spent in the tx. Those are needed to be able to sign the
// transaction.
func (wallet *Wallet) newTx(
	address btcutil.Address, amount SendAmount, feeTargetCode FeeTargetCode) (
	map[wire.OutPoint]*transactions.TxOut, *maketx.TxProposal, error) {

	wallet.log.Debug("Prepare new transaction")

	var feeTarget *FeeTarget
	for _, target := range wallet.feeTargets {
		if target.Code == feeTargetCode {
			feeTarget = target
			break
		}
	}
	if feeTarget == nil || feeTarget.FeeRatePerKb == nil {
		return nil, nil, errp.New("Fee could not be estimated")
	}

	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return nil, nil, errp.WithStack(err)
	}
	utxo := wallet.transactions.SpendableOutputs()
	wireUTXO := make(map[wire.OutPoint]*wire.TxOut, len(utxo))
	for outPoint, txOut := range utxo {
		wireUTXO[outPoint] = txOut.TxOut
	}
	var txProposal *maketx.TxProposal
	if amount.sendAll {
		txProposal, err = maketx.NewTxSpendAll(
			wireUTXO,
			pkScript,
			*feeTarget.FeeRatePerKb,
			wallet.log,
		)
		if err != nil {
			return nil, nil, err
		}
	} else {
		txProposal, err = maketx.NewTx(
			wireUTXO,
			wire.NewTxOut(int64(amount.amount), pkScript),
			*feeTarget.FeeRatePerKb,
			func() *addresses.Address {
				return wallet.changeAddresses.GetUnused()
			},
			wallet.log,
		)
		if err != nil {
			return nil, nil, err
		}
	}
	return utxo, txProposal, nil
}

// SendTx creates, signs and sends tx which sends `amount` to the recipient.
func (wallet *Wallet) SendTx(
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode) error {
	wallet.log.Info("Sending transaction")
	address, err := btcutil.DecodeAddress(recipientAddress, wallet.net)
	if err != nil {
		return errp.WithStack(err)
	}
	if !address.IsForNet(wallet.net) {
		return errp.WithContext(errp.New("invalid address for this network"), errp.Context{
			"net": wallet.net.Name})
	}
	utxo, txProposal, err := wallet.newTx(
		address,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return errp.WithMessage(err, "Failed to create transaction")
	}
	getAddress := func(scriptHashHex client.ScriptHashHex) *addresses.Address {
		if address := wallet.receiveAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		if address := wallet.changeAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		panic("address must be present")
	}
	if err := SignTransaction(wallet.keyStore, txProposal, utxo, getAddress, wallet.log); err != nil {
		return errp.WithMessage(err, "Failed to sign transaction")
	}
	wallet.log.Info("Signed transaction is broadcasted")
	return wallet.blockchain.TransactionBroadcast(txProposal.Transaction)
}

// TxProposal creates a tx from the relevant input and returns information about it for display in
// the UI (the output amount and the fee).
func (wallet *Wallet) TxProposal(amount SendAmount, feeTargetCode FeeTargetCode) (
	btcutil.Amount, btcutil.Amount, error) {

	wallet.log.Info("Proposing transaction")
	// Dummy recipient, we won't sent the tx, just return the fee.
	recipientAddress := wallet.receiveAddresses.GetUnused().Address
	_, txProposal, err := wallet.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return 0, 0, err
	}

	wallet.log.WithField("fee", txProposal.Fee).Info("Returning fee")
	return txProposal.Amount, txProposal.Fee, nil
}
