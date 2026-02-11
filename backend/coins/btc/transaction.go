// SPDX-License-Identifier: Apache-2.0

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
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
)

// unitSatoshi is 1 BTC (default unit) in Satoshi.
const unitSatoshi = 1e8

func supportsRBF(code coin.Code) bool {
	switch code {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeRBTC:
		return true
	default:
		return false
	}
}

// getFeePerKb returns the fee rate to be used in a new transaction. It is deduced from the supplied
// fee target (priority) if one is given, or the provided args.FeePerKb if the fee taret is
// `FeeTargetCodeCustom`.
func (account *Account) getFeePerKb(args *accounts.TxProposalArgs) (btcutil.Amount, error) {
	if args.FeeTargetCode == accounts.FeeTargetCodeCustom && !args.UseHighestFee {
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
	if args.UseHighestFee {
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
	if len(account.subaccounts) == 0 {
		return nil, errp.New("Account has no subaccounts")
	}
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
			if utxo.Address.AccountConfiguration.ScriptType() == signing.ScriptTypeP2TR {
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

	var outputInfo *maketx.OutputInfo
	if err := account.coin.ValidateSilentPaymentAddress(args.RecipientAddress); err == nil {
		outputInfo = maketx.NewOutputInfoSilentPayment(args.RecipientAddress)
	} else {
		pkScript, err := account.coin.AddressToPkScript(args.RecipientAddress)
		if err != nil {
			return nil, nil, err
		}
		outputInfo = maketx.NewOutputInfo(pkScript)
	}

	if !account.Synced() {
		return nil, nil, accounts.ErrSyncInProgress
	}

	// RBF and coin control are mutually exclusive - RBF must use the original transaction's inputs
	if args.RBFTxID != "" && len(args.SelectedUTXOs) != 0 {
		return nil, nil, errors.ErrRBFCoinControlNotAllowed
	}
	// RBF is only supported for Bitcoin (including testnet/regtest), not Litecoin.
	if args.RBFTxID != "" && !supportsRBF(account.coin.Code()) {
		return nil, nil, errors.ErrRBFInvalidTxID
	}

	var utxo map[wire.OutPoint]*transactions.SpendableOutput
	var originalFee btcutil.Amount
	var originalFeeRatePerKb btcutil.Amount
	var err error

	// Handle RBF (Replace-By-Fee) mode
	if args.RBFTxID != "" {
		account.log.Infof("RBF mode: replacing transaction %s", args.RBFTxID)
		rbfTxHash, err := chainhash.NewHashFromStr(args.RBFTxID)
		if err != nil {
			return nil, nil, errors.ErrRBFInvalidTxID
		}
		utxo, originalFee, originalFeeRatePerKb, err = account.transactions.SpendableOutputsForRBF(*rbfTxHash)
		if err != nil {
			return nil, nil, err
		}
	} else {
		utxo, err = account.transactions.SpendableOutputs()
		if err != nil {
			return nil, nil, err
		}
	}

	wireUTXO := make(map[wire.OutPoint]maketx.UTXO, len(utxo))
	for outPoint, txOut := range utxo {
		// Apply coin control (only for non-RBF transactions).
		// In RBF mode, we must use exactly the original transaction's inputs.
		if args.RBFTxID == "" && len(args.SelectedUTXOs) != 0 {
			if _, ok := args.SelectedUTXOs[outPoint]; !ok {
				continue
			}
		}
		wireUTXO[outPoint] = maketx.UTXO{
			TxOut: txOut.TxOut,
			Address: account.GetAddress(
				blockchain.NewScriptHashHex(txOut.TxOut.PkScript)),
		}
	}
	feeRatePerKb, err := account.getFeePerKb(args)
	if err != nil {
		return nil, nil, err
	}

	// For RBF, validate that new fee rate is at least 1 sat/vB higher than original
	if args.RBFTxID != "" {
		// 1 sat/vB = 1000 sat/kB
		minRequiredFeeRate := originalFeeRatePerKb + 1000
		if feeRatePerKb < minRequiredFeeRate {
			account.log.Warnf("RBF fee too low: %d < %d (original: %d)",
				feeRatePerKb, minRequiredFeeRate, originalFeeRatePerKb)
			return nil, nil, errors.ErrRBFFeeTooLow
		}
	}

	var txProposal *maketx.TxProposal
	if args.Amount.SendAll() {
		if args.PaymentRequest != nil {
			return nil, nil, errp.New("Payment Requests do not allow send-all transaction proposals")
		}
		txProposal, err = maketx.NewTxSpendAll(
			account.coin,
			wireUTXO,
			outputInfo,
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
		account.log.Infof("Change address script type: %s", changeAddress.AccountConfiguration.ScriptType())
		txProposal, err = maketx.NewTx(
			account.coin,
			wireUTXO,
			outputInfo,
			parsedAmountInt64,
			feeRatePerKb,
			changeAddress,
			account.log,
		)
		if err != nil {
			return nil, nil, err
		}

		if args.PaymentRequest != nil {
			account.log.Info("Payment request tx proposal")
			txProposal.PaymentRequest = args.PaymentRequest
		}
	}
	if args.RBFTxID != "" {
		// BIP-125 replacements must increase the absolute fee in addition to fee rate.
		if txProposal.Fee <= originalFee {
			account.log.Warnf("RBF fee too low: %d <= %d (original absolute fee)", txProposal.Fee, originalFee)
			return nil, nil, errors.ErrRBFFeeTooLow
		}
	}

	account.log.Debugf("creating tx with %d inputs, %d outputs",
		len(txProposal.Psbt.UnsignedTx.TxIn), len(txProposal.Psbt.UnsignedTx.TxOut))
	return utxo, txProposal, nil
}

// GetAddress returns the address in the account with the given `scriptHashHex`. Returns nil if the
// address does not exist in the account.
func (account *Account) GetAddress(scriptHashHex blockchain.ScriptHashHex) *addresses.AccountAddress {
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
func (account *Account) SendTx(txNote string) (string, error) {
	unlock := account.activeTxProposalLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return "", errp.New("No active tx proposal")
	}

	account.log.Info("Signing and sending transaction")
	signedTx, err := account.signTransaction(txProposal, account.coin.Blockchain().TransactionGet)
	if err != nil {
		return "", errp.WithMessage(err, "Failed to sign transaction")
	}

	account.log.Info("Signed transaction is broadcasted")
	if err := account.coin.Blockchain().TransactionBroadcast(signedTx); err != nil {
		return "", err
	}

	if err := account.SetTxNote(signedTx.TxHash().String(), txNote); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	return signedTx.TxID(), nil
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
