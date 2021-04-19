// Copyright 2020 Shift Crypto AG
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

package accounts

import (
	"encoding/csv"
	"fmt"
	"io"
	"path"
	"sync"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/notes"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// AccountConfig holds account configuration.
type AccountConfig struct {
	// Code is an identifier for the account *type* (part of account database filenames, apis, etc.).
	// Type as in btc-p2wpkh, eth-erc20-usdt, etc.
	Code string
	// Name returns a human readable long name.
	Name string
	// DBFolder is the folder for all accounts. Full path.
	DBFolder string
	// NotesFolder is the folder where the transaction notes are stored. Full path.
	NotesFolder           string
	Keystores             *keystore.Keystores
	OnEvent               func(Event)
	RateUpdater           *rates.RateUpdater
	SigningConfigurations signing.Configurations
	GetNotifier           func(signing.Configurations) Notifier
}

// BaseAccount is an account struct with common functionality to all coin accounts.
type BaseAccount struct {
	observable.Implementation
	Synchronizer *synchronizer.Synchronizer

	config *AccountConfig

	coin coin.Coin

	// synced indicates whether the account has loaded and finished the initial sync of the
	// addresses.
	synced  bool
	offline error

	notes *notes.Notes

	proposedTxNote   string
	proposedTxNoteMu sync.Mutex
}

// NewBaseAccount creates a new Account instance.
func NewBaseAccount(config *AccountConfig, coin coin.Coin, log *logrus.Entry) *BaseAccount {
	account := &BaseAccount{
		config: config,
		coin:   coin,
	}
	account.Synchronizer = synchronizer.NewSynchronizer(
		func() { config.OnEvent(EventSyncStarted) },
		func() {
			if !account.synced {
				account.synced = true
				config.OnEvent(EventStatusChanged)
			}
			config.OnEvent(EventSyncDone)
		},
		log,
	)
	return account
}

// Config implements Interface.
func (account *BaseAccount) Config() *AccountConfig {
	return account.config
}

// Coin implements accounts.Interface.
func (account *BaseAccount) Coin() coin.Coin {
	return account.coin
}

// Synced implements Interface.
func (account *BaseAccount) Synced() bool {
	return account.synced
}

// Close stops the account.
func (account *BaseAccount) Close() {
	account.synced = false
}

// ResetSynced sets synced to false.
func (account *BaseAccount) ResetSynced() {
	account.synced = false
}

// Offline implements Interface.
func (account *BaseAccount) Offline() error {
	return account.offline
}

// SetOffline sets the account offline status and emits the EventStatusChanged() if the status
// changed.
func (account *BaseAccount) SetOffline(offline error) {
	account.offline = offline
	account.config.OnEvent(EventStatusChanged)
}

// Initialize initializes the account. `accountIdentifier` is used as part of the filename of
// account databases.
func (account *BaseAccount) Initialize(accountIdentifier string) error {
	notes, err := notes.LoadNotes(path.Join(
		account.config.NotesFolder,
		fmt.Sprintf("%s.json", accountIdentifier),
	))
	if err != nil {
		return err
	}
	account.notes = notes
	return nil
}

// Notes implements Interface.
func (account *BaseAccount) Notes() *notes.Notes {
	return account.notes
}

// ProposeTxNote implements accounts.Account.
func (account *BaseAccount) ProposeTxNote(note string) {
	account.proposedTxNoteMu.Lock()
	defer account.proposedTxNoteMu.Unlock()

	account.proposedTxNote = note
}

// GetAndClearProposedTxNote returns the note previously set using ProposeTxNote(). If none was set,
// the empty string is returned. The proposed note is cleared by calling this function.
func (account *BaseAccount) GetAndClearProposedTxNote() string {
	account.proposedTxNoteMu.Lock()
	defer func() {
		account.proposedTxNote = ""
		account.proposedTxNoteMu.Unlock()
	}()
	return account.proposedTxNote
}

// SetTxNote implements accounts.Account.
func (account *BaseAccount) SetTxNote(txID string, note string) error {
	if err := account.notes.SetTxNote(txID, note); err != nil {
		return err
	}
	// Prompt refresh.
	account.config.OnEvent(EventStatusChanged)
	return nil
}

// ExportCSV implements accounts.Account.
func (account *BaseAccount) ExportCSV(w io.Writer, transactions []*TransactionData) error {
	writer := csv.NewWriter(w)
	err := writer.Write([]string{
		"Time",
		"Type",
		"Amount",
		"Unit",
		"Fee",
		"Address",
		"Transaction ID",
		"Note",
	})
	if err != nil {
		return errp.WithStack(err)
	}

	for _, transaction := range transactions {
		transactionType := map[TxType]string{
			TxTypeReceive:  "received",
			TxTypeSend:     "sent",
			TxTypeSendSelf: "sent_to_yourself",
		}[transaction.Type]
		feeString := ""
		fee := transaction.Fee
		if fee != nil {
			feeString = fee.BigInt().String()
		}
		unit := account.Coin().SmallestUnit()
		timeString := ""
		if transaction.Timestamp != nil {
			timeString = transaction.Timestamp.Format(time.RFC3339)
		}
		for _, addressAndAmount := range transaction.Addresses {
			if transactionType == "sent" && addressAndAmount.Ours {
				transactionType = "sent_to_yourself"
			}
			err := writer.Write([]string{
				timeString,
				transactionType,
				addressAndAmount.Amount.BigInt().String(),
				unit,
				feeString,
				addressAndAmount.Address,
				transaction.TxID,
				account.Notes().TxNote(transaction.InternalID),
			})
			if err != nil {
				return errp.WithStack(err)
			}
			// a multitx is output in one row per receive address. Show the tx fee only in the
			// first row.
			feeString = ""
		}
	}
	writer.Flush()
	return writer.Error()
}
