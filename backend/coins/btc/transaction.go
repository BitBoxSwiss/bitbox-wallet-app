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
	"strconv"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/wire"
)

// unitSatoshi is 1 BTC (default unit) in Satoshi.
const unitSatoshi = 1e8

// getFeePerKb returns the fee rate to be used in a new transaction. It is deduced from the supplied
// fee target (priority) if one is given, or the provided args.FeePerKb if the fee taret is
// `FeeTargetCodeCustom`.
func (account *Account) getFeePerKb(args *accounts.TxProposalArgs) (btcutil.Amount, error) {
	isPaymentRequest := len(args.PaymentRequests) > 0
	if args.FeeTargetCode == accounts.FeeTargetCodeCustom && !isPaymentRequest {
		float, err := strconv.ParseFloat(args.CustomFee, 64)
		if err != nil {
			return 0, err
		}
		// Technically it is vKb (virtual Kb) since fees are computed from a transaction's weight
		// (measured in weight units or virtual bytes), but we keep the `Kb` unit to be consistent
		// with the rest of the codebase and Bitcoin Core.
		minRelayFeeRate, err := account.getMinRelayFeeRate()
		if err != nil {
			return 0, err
		}
		feePerKb := btcutil.Amount(float * 1000)
		if feePerKb < minRelayFeeRate {
			return 0, errors.ErrFeeTooLow
		}
		return feePerKb, nil
	}

	var feeTarget *FeeTarget
	if isPaymentRequest {
		feeTarget = account.feeTargets().highest()
	} else {
		for _, target := range account.feeTargets() {
			if target.code == args.FeeTargetCode {
				feeTarget = target
				break
			}
		}
	}
	if feeTarget == nil || feeTarget.feeRatePerKb == nil {
		return 0, errp.New("Fee could not be estimated")
	}
	return *feeTarget.feeRatePerKb, nil
}

// pickChangeAddress returns a suitable unused change address to be used when making a transaction.
// If the account is a unified account with multiple subaccounts (script/address types), we choose
// the change address type like this:
//
// - If there is at least one P2TR UTXO, the change address will be a P2TR change address.
// - Otherwise we pick P2WPKH if available.
// - Otherwise we take the change of the first subaccount as a fallback.
//
// The above is a solution for the current lack of adoption of Taproot in third party (watch-only)
// wallets.  Only users who already opted-in to Taproot (by receiving on a Taproot address) continue
// with Taproot changes. This ensures that also users who received on Taproot and broke their
// watch-only tools can fix it by moving the coins back to P2WPKH, and not have them go a Taproot
// change again by accident.
func (account *Account) pickChangeAddress(utxos map[wire.OutPoint]maketx.UTXO) (*addresses.AccountAddress, error) {
	if len(account.subaccounts) == 1 {
		unusedAddresses, err := account.subaccounts[0].changeAddresses.GetUnused()
		if err != nil {
			return nil, err
		}
		return unusedAddresses[0], nil
	}

	p2trIndex := account.subaccounts.signingConfigurations().FindScriptType(signing.ScriptTypeP2TR)
	if p2trIndex >= 0 {
		// Check if there is at least one taproot UTXO.
		for _, utxo := range utxos {
			if utxo.Configuration.ScriptType() == signing.ScriptTypeP2TR {
				// Found a taproot UTXO.
				unusedAddresses, err := account.subaccounts[p2trIndex].changeAddresses.GetUnused()
				if err != nil {
					return nil, err
				}
				return unusedAddresses[0], nil
			}
		}
	}

	p2wpkhIndex := account.subaccounts.signingConfigurations().FindScriptType(signing.ScriptTypeP2WPKH)
	if p2wpkhIndex >= 0 {
		unusedAddresses, err := account.subaccounts[p2wpkhIndex].changeAddresses.GetUnused()
		if err != nil {
			return nil, err
		}
		return unusedAddresses[0], nil
	}

	unusedAddresses, err := account.subaccounts[0].changeAddresses.GetUnused()
	if err != nil {
		return nil, err
	}
	return unusedAddresses[0], nil
}

