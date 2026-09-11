// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
)

// PendingTransactions provides local nonce protection and broadcast tracking for one chain/address.
type PendingTransactions struct {
	chainID       uint64
	sender        common.Address
	db            db.Interface
	enqueueUpdate func()
	log           *logrus.Entry
}

func nextNonce(client rpcclient.Interface, sender common.Address, pending *PendingTransactions) (uint64, error) {
	nodeNonce, err := client.PendingNonceAt(context.TODO(), sender)
	if err != nil {
		return 0, err
	}
	if pending == nil {
		return nodeNonce, nil
	}
	dbTx, err := pending.db.Begin()
	if err != nil {
		return 0, errp.WithStack(err)
	}
	defer dbTx.Rollback()
	outgoingTransactions, err := dbTx.OutgoingTransactions()
	if err != nil {
		return 0, errp.WithStack(err)
	}
	if len(outgoingTransactions) > 0 {
		localNonce := outgoingTransactions[0].Transaction.Nonce() + 1
		if localNonce > nodeNonce {
			return localNonce, nil
		}
	}
	return nodeNonce, nil
}

// store puts an outgoing tx into the db with height 0 (pending).
func (pending *PendingTransactions) store(transaction *types.Transaction) error {
	dbTx, err := pending.db.Begin()
	if err != nil {
		return err
	}
	defer dbTx.Rollback()
	if err := dbTx.PutOutgoingTransaction(
		&ethtypes.TransactionWithMetadata{
			Transaction:       transaction,
			BroadcastAttempts: 1,
		}); err != nil {
		return err
	}
	if err := dbTx.Commit(); err != nil {
		return err
	}
	pending.log.Infof("stored pending outgoing tx with nonce: %d", transaction.Nonce())
	return nil
}

// track keeps a native-chain broadcast available for nonce selection and rebroadcast.
func (pending *PendingTransactions) track(transaction *types.Transaction) {
	if err := pending.store(transaction); err != nil {
		// Broadcasting is an external side effect. Report success after the network accepted the
		// transaction, even if local pending tracking is unavailable.
		pending.log.WithError(err).
			WithField("txHash", transaction.Hash().Hex()).
			Error("Failed to store pending outgoing transaction")
	}
	pending.enqueueUpdate()
}
