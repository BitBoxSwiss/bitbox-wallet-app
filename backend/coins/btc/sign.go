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
	"github.com/btcsuite/btcd/btcutil/txsort"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// ProposedTransaction contains all the info needed to sign a btc transaction.
type ProposedTransaction struct {
	TXProposal *maketx.TxProposal
	// List of signing configurations that might be used in the tx inputs.
	AccountSigningConfigurations []*signing.Configuration
	GetAddress                   func(blockchain.ScriptHashHex) *addresses.AccountAddress
	GetPrevTx                    func(chainhash.Hash) (*wire.MsgTx, error)
	// Signatures collects the signatures, one per transaction input.
	Signatures []*types.Signature
	SigHashes  *txscript.TxSigHashes
	FormatUnit coin.BtcUnit
}

// signTransaction signs all inputs. It assumes all outputs spent belong to this
// wallet. previousOutputs must contain all outputs which are spent by the transaction.
func (account *Account) signTransaction(
	txProposal *maketx.TxProposal,
	getPrevTx func(chainhash.Hash) (*wire.MsgTx, error),
) error {
	signingConfigs := make([]*signing.Configuration, len(account.subaccounts))
	for i, subacc := range account.subaccounts {
		signingConfigs[i] = subacc.signingConfiguration
	}
	previousOutputs := txProposal.PreviousOutputs

	proposedTransaction := &ProposedTransaction{
		TXProposal:                   txProposal,
		AccountSigningConfigurations: signingConfigs,
		GetAddress:                   account.getAddress,
		GetPrevTx:                    getPrevTx,
		Signatures:                   make([]*types.Signature, len(txProposal.Transaction.TxIn)),
		SigHashes:                    txscript.NewTxSigHashes(txProposal.Transaction, previousOutputs),
		FormatUnit:                   account.coin.formatUnit,
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return err
	}
	if err := keystore.SignTransaction(proposedTransaction); err != nil {
		return err
	}

	for index, input := range txProposal.Transaction.TxIn {
		spentOutput := previousOutputs[input.PreviousOutPoint]
		address := proposedTransaction.GetAddress(spentOutput.ScriptHashHex())
		signature := proposedTransaction.Signatures[index]
		if signature == nil {
			return errp.New("Signature missing")
		}
		input.SignatureScript, input.Witness = address.SignatureScript(*signature)
	}

	// Sanity check: see if the created transaction is valid.
	if err := txValidityCheck(txProposal.Transaction, previousOutputs,
		proposedTransaction.SigHashes); err != nil {
		account.log.WithError(err).Panic("Failed to pass transaction validity check.")
	}

	return nil
}

func txValidityCheck(transaction *wire.MsgTx, previousOutputs maketx.PreviousOutputs,
	sigHashes *txscript.TxSigHashes) error {
	if !txsort.IsSorted(transaction) {
		return errp.New("tx not bip69 conformant")
	}
	for index, txIn := range transaction.TxIn {
		spentOutput, ok := previousOutputs[txIn.PreviousOutPoint]
		if !ok {
			return errp.New("There needs to be exactly one output being spent per input!")
		}
		engine, err := txscript.NewEngine(spentOutput.PkScript, transaction, index,
			txscript.StandardVerifyFlags, nil, sigHashes, spentOutput.Value, previousOutputs)
		if err != nil {
			return errp.WithStack(err)
		}
		if err := engine.Execute(); err != nil {
			return errp.WithStack(err)
		}
	}
	return nil
}
