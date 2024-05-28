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
	"os"
	"path"
	"sync"
	"sync/atomic"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/notes"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// AccountConfig holds account configuration.
type AccountConfig struct {
	// Pointer to persisted config. Do not modify this directly. Use
	// `backend.config.ModifyAccountsConfig()` instead.
	Config   *config.Account
	DBFolder string
	// NotesFolder is the folder where the transaction notes are stored. Full path.
	NotesFolder     string
	ConnectKeystore func() (keystore.Keystore, error)
	OnEvent         func(types.Event)
	RateUpdater     *rates.RateUpdater
	GetNotifier     func(signing.Configurations) Notifier
	GetSaveFilename func(suggestedFilename string) string
	// Opens a file in a default application. The filename is not checked.
	UnsafeSystemOpen func(filename string) error
	// BtcCurrencyUnit is the unit which should be used to format fiat amounts values expressed in BTC..
	BtcCurrencyUnit coin.BtcUnit
}

// BaseAccount is an account struct with common functionality to all coin accounts.
type BaseAccount struct {
	observable.Implementation
	Synchronizer *synchronizer.Synchronizer

	config *AccountConfig

	coin coin.Coin

	// synced indicates whether the account has loaded and finished the initial sync of the
	// addresses.
	synced  atomic.Bool
	offline error

	// notes handles transaction notes.
	notes *notes.Notes

	proposedTxNote   string
	proposedTxNoteMu sync.Mutex

	log *logrus.Entry
}

// NewBaseAccount creates a new Account instance.
func NewBaseAccount(config *AccountConfig, coin coin.Coin, log *logrus.Entry) *BaseAccount {
	account := &BaseAccount{
		config: config,
		coin:   coin,
		log:    log,
	}
	account.Synchronizer = synchronizer.NewSynchronizer(
		func() { config.OnEvent(types.EventSyncStarted) },
		func() {
			if account.synced.CompareAndSwap(false, true) {
				config.OnEvent(types.EventStatusChanged)
			}
			config.OnEvent(types.EventSyncDone)
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
	return account.synced.Load()
}

// Close stops the account.
func (account *BaseAccount) Close() {
	account.synced.Store(false)
}

// ResetSynced sets synced to false.
func (account *BaseAccount) ResetSynced() {
	account.synced.Store(false)
}

// Offline implements Interface.
func (account *BaseAccount) Offline() error {
	return account.offline
}

// SetOffline sets the account offline status and emits the EventStatusChanged() if the status
// changed.
func (account *BaseAccount) SetOffline(offline error) {
	account.offline = offline
	account.config.OnEvent(types.EventStatusChanged)
}

// Initialize initializes the account. `accountIdentifier` is used as part of the filename of
// account databases.
func (account *BaseAccount) Initialize(accountIdentifier string) error {
	txNotes, err := notes.LoadNotes(path.Join(
		account.config.NotesFolder,
		fmt.Sprintf("%s.json", accountIdentifier),
	))
	if err != nil {
		return err
	}
	account.notes = txNotes

	if err := account.migrateLegacyNotes(); err != nil {
		return err
	}

	// An account syncdone event is generated when new rates are available. This allows the frontend
	// to reload the relevant data.
	if account.config.RateUpdater != nil {
		account.config.RateUpdater.Observe(func(e observable.Event) {
			if e.Subject == rates.RatesEventSubject {
				account.config.OnEvent(types.EventSyncDone)
			}
		})
	}

	return nil
}

// Migrate legacy notes (notes stored in files based on obsolete account identifiers). Account
// identifiers changed from v4.27.0 to v4.28.0.
func (account *BaseAccount) migrateLegacyNotes() error {
	if len(account.Config().Config.SigningConfigurations) == 0 {
		return nil
	}
	accountNumber, err := account.Config().Config.SigningConfigurations[0].AccountNumber()
	if err != nil {
		return nil
	}
	if accountNumber != 0 {
		// Up to v4.27.0, we only had one account per coin.
		return nil
	}

	legacyConfigurations := signing.ConvertToLegacyConfigurations(account.Config().Config.SigningConfigurations)
	var legacyAccountIdentifiers []string
	switch account.coin.Code() {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeLTC, coin.CodeTLTC:
		legacyAccountIdentifiers = []string{fmt.Sprintf("account-%s-%s", legacyConfigurations.Hash(), account.coin.Code())}
		// Also consider split accounts:
		for _, cfg := range account.Config().Config.SigningConfigurations {
			legacyConfigurations := signing.ConvertToLegacyConfigurations(signing.Configurations{cfg})
			legacyAccountIdentifier := fmt.Sprintf("account-%s-%s-%s", legacyConfigurations.Hash(), account.coin.Code(), cfg.ScriptType())
			legacyAccountIdentifiers = append(
				legacyAccountIdentifiers,
				legacyAccountIdentifier,
			)
		}
	default:
		legacyAccountIdentifiers = []string{
			fmt.Sprintf("account-%s-%s", legacyConfigurations[0].Hash(), account.coin.Code()),
		}
	}
	for _, identifier := range legacyAccountIdentifiers {
		notesFile := path.Join(account.config.NotesFolder, fmt.Sprintf("%s.json", identifier))
		if _, err := os.Stat(notesFile); os.IsNotExist(err) {
			continue // skip nonexistent legacy notes file
		}

		legacyNotes, err := notes.LoadNotes(path.Join(
			account.config.NotesFolder,
			fmt.Sprintf("%s.json", identifier),
		))
		if err != nil {
			return err
		}
		if err := account.notes.MergeLegacy(legacyNotes); err != nil {
			return err
		}
		_ = os.Remove(notesFile)
	}
	return nil
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
	account.config.OnEvent(types.EventStatusChanged)
	return nil
}

// TxNote fetches a note for a transcation. Returns the empty string if no note was found.
func (account *BaseAccount) TxNote(txID string) string {
	return account.notes.TxNote(txID)
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
				account.TxNote(transaction.InternalID),
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
