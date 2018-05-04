package btc

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil/txsort"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/util/errp"
)

// ProposedTransaction contains all the info needed to sign a btc transaction.
type ProposedTransaction struct {
	TXProposal      *maketx.TxProposal
	PreviousOutputs map[wire.OutPoint]*transactions.TxOut
	GetAddress      func(client.ScriptHashHex) *addresses.AccountAddress
	// Signatures collects the signatures (signatures[transactionInput][cosignerIndex]).
	Signatures [][]*btcec.Signature
	SigHashes  *txscript.TxSigHashes
}

// SignTransaction signs all inputs. It assumes all outputs spent belong to this
// wallet. previousOutputs must contain all outputs which are spent by the transaction.
func SignTransaction(
	keystores keystore.Keystores,
	txProposal *maketx.TxProposal,
	previousOutputs map[wire.OutPoint]*transactions.TxOut,
	getAddress func(client.ScriptHashHex) *addresses.AccountAddress,
	log *logrus.Entry,
) error {
	proposedTransaction := &ProposedTransaction{
		TXProposal:      txProposal,
		PreviousOutputs: previousOutputs,
		GetAddress:      getAddress,
		Signatures:      make([][]*btcec.Signature, len(txProposal.Transaction.TxIn)),
		SigHashes:       txscript.NewTxSigHashes(txProposal.Transaction),
	}

	for i := range proposedTransaction.Signatures {
		proposedTransaction.Signatures[i] = make([]*btcec.Signature, keystores.Count()) // TODO: Replace count with configuration.NumberOfSigners()
	}

	if err := keystores.SignTransaction(proposedTransaction); err != nil {
		return err
	}

	for index, input := range txProposal.Transaction.TxIn {
		spentOutput := previousOutputs[input.PreviousOutPoint]
		address := proposedTransaction.GetAddress(spentOutput.ScriptHashHex())
		input.SignatureScript, input.Witness = address.SignatureScript(
			proposedTransaction.Signatures[index])
	}

	// Sanity check: see if the created transaction is valid.
	if err := txValidityCheck(txProposal.Transaction, previousOutputs,
		proposedTransaction.SigHashes); err != nil {
		log.WithField("error", err).Panic("Failed to pass transaction validity check.")
	}

	return nil
}

func txValidityCheck(transaction *wire.MsgTx, previousOutputs map[wire.OutPoint]*transactions.TxOut,
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
			txscript.StandardVerifyFlags, nil, sigHashes, spentOutput.Value)
		if err != nil {
			return errp.WithStack(err)
		}
		if err := engine.Execute(); err != nil {
			return errp.WithStack(err)
		}
	}
	return nil
}
