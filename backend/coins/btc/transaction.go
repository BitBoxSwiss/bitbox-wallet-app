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

// TxValidationError represents errors in the tx proposal input data.
type TxValidationError string

func (err TxValidationError) Error() string {
	return string(err)
}

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

// newTx creates a new tx to the given recipient address. It also returns a set of used account
// outputs, which contains all outputs that spent in the tx. Those are needed to be able to sign the
// transaction.
func (account *Account) newTx(
	recipientAddress string, amount SendAmount, feeTargetCode FeeTargetCode) (
	map[wire.OutPoint]*transactions.TxOut, *maketx.TxProposal, error) {

	account.log.Debug("Prepare new transaction")

	address, err := btcutil.DecodeAddress(recipientAddress, account.coin.Net())
	if err != nil {
		return nil, nil, errp.WithStack(TxValidationError("invalid address"))
	}
	if !address.IsForNet(account.coin.Net()) {
		return nil, nil, errp.WithStack(TxValidationError("invalid address"))
	}

	var feeTarget *FeeTarget
	for _, target := range account.feeTargets {
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
	utxo := account.transactions.SpendableOutputs()
	wireUTXO := make(map[wire.OutPoint]*wire.TxOut, len(utxo))
	for outPoint, txOut := range utxo {
		wireUTXO[outPoint] = txOut.TxOut
	}
	var txProposal *maketx.TxProposal
	if amount.sendAll {
		txProposal, err = maketx.NewTxSpendAll(
			account.configuration,
			wireUTXO,
			pkScript,
			*feeTarget.FeeRatePerKb,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	} else {
		txProposal, err = maketx.NewTx(
			account.configuration,
			wireUTXO,
			wire.NewTxOut(int64(amount.amount), pkScript),
			*feeTarget.FeeRatePerKb,
			func() *addresses.AccountAddress {
				return account.changeAddresses.GetUnused()
			},
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	}
	account.log.Debugf("creating tx with %d inputs, %d outputs", len(txProposal.Transaction.TxIn), len(txProposal.Transaction.TxOut))
	return utxo, txProposal, nil
}

// SendTx creates, signs and sends tx which sends `amount` to the recipient.
func (account *Account) SendTx(
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode) error {
	account.log.Info("Sending transaction")
	utxo, txProposal, err := account.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return errp.WithMessage(err, "Failed to create transaction")
	}
	getAddress := func(scriptHashHex client.ScriptHashHex) *addresses.AccountAddress {
		if address := account.receiveAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		if address := account.changeAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		panic("address must be present")
	}
	if err := SignTransaction(account.keystores, txProposal, utxo, getAddress, account.log); err != nil {
		return errp.WithMessage(err, "Failed to sign transaction")
	}
	account.log.Info("Signed transaction is broadcasted")
	return account.blockchain.TransactionBroadcast(txProposal.Transaction)
}

// TxProposal creates a tx from the relevant input and returns information about it for display in
// the UI (the output amount and the fee). At the same time, it validates the input.
func (account *Account) TxProposal(
	recipientAddress string, amount SendAmount, feeTargetCode FeeTargetCode) (
	btcutil.Amount, btcutil.Amount, error) {

	account.log.Debug("Proposing transaction")
	_, txProposal, err := account.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
	)
	if err != nil {
		return 0, 0, err
	}

	account.log.WithField("fee", txProposal.Fee).Debug("Returning fee")
	return txProposal.Amount, txProposal.Fee, nil
}
