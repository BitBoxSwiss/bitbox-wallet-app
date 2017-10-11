package deterministicwallet

import (
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"

	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
)

// SignTransaction signs all inputs. It assumes all outputs spent belong to this wallet.
func SignTransaction(
	sign SignInterface,
	transaction *wire.MsgTx,
	previousOutputs []*transactions.TxOut,
) error {
	if len(previousOutputs) != len(transaction.TxIn) {
		panic("output/input mismatch; there needs to be exactly one output being spent ber input")
	}
	signatureHashes := [][]byte{}
	keyPaths := []string{}
	for index := range transaction.TxIn {
		spentOutput := previousOutputs[index]
		signatureHash, err := txscript.CalcSignatureHash(
			spentOutput.PkScript, txscript.SigHashAll, transaction, index)
		if err != nil {
			return err
		}
		signatureHashes = append(signatureHashes, signatureHash)
		keyPaths = append(keyPaths, spentOutput.Address.(*addresses.Address).KeyPath)
	}
	signatures, err := sign.Sign(signatureHashes, keyPaths)
	if err != nil {
		return err
	}
	if len(signatures) != len(transaction.TxIn) {
		panic("number of signatures doesn't match number of inputs")
	}
	for index, input := range transaction.TxIn {
		spentOutput := previousOutputs[index]
		signature := signatures[index]
		sigScript, err := txscript.NewScriptBuilder().
			AddData(append(signature.Serialize(), byte(txscript.SigHashAll))).
			AddData(spentOutput.Address.(*addresses.Address).PublicKey.SerializeCompressed()).
			Script()
		if err != nil {
			return err
		}
		input.SignatureScript = sigScript
	}
	// Sanity check: see if the created transaction is valid.
	if err := txValidityCheck(transaction, previousOutputs); err != nil {
		panic(err)
	}
	return nil
}

func txValidityCheck(transaction *wire.MsgTx, previousOutputs []*transactions.TxOut) error {
	for index := range transaction.TxIn {
		engine, err := txscript.NewEngine(
			previousOutputs[index].PkScript,
			transaction,
			index,
			txscript.StandardVerifyFlags, nil, nil, previousOutputs[index].Value)
		if err != nil {
			return err
		}
		if err := engine.Execute(); err != nil {
			return err
		}
	}
	return nil
}
