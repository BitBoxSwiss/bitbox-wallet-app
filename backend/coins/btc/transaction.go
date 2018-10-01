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

package btc

import (
	"math/big"

	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// unitSatoshi is 1 BTC (default unit) in Satoshi.
const unitSatoshi = 1e8

// TxValidationError represents errors in the tx proposal input data.
type TxValidationError string

func (err TxValidationError) Error() string {
	return string(err)
}

// SendAmount is either a concrete amount, or "all"/"max". The concrete amount is user input and is
// parsed/validated in Amount().
type SendAmount struct {
	amount  string
	sendAll bool
}

// NewSendAmount creates a new SendAmount based on a concrete amount.
func NewSendAmount(amount string) SendAmount {
	return SendAmount{amount: amount, sendAll: false}
}

// NewSendAmountAll creates a new Sendall-amount.
func NewSendAmountAll() SendAmount {
	return SendAmount{amount: "", sendAll: true}
}

// Amount parses the amount and converts it from the default unit to the smallest unit (e.g. satoshi
// = 1e8). Returns an error if the amount is not positive.
func (sendAmount *SendAmount) Amount(unit *big.Int) (coin.Amount, error) {
	if sendAmount.sendAll {
		panic("can only be called if SendAll is false")
	}
	amount, err := coin.NewAmountFromString(sendAmount.amount, unit)
	if err != nil {
		return coin.Amount{}, errp.WithStack(TxValidationError("invalid amount"))
	}
	if amount.BigInt().Sign() <= 0 {
		return coin.Amount{}, errp.WithStack(TxValidationError("invalid amount"))
	}
	return amount, nil
}

// SendAll returns if this represents a send-all input.
func (sendAmount *SendAmount) SendAll() bool {
	return sendAmount.sendAll
}

// newTx creates a new tx to the given recipient address. It also returns a set of used account
// outputs, which contains all outputs that spent in the tx. Those are needed to be able to sign the
// transaction. selectedUTXOs restricts the available coins; if empty, no restriction is applied and
// all unspent coins can be used.
func (account *Account) newTx(
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode,
	selectedUTXOs map[wire.OutPoint]struct{},
) (
	map[wire.OutPoint]*transactions.SpendableOutput, *maketx.TxProposal, error) {

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
		// Apply coin control.
		if len(selectedUTXOs) != 0 {
			if _, ok := selectedUTXOs[outPoint]; !ok {
				continue
			}
		}
		wireUTXO[outPoint] = txOut.TxOut
	}
	var txProposal *maketx.TxProposal
	if amount.sendAll {
		txProposal, err = maketx.NewTxSpendAll(
			account.coin,
			account.signingConfiguration,
			wireUTXO,
			pkScript,
			*feeTarget.FeeRatePerKb,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	} else {
		parsedAmount, err := amount.Amount(big.NewInt(unitSatoshi))
		if err != nil {
			return nil, nil, err
		}
		parsedAmountInt64, err := parsedAmount.Int64()
		if err != nil {
			return nil, nil, errp.WithStack(TxValidationError("invalid amount"))
		}
		txProposal, err = maketx.NewTx(
			account.coin,
			account.signingConfiguration,
			wireUTXO,
			wire.NewTxOut(parsedAmountInt64, pkScript),
			*feeTarget.FeeRatePerKb,
			func() *addresses.AccountAddress {
				return account.changeAddresses.GetUnused()[0]
			},
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	}
	account.log.Debugf("creating tx with %d inputs, %d outputs",
		len(txProposal.Transaction.TxIn), len(txProposal.Transaction.TxOut))
	return utxo, txProposal, nil
}

// SendTx creates, signs and sends tx which sends `amount` to the recipient.
func (account *Account) SendTx(
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode,
	selectedUTXOs map[wire.OutPoint]struct{},
) error {
	account.log.Info("Sending transaction")
	utxo, txProposal, err := account.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
		selectedUTXOs,
	)
	if err != nil {
		return errp.WithMessage(err, "Failed to create transaction")
	}
	getAddress := func(scriptHashHex blockchain.ScriptHashHex) *addresses.AccountAddress {
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
	recipientAddress string,
	amount SendAmount,
	feeTargetCode FeeTargetCode,
	selectedUTXOs map[wire.OutPoint]struct{},
) (
	coin.Amount, coin.Amount, coin.Amount, error) {

	account.log.Debug("Proposing transaction")
	_, txProposal, err := account.newTx(
		recipientAddress,
		amount,
		feeTargetCode,
		selectedUTXOs,
	)
	if err != nil {
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
	}

	account.log.WithField("fee", txProposal.Fee).Debug("Returning fee")
	return coin.NewAmountFromInt64(int64(txProposal.Amount)),
		coin.NewAmountFromInt64(int64(txProposal.Fee)),
		coin.NewAmountFromInt64(int64(txProposal.Total())), nil
}
