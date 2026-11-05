// SPDX-License-Identifier: Apache-2.0

package transactions

import (
	"fmt"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/chainhash/v2"
	"github.com/btcsuite/btcd/txscript/v2"
	"github.com/btcsuite/btcd/wire/v2"
)

// verifyHistorySignatures checks newly added history entries and cached spenders of newly discovered
// wallet outputs. The input index only records one spender per output, so we inspect all cached
// transactions when outputs are discovered to cover conflicting spends as well.
func (transactions *Transactions) verifyHistorySignatures(
	dbTx DBTxInterface,
	txsToCheck map[chainhash.Hash]*wire.MsgTx,
	newOutputs map[wire.OutPoint]struct{},
) error {
	if len(newOutputs) > 0 {
		txHashes, err := dbTx.Transactions()
		if err != nil {
			return err
		}
		for _, txHash := range txHashes {
			if _, ok := txsToCheck[txHash]; ok {
				continue
			}
			txInfo, err := dbTx.TxInfo(txHash)
			if err != nil {
				return err
			}
			if txInfo.Tx == nil {
				return errp.Newf("missing transaction %s", txHash)
			}
			for _, txIn := range txInfo.Tx.TxIn {
				if _, ok := newOutputs[txIn.PreviousOutPoint]; ok {
					txsToCheck[txHash] = txInfo.Tx
					break
				}
			}
		}
	}
	for _, tx := range txsToCheck {
		if err := transactions.verifyOwnInputs(dbTx, tx); err != nil {
			return err
		}
	}
	return nil
}

// verifyOwnInputs checks the authorization to spend outputs known to belong to this wallet.
// Inputs whose outputs are not indexed yet are checked when those outputs are added. The server's
// claimed confirmation height does not exempt a transaction from these checks.
func (transactions *Transactions) verifyOwnInputs(dbTx DBTxInterface, tx *wire.MsgTx) error {
	previousOutputs := txscript.NewMultiPrevOutFetcher(nil)
	var ownInputs []int
	hasTaproot := false
	for index, txIn := range tx.TxIn {
		output, err := dbTx.KnownOutput(txIn.PreviousOutPoint)
		if err != nil {
			return err
		}
		if output == nil {
			continue
		}
		ownInputs = append(ownInputs, index)
		previousOutputs.AddPrevOut(txIn.PreviousOutPoint, output)
		hasTaproot = hasTaproot || txscript.IsPayToTaproot(output.PkScript)
	}
	if len(ownInputs) == 0 {
		return nil
	}

	// Segwit v0 sighashes do not commit to the other inputs' amounts or scripts. Empty scripts
	// let the sighash cache compute just the v0 hashes without fetching unrelated transactions.
	var hashInputs txscript.PrevOutputFetcher = txscript.NewCannedPrevOutputFetcher(nil, 0)
	if hasTaproot {
		// Taproot sighashes also commit to the previous outputs of inputs outside this wallet.
		if err := transactions.fetchPrevOutputs(dbTx, tx, previousOutputs); err != nil {
			return err
		}
		hashInputs = previousOutputs
	}
	sigHashes := txscript.NewTxSigHashes(tx, hashInputs)

	// Enable each supported script type, without imposing current mempool policy (for example,
	// low-S signatures) on historical transactions. This checks signatures, not full consensus.
	const flags = txscript.ScriptBip16 | txscript.ScriptVerifyWitness | txscript.ScriptVerifyTaproot
	for _, index := range ownInputs {
		output := previousOutputs.FetchPrevOutput(tx.TxIn[index].PreviousOutPoint)
		engine, err := txscript.NewEngine(output.PkScript, tx, index, flags, nil, sigHashes,
			output.Value, previousOutputs)
		if err == nil {
			err = engine.Execute()
		}
		if err != nil {
			return errp.WithMessage(err, fmt.Sprintf(
				"invalid signature for wallet input %d of transaction %s", index, tx.TxHash()))
		}
	}
	return nil
}

// fetchPrevOutputs fills the missing previous outputs needed for Taproot sighash computation.
// Downloaded parents are hash-checked but are not added to the wallet's transaction index.
func (transactions *Transactions) fetchPrevOutputs(
	dbTx DBTxInterface, tx *wire.MsgTx, previousOutputs *txscript.MultiPrevOutFetcher,
) error {
	parents := map[chainhash.Hash]*wire.MsgTx{}
	for _, txIn := range tx.TxIn {
		outPoint := txIn.PreviousOutPoint
		if previousOutputs.FetchPrevOutput(outPoint) != nil {
			continue
		}
		parent := parents[outPoint.Hash]
		if parent == nil {
			var err error
			parent, _, err = transactions.getTransactionCached(dbTx, outPoint.Hash, 0)
			if err != nil {
				return errp.WithMessage(err, "failed to get previous output for signature verification")
			}
			parents[outPoint.Hash] = parent
		}
		if uint64(outPoint.Index) >= uint64(len(parent.TxOut)) {
			return errp.Newf("previous output %s does not exist", outPoint)
		}
		previousOutputs.AddPrevOut(outPoint, parent.TxOut[outPoint.Index])
	}
	return nil
}
