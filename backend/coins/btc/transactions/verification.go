package transactions

import (
	"fmt"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
)

func (transactions *Transactions) onHeadersEvent(event headers.Event) {
	if event == headers.EventSynced {
		transactions.verifyTransactions()
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
		_, _, height, _, err := dbTx.TxInfo(txHash)
		if err != nil {
			// TODO
			panic(err)
		}
		result[txHash] = height
	}
	return result
}

func hashMerkleRoot(merkle []client.TXHash, start chainhash.Hash, pos int) chainhash.Hash {
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
	transactions.log.Infof("verifying %d transactions", len(unverifiedTransactions))
	for txHash, height := range unverifiedTransactions {
		transactions.verifyTransaction(txHash, height)
	}
}

func (transactions *Transactions) verifyTransaction(txHash chainhash.Hash, height int) {
	if height <= 0 {
		return
	}
	header, err := transactions.headers.HeaderByHeight(height)
	if err != nil {
		// TODO
		panic(err)
	}
	if header == nil {
		transactions.log.Warningf("Header not yet synced to %d, couldn't verify tx", height)
		return
	}
	done := transactions.synchronizer.IncRequestsCounter()
	if err := transactions.blockchain.GetMerkle(
		txHash, height,
		func(merkle []client.TXHash, pos int) error {
			expectedMerkleRoot := hashMerkleRoot(merkle, txHash, pos)
			if expectedMerkleRoot != header.MerkleRoot {
				transactions.log.Warning(
					fmt.Sprintf("Merkle root verification failed for %s", txHash))
				return nil
			}
			transactions.log.Info(
				fmt.Sprintf("Merkle root verification succeeded for %s", txHash))

			defer transactions.Lock()()
			dbTx, err := transactions.db.Begin()
			if err != nil {
				// TODO
				panic(err)
			}
			defer dbTx.Rollback()
			if err := dbTx.MarkTxVerified(txHash, header.Timestamp); err != nil {
				return err
			}
			return dbTx.Commit()
		},
		done,
	); err != nil {
		transactions.log.WithError(err).Panic("Failed to retrieve merkle")
	}
}
