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

package transactions

import (
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/headers"
)

func (transactions *Transactions) onHeadersEvent(event headers.Event) {
	switch event {
	case headers.EventSynced:
		transactions.verifyTransactions()
	case headers.EventNewTip:
		done := transactions.synchronizer.IncRequestsCounter()
		transactions.headersTipHeight = transactions.headers.TipHeight()
		done()
	}
}

func (transactions *Transactions) unverifiedTransactions() map[chainhash.Hash]int {
	defer transactions.RLock()()
	dbTx, err := transactions.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()
	unverifiedTransactions, err := dbTx.UnverifiedTransactions()
	if err != nil {
		// TODO
		panic(err)
	}
	result := map[chainhash.Hash]int{}
	for _, txHash := range unverifiedTransactions {
		txInfo, err := dbTx.TxInfo(txHash)
		if err != nil {
			// TODO
			panic(err)
		}
		result[txHash] = txInfo.Height
	}
	return result
}

func hashMerkleRoot(merkle []blockchain.TXHash, start chainhash.Hash, pos int) chainhash.Hash {
	for i := 0; i < len(merkle); i++ {
		if (uint32(pos)>>uint32(i))&1 == 0 {
			start = chainhash.DoubleHashH(append(start[:], merkle[i][:]...))
		} else {
			start = chainhash.DoubleHashH(append(merkle[i][:], start[:]...))
		}
	}
	return start
}

func (transactions *Transactions) verifyTransactions() {
	unverifiedTransactions := transactions.unverifiedTransactions()
	transactions.log.Debugf("verifying %d transactions", len(unverifiedTransactions))
	for txHash, height := range unverifiedTransactions {
		transactions.verifyTransaction(txHash, height)
	}
}

func (transactions *Transactions) verifyTransaction(txHash chainhash.Hash, height int) {
	if height <= 0 {
		return
	}
	header, err := transactions.headers.VerifiedHeaderByHeight(height)
	if err != nil {
		// TODO
		panic(err)
	}
	if header == nil {
		transactions.log.Warningf("Header not yet synced to %d, couldn't verify tx", height)
		return
	}
	done := transactions.synchronizer.IncRequestsCounter()
	transactions.blockchain.GetMerkle(
		txHash, height,
		func(merkle []blockchain.TXHash, pos int) {
			expectedMerkleRoot := hashMerkleRoot(merkle, txHash, pos)
			if expectedMerkleRoot != header.MerkleRoot {
				transactions.log.Warning("Merkle root verification failed")
				return
			}
			transactions.log.Debugf("Merkle root verification succeeded")

			defer transactions.Lock()()
			dbTx, err := transactions.db.Begin()
			if err != nil {
				// TODO
				panic(err)
			}
			defer dbTx.Rollback()
			if err := dbTx.MarkTxVerified(txHash, header.Timestamp); err != nil {
				transactions.log.WithError(err).Panic("MarkTxVerified")
			}
			if err := dbTx.Commit(); err != nil {
				transactions.log.WithError(err).Panic("GetMerkle Commit")
			}
		},
		func(err error) {
			done()
			if err != nil {
				panic(err)
			}
		})
}
