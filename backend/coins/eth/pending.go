// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
)

// ErrBroadcastUncertain means a tracked submission may still reach the network or confirm.
const ErrBroadcastUncertain errp.ErrorCode = "broadcastUncertain"

// PendingTransactions provides local nonce protection and broadcast tracking for one chain/address.
type PendingTransactions struct {
	chainID       uint64
	sender        common.Address
	outgoing      *OutgoingTransactions
	enqueueUpdate func()
	log           *logrus.Entry
}

// send requires the sender lock through broadcast resolution and shared reservation.
func (pending *PendingTransactions) send(client rpcclient.Interface, sender *outgoingSender, transaction *types.Transaction) error {
	err := client.SendTransaction(context.TODO(), transaction)
	rpcErr, _ := errp.Cause(err).(rpcclient.RPCError)
	if err != nil && rpcErr.Message != "already known" {
		known, _, lookupErr := client.TransactionByHash(context.TODO(), transaction.Hash())
		if lookupErr != nil || known == nil {
			if !rpcErr.Rejected() {
				// An unresolved broadcast can still arrive; sibling sends must reserve its nonce and funds.
				pending.track(sender, transaction)
			}
			if sender.records[transaction.Hash()] != nil {
				return errp.WithMessage(ErrBroadcastUncertain, err.Error())
			}
			return errp.WithStack(err)
		}
	}
	pending.track(sender, transaction)
	return nil
}

// track keeps a native-chain broadcast available for nonce selection and rebroadcast.
func (pending *PendingTransactions) track(sender *outgoingSender, transaction *types.Transaction) {
	if err := sender.store(transaction); err != nil {
		// Persistence failures cannot change the outcome of a broadcast attempt.
		pending.log.WithError(err).
			WithField("txHash", transaction.Hash().Hex()).
			Error("Failed to store pending outgoing transaction")
	}
	pending.enqueueUpdate()
}
