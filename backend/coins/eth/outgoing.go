// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"errors"
	"iter"
	"maps"
	"math"
	"math/big"
	"path/filepath"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
)

type senderKey struct {
	chainID uint64
	address common.Address
}

// OutgoingTransactions owns outgoing records and submission locks across ETH and token accounts.
type OutgoingTransactions struct {
	lifetime sync.RWMutex
	mu       sync.Mutex
	db       db.Interface
	senders  map[senderKey]*outgoingSender
}

type outgoingSender struct {
	sync.Mutex
	key            senderKey
	db             db.Interface
	records        map[common.Hash]*ethtypes.TransactionWithMetadata
	confirmedNonce uint64
}

// NewOutgoingTransactions opens the shared Ethereum cache.
func NewOutgoingTransactions(folder string) (*OutgoingTransactions, error) {
	database, err := db.NewDB(filepath.Join(folder, "eth-outgoing.db"))
	if err != nil {
		return nil, err
	}
	return &OutgoingTransactions{db: database, senders: make(map[senderKey]*outgoingSender)}, nil
}

// Close drains active users before closing the database.
func (outgoing *OutgoingTransactions) Close() error {
	outgoing.lifetime.Lock()
	defer outgoing.lifetime.Unlock()
	if outgoing.db == nil {
		return nil
	}
	err := outgoing.db.Close()
	outgoing.db = nil
	return err
}

func (outgoing *OutgoingTransactions) lock(chainID uint64, address common.Address) (*outgoingSender, func(), error) {
	outgoing.lifetime.RLock()
	if outgoing.db == nil {
		outgoing.lifetime.RUnlock()
		return nil, nil, errp.New("Ethereum outgoing database is closed")
	}
	key := senderKey{chainID, address}
	outgoing.mu.Lock()
	sender := outgoing.senders[key]
	if sender == nil {
		sender = &outgoingSender{key: key, db: outgoing.db}
		outgoing.senders[key] = sender
	}
	outgoing.mu.Unlock()
	sender.Lock()
	unlock := func() {
		sender.Unlock()
		outgoing.lifetime.RUnlock()
	}
	if sender.records == nil {
		tx, err := sender.db.BeginForSender(chainID, address)
		if err != nil {
			unlock()
			return nil, nil, err
		}
		records, err := tx.OutgoingTransactions()
		tx.Rollback()
		if err != nil {
			unlock()
			return nil, nil, err
		}
		sender.records = make(map[common.Hash]*ethtypes.TransactionWithMetadata, len(records))
		for _, record := range records {
			sender.records[record.Transaction.Hash()] = record
		}
	}
	return sender, unlock, nil
}

func (sender *outgoingSender) refresh(client rpcclient.Interface) error {
	if len(sender.records) == 0 {
		return nil
	}
	height, err := client.BlockNumber(context.TODO())
	if err != nil {
		return err
	}
	return sender.reconcile(client, height.Uint64())
}

func (sender *outgoingSender) nextNonce(client rpcclient.Interface) (uint64, error) {
	nonce, err := client.PendingNonceAt(context.TODO(), sender.key.address)
	if err != nil {
		return 0, err
	}
	nonce = max(nonce, sender.confirmedNonce)
	for _, record := range sender.records {
		if record.Height == 0 && !record.NonceConsumed && record.Transaction.Nonce() >= nonce {
			if record.Transaction.Nonce() == math.MaxUint64 {
				return 0, errp.New("Ethereum nonce exhausted")
			}
			nonce = record.Transaction.Nonce() + 1
		}
	}
	return nonce, nil
}

func pendingAmounts(records iter.Seq[*ethtypes.TransactionWithMetadata], address common.Address, token *erc20.Token, confirmed map[string]*accounts.TransactionData) map[uint64]*big.Int {
	reserved := make(map[uint64]*big.Int)
	for record := range records {
		if record.Height != 0 || record.NonceConsumed || confirmed[record.TxID()] != nil {
			continue
		}
		data := record.TransactionData(0, token, address.Hex())
		if data == nil {
			continue
		}
		amount := data.Amount.BigInt()
		if data.Type == accounts.TxTypeSendSelf {
			amount = new(big.Int)
		}
		if token == nil {
			tx := record.Transaction
			amount.Add(amount, new(big.Int).Mul(new(big.Int).SetUint64(tx.Gas()), tx.GasFeeCap()))
		}
		nonce := record.Transaction.Nonce()
		if previous := reserved[nonce]; previous == nil || amount.Cmp(previous) > 0 {
			reserved[nonce] = amount
		}
	}
	return reserved
}

// checkFunds includes shared pending reservations and preserves explicit replacements.
func (sender *outgoingSender) checkFunds(client rpcclient.Interface, tx *types.Transaction, token *erc20.Token) error {
	required := map[*erc20.Token]*big.Int{nil: tx.Cost()}
	if token != nil {
		record := &ethtypes.TransactionWithMetadata{Transaction: tx}
		_, amount, ok := record.TokenTransfer()
		if !ok || *tx.To() != token.ContractAddress() {
			return errp.New("invalid ERC20 transfer")
		}
		required[token] = amount
	}
	for asset, amount := range required {
		var balance *big.Int
		var err error
		if asset == nil {
			balance, err = client.Balance(context.TODO(), sender.key.address)
		} else {
			balance, err = client.ERC20Balance(sender.key.address, asset, nil)
		}
		if err != nil {
			return err
		}
		for nonce, pending := range pendingAmounts(maps.Values(sender.records), sender.key.address, asset, nil) {
			if nonce != tx.Nonce() {
				amount.Add(amount, pending)
			}
		}
		if amount.Cmp(balance) > 0 {
			if token != nil && asset == nil {
				return accountErrors.ErrERC20InsufficientGasFunds
			}
			return accountErrors.ErrInsufficientFunds
		}
	}
	return nil
}

