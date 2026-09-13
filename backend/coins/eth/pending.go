// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
)

// PendingTransactions provides local nonce protection and broadcast tracking for one chain/address.
type PendingTransactions struct {
	chainID       uint64
	sender        common.Address
	outgoing      *OutgoingTransactions
	enqueueUpdate func()
	log           *logrus.Entry
}

// track keeps a native-chain broadcast available for nonce selection and rebroadcast.
func (pending *PendingTransactions) track(sender *outgoingSender, transaction *types.Transaction) {
	if err := sender.store(transaction); err != nil {
		// Broadcasting is an external side effect. Report success after the network accepted the
		// transaction, even if local pending tracking is unavailable.
		pending.log.WithError(err).
			WithField("txHash", transaction.Hash().Hex()).
			Error("Failed to store pending outgoing transaction")
	}
	pending.enqueueUpdate()
}
