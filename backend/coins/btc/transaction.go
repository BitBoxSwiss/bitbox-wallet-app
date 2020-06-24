// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// unitSatoshi is 1 BTC (default unit) in Satoshi.
const unitSatoshi = 1e8

// newTx creates a new tx to the given recipient address. It also returns a set of used account
// outputs, which contains all outputs that spent in the tx. Those are needed to be able to sign the
// transaction. selectedUTXOs restricts the available coins; if empty, no restriction is applied and
// all unspent coins can be used.
func (account *Account) newTx(
	recipientAddress string,
	amount coin.SendAmount,
	feeTargetCode accounts.FeeTargetCode,
	selectedUTXOs map[wire.OutPoint]struct{},
) (
	map[wire.OutPoint]*transactions.SpendableOutput, *maketx.TxProposal, error) {

	account.log.Debug("Prepare new transaction")

	address, err := account.coin.DecodeAddress(recipientAddress)
	if err != nil {
		return nil, nil, err
	}

	var feeTarget *FeeTarget
	for _, target := range account.feeTargets {
		if target.code == feeTargetCode {
			feeTarget = target
			break
		}
	}
	if feeTarget == nil || feeTarget.feeRatePerKb == nil {
		return nil, nil, errp.New("Fee could not be estimated")
	}

	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return nil, nil, errp.WithStack(err)
	}
	utxo := account.transactions.SpendableOutputs()
	wireUTXO := make(map[wire.OutPoint]maketx.UTXO, len(utxo))
	for outPoint, txOut := range utxo {
		// Apply coin control.
		if len(selectedUTXOs) != 0 {
			if _, ok := selectedUTXOs[outPoint]; !ok {
				continue
			}
		}
		wireUTXO[outPoint] = maketx.UTXO{
			TxOut: txOut.TxOut,
			Configuration: account.getAddress(
				blockchain.NewScriptHashHex(txOut.TxOut.PkScript)).Configuration,
		}
	}
	var txProposal *maketx.TxProposal
	if amount.SendAll() {
		txProposal, err = maketx.NewTxSpendAll(
			account.coin,
			wireUTXO,
			pkScript,
			*feeTarget.feeRatePerKb,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	} else {
		allowZero := false
		parsedAmount, err := amount.Amount(big.NewInt(unitSatoshi), allowZero)
		if err != nil {
			return nil, nil, err
		}
		parsedAmountInt64, err := parsedAmount.Int64()
		if err != nil {
			return nil, nil, errp.WithStack(errors.ErrInvalidAmount)
		}
		txProposal, err = maketx.NewTx(
			account.coin,
			wireUTXO,
			wire.NewTxOut(parsedAmountInt64, pkScript),
			*feeTarget.feeRatePerKb,
			// Change address is of the first subaccount, always.
			account.subaccounts[0].changeAddresses.GetUnused()[0],
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

func (account *Account) getAddress(scriptHashHex blockchain.ScriptHashHex) *addresses.AccountAddress {
	for _, subacc := range account.subaccounts {
		if address := subacc.receiveAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		if address := subacc.changeAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
	}
	panic("address must be present")
}

// SendTx implements accounts.Interface.
func (account *Account) SendTx() error {
	unlock := account.activeTxProposalLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return errp.New("No active tx proposal")
	}

	account.log.Info("Signing and sending transaction")
	utxos := account.transactions.SpendableOutputs()
	getPrevTx := func(txHash chainhash.Hash) *wire.MsgTx {
		txChan := make(chan *wire.MsgTx)
		account.blockchain.TransactionGet(txHash,
			func(tx *wire.MsgTx) {
				txChan <- tx
			},
			func(err error) {
				if err != nil {
					panic(err)
				}
			},
		)
		return <-txChan
	}
	if err := account.signTransaction(txProposal, utxos, getPrevTx); err != nil {
		return errp.WithMessage(err, "Failed to sign transaction")
	}
	account.log.Info("Signed transaction is broadcasted")
	if err := account.blockchain.TransactionBroadcast(txProposal.Transaction); err != nil {
		return err
	}
	return nil
}

// TxProposal creates a tx from the relevant input and returns information about it for display in
// the UI (the output amount and the fee). At the same time, it validates the input. The proposal is
// stored internally and can be signed and sent with SendTx().
func (account *Account) TxProposal(
	recipientAddress string,
	amount coin.SendAmount,
	feeTargetCode accounts.FeeTargetCode,
	selectedUTXOs map[wire.OutPoint]struct{},
	_ []byte,
) (
	coin.Amount, coin.Amount, coin.Amount, error) {
	defer account.activeTxProposalLock.Lock()()

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

	account.activeTxProposal = txProposal

	account.log.WithField("fee", txProposal.Fee).Debug("Returning fee")
	return coin.NewAmountFromInt64(int64(txProposal.Amount)),
		coin.NewAmountFromInt64(int64(txProposal.Fee)),
		coin.NewAmountFromInt64(int64(txProposal.Total())), nil
}