func (sender *outgoingSender) store(transaction *types.Transaction) error {
	if _, exists := sender.records[transaction.Hash()]; exists {
		return nil
	}
	record := &ethtypes.TransactionWithMetadata{Transaction: transaction}
	// Keep accepted transactions in memory even if persistence fails.
	sender.records[transaction.Hash()] = record
	return sender.save(map[common.Hash]*ethtypes.TransactionWithMetadata{transaction.Hash(): record}, nil)
}

func (sender *outgoingSender) save(records map[common.Hash]*ethtypes.TransactionWithMetadata, deleted []common.Hash) error {
	tx, err := sender.db.BeginForSender(sender.key.chainID, sender.key.address)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, record := range records {
		if err := tx.PutOutgoingTransaction(record); err != nil {
			return err
		}
	}
	for _, hash := range deleted {
		if err := tx.DeleteOutgoingTransaction(hash); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	for hash, record := range records {
		sender.records[hash] = record
	}
	for _, hash := range deleted {
		delete(sender.records, hash)
	}
	return nil
}

func (sender *outgoingSender) reconcile(client rpcclient.Interface, height uint64) error {
	if len(sender.records) == 0 {
		return nil
	}
	nonce, err := client.NonceAt(context.TODO(), sender.key.address, new(big.Int).SetUint64(height))
	if err != nil {
		return err
	}
	updated := make(map[common.Hash]*ethtypes.TransactionWithMetadata, len(sender.records))
	confirmedNonce := nonce
	var replaced []common.Hash
	for hash, record := range sender.records {
		snapshot := *record
		snapshot.NonceConsumed = record.Transaction.Nonce() < confirmedNonce
		updated[hash] = &snapshot
		if !outgoingTransactionIsFinal(record, height) {
			receipt, err := client.TransactionReceiptWithBlockNumber(context.TODO(), hash)
			if err != nil && !errors.Is(err, ethereum.NotFound) {
				// Confirmed nonce consumption is sufficient to release reservations. Preserve
				// receipt metadata and retry later without blocking unrelated submissions.
				if snapshot.NonceConsumed {
					continue
				}
				return err
			}
			snapshot.Height, snapshot.GasUsed, snapshot.Success = 0, 0, false
			snapshot.LastReceiptCheckHeight = height
			if receipt != nil {
				if receipt.BlockNumber == nil || !receipt.BlockNumber.IsUint64() {
					return errp.New("invalid receipt block number")
				}
				if receipt.BlockNumber.Uint64() <= height {
					snapshot.Height = receipt.BlockNumber.Uint64()
					snapshot.GasUsed = receipt.GasUsed
					snapshot.Success = receipt.Status == types.ReceiptStatusSuccessful
				}
			} else if snapshot.NonceConsumed {
				replaced = append(replaced, hash)
			}
		}
		if snapshot.Height > 0 && record.Transaction.Nonce() >= nonce {
			if record.Transaction.Nonce() == math.MaxUint64 {
				return errp.New("Ethereum nonce exhausted")
			}
			nonce = record.Transaction.Nonce() + 1
		}
	}
	for _, record := range updated {
		record.NonceConsumed = record.Transaction.Nonce() < nonce
	}
	var deleted []common.Hash
	if len(replaced) > 0 && height >= ethtypes.NumConfirmationsComplete {
		// Use nonce consumption at confirmation depth, even when the replacement was sent
		// elsewhere. Failure only postpones cleanup; it must not prevent new payments.
		block := new(big.Int).SetUint64(height - ethtypes.NumConfirmationsComplete + 1)
		finalNonce, err := client.NonceAt(context.TODO(), sender.key.address, block)
		if err == nil {
			for _, hash := range replaced {
				if updated[hash].Transaction.Nonce() < finalNonce {
					delete(updated, hash)
					deleted = append(deleted, hash)
				}
			}
		}
	}

	if err := sender.save(updated, deleted); err != nil {
		return err
	}
	sender.confirmedNonce = nonce
	return nil
}

func (sender *outgoingSender) rebroadcast(client rpcclient.Interface, log *logrus.Entry) {
	for hash, record := range sender.records {
		if record.Height != 0 || record.NonceConsumed {
			continue
		}
		_, _, err := client.TransactionByHash(context.TODO(), hash)
		if errors.Is(err, ethereum.NotFound) {
			log.WithField("txHash", hash.Hex()).Info("Rebroadcasting transaction")
			if err := client.SendTransaction(context.TODO(), record.Transaction); err != nil {
				log.WithError(err).WithField("txHash", hash.Hex()).Error("Could not rebroadcast transaction")
			}
		} else if err != nil {
			log.WithError(err).WithField("txHash", hash.Hex()).Error("Could not fetch transaction")
		}
	}
}