// newTx creates a new tx to the given recipient address. It also returns a set of used account
// outputs, which contains all outputs that spent in the tx. Those are needed to be able to sign the
// transaction. selectedUTXOs restricts the available coins; if empty, no restriction is applied and
// all unspent coins can be used.
func (account *Account) newTx(args *accounts.TxProposalArgs) (
	map[wire.OutPoint]*transactions.SpendableOutput, *maketx.TxProposal, error) {

	account.log.Debug("Prepare new transaction")

	address, err := account.coin.DecodeAddress(args.RecipientAddress)
	if err != nil {
		return nil, nil, err
	}
	pkScript, err := util.PkScriptFromAddress(address)
	if err != nil {
		return nil, nil, err
	}
	utxo, err := account.transactions.SpendableOutputs()
	if err != nil {
		return nil, nil, err
	}
	wireUTXO := make(map[wire.OutPoint]maketx.UTXO, len(utxo))
	for outPoint, txOut := range utxo {
		// Apply coin control.
		if len(args.SelectedUTXOs) != 0 {
			if _, ok := args.SelectedUTXOs[outPoint]; !ok {
				continue
			}
		}
		wireUTXO[outPoint] = maketx.UTXO{
			TxOut: txOut.TxOut,
			Configuration: account.getAddress(
				blockchain.NewScriptHashHex(txOut.TxOut.PkScript)).Configuration,
		}
	}
	feeRatePerKb, err := account.getFeePerKb(args)
	if err != nil {
		return nil, nil, err
	}

	var txProposal *maketx.TxProposal
	if args.Amount.SendAll() {
		if len(args.PaymentRequests) > 0 {
			return nil, nil, errp.New("Payment Requests do not allow send-all transaction proposals")
		}
		txProposal, err = maketx.NewTxSpendAll(
			account.coin,
			wireUTXO,
			pkScript,
			feeRatePerKb,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}
	} else {
		allowZero := false

		unit := int64(unitSatoshi)
		if account.coin.formatUnit == coin.BtcUnitSats {
			unit = 1
		}
		parsedAmount, err := args.Amount.Amount(big.NewInt(unit), allowZero)
		if err != nil {
			return nil, nil, err
		}
		parsedAmountInt64, err := parsedAmount.Int64()
		if err != nil {
			return nil, nil, errp.WithStack(errors.ErrInvalidAmount)
		}
		changeAddress, err := account.pickChangeAddress(wireUTXO)
		if err != nil {
			return nil, nil, err
		}
		txOut := wire.NewTxOut(parsedAmountInt64, pkScript)
		account.log.Infof("Change address script type: %s", changeAddress.Configuration.ScriptType())
		txProposal, err = maketx.NewTx(
			account.coin,
			wireUTXO,
			txOut,
			feeRatePerKb,
			changeAddress,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}

		for _, paymentRequest := range args.PaymentRequests {
			account.log.Info("Payment request tx proposal")
			paymentRequest.TxOut = txOut
			txProposal.PaymentRequest = append(txProposal.PaymentRequest, paymentRequest)
		}
	}
	account.log.Debugf("creating tx with %d inputs, %d outputs",
		len(txProposal.Transaction.TxIn), len(txProposal.Transaction.TxOut))
	return utxo, txProposal, nil
}

// getAddress returns the address in the account with the given `scriptHashHex`. Returns nil if the
// address does not exist in the account.
func (account *Account) getAddress(scriptHashHex blockchain.ScriptHashHex) *addresses.AccountAddress {
	for _, subacc := range account.subaccounts {
		if address := subacc.receiveAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
		if address := subacc.changeAddresses.LookupByScriptHashHex(scriptHashHex); address != nil {
			return address
		}
	}
	return nil
}

// SendTx implements accounts.Interface.
func (account *Account) SendTx(txNote string) error {
	unlock := account.activeTxProposalLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return errp.New("No active tx proposal")
	}

	account.log.Info("Signing and sending transaction")
	if err := account.signTransaction(txProposal, account.coin.Blockchain().TransactionGet); err != nil {
		return errp.WithMessage(err, "Failed to sign transaction")
	}

	account.log.Info("Signed transaction is broadcasted")
	if err := account.coin.Blockchain().TransactionBroadcast(txProposal.Transaction); err != nil {
		return err
	}

	if err := account.SetTxNote(txProposal.Transaction.TxHash().String(), txNote); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	return nil
}

// TxProposal creates a tx from the relevant input and returns information about it for display in
// the UI (the output amount and the fee). At the same time, it validates the input. The proposal is
// stored internally and can be signed and sent with SendTx().
func (account *Account) TxProposal(
	args *accounts.TxProposalArgs,
) (
	coin.Amount, coin.Amount, coin.Amount, error) {
	defer account.activeTxProposalLock.Lock()()

	account.log.Debug("Proposing transaction")
	_, txProposal, err := account.newTx(args)
	if err != nil {
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
	}

	account.activeTxProposal = txProposal

	account.log.WithField("fee", txProposal.Fee).Debug("Returning fee")
	return coin.NewAmountFromInt64(int64(txProposal.Amount)),
		coin.NewAmountFromInt64(int64(txProposal.Fee)),
		coin.NewAmountFromInt64(int64(txProposal.Total())), nil
}
