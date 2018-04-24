package btc

import (
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/backend/keystore"
)

// ProposedTransaction contains all the info needed to sign a btc transaction.
type ProposedTransaction struct {
	TXProposal      *maketx.TxProposal
	PreviousOutputs map[wire.OutPoint]*transactions.TxOut
	GetAddress      func(client.ScriptHashHex) *addresses.Address
}

// SignTransaction signs all inputs. It assumes all outputs spent belong to this
// wallet. previousOutputs must contain all outputs which are spent by the transaction.
func SignTransaction(
	keyStore keystore.Keystore,
	txProposal *maketx.TxProposal,
	previousOutputs map[wire.OutPoint]*transactions.TxOut,
	getAddress func(client.ScriptHashHex) *addresses.Address,
	log *logrus.Entry,
) error {
	_, err := keyStore.SignTransaction(&ProposedTransaction{
		TXProposal:      txProposal,
		PreviousOutputs: previousOutputs,
		GetAddress:      getAddress,
	})
	return err
}
