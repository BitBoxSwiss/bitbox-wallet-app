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

// Code is a globally unique account code. It is used for example as a name in databases (e.g. cache
// database, transaction notes database, etc).
type Code string

// AccountConfig holds account configuration.
type AccountConfig struct {
	// Active, if false, does not load the account in the sidebar, portfolio, etc.
	Active bool
	// Code is an identifier for the account *type* (part of account database filenames, apis, etc.).
	// Type as in btc-p2wpkh, eth-erc20-usdt, etc.
	Code Code
	// Name returns a human readable long name.
	Name string
	// DBFolder is the folder for all accounts. Full path.
	DBFolder string
	// NotesFolder is the folder where the transaction notes are stored. Full path.
	NotesFolder           string
	Keystore              keystore.Keystore
	OnEvent               func(Event)
	RateUpdater           *rates.RateUpdater
	SigningConfigurations signing.Configurations
	GetNotifier           func(signing.Configurations) Notifier
	GetSaveFilename       func(suggestedFilename string) string
	// Opens a file in a default application. The filename is not checked.
	UnsafeSystemOpen func(filename string) error
	// BtcCurrencyUnit is the unit which should be used to format fiat amounts values expressed in BTC..
	BtcCurrencyUnit string
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

	// notes handles transaction notes.
	//
	// It is a slice for migration purposes: from v4.27.0 to v4.28.0, the account identifiers
	// changed. The slice contains all possible instances of where notes are stored. The first
	// element is the newest, and other elements are notes stored under legacy names. After
	// `Initialize()`, this will always have at least one element.
	notes []*notes.Notes

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
	txNotes, err := notes.LoadNotes(path.Join(
		account.config.NotesFolder,
		fmt.Sprintf("%s.json", accountIdentifier),
	))
	if err != nil {
		return err
	}
	account.notes = []*notes.Notes{txNotes}

	// Append legacy notes (notes stored in files based on obsolete account identifiers). Account
	// identifiers changed from v4.27.0 to v4.28.0.
	if len(account.Config().SigningConfigurations) == 0 {
		return nil
	}
	accountNumber, err := account.Config().SigningConfigurations[0].AccountNumber()
	if err != nil {
		return nil
	}
	if accountNumber != 0 {
		// Up to v4.27.0, we only had one account per coin.
		return nil
	}

	legacyConfigurations := signing.ConvertToLegacyConfigurations(account.Config().SigningConfigurations)
	var legacyAccountIdentifiers []string
	switch account.coin.Code() {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeLTC, coin.CodeTLTC:
		legacyAccountIdentifiers = []string{fmt.Sprintf("account-%s-%s", legacyConfigurations.Hash(), account.coin.Code())}
		// Also consider split accounts:
		for _, cfg := range account.Config().SigningConfigurations {
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
		account.notes = append(account.notes, legacyNotes)
	}

	// An account syncdone event is generated when new rates are available. This allows the frontend to reload the relevant data.
	if account.config.RateUpdater != nil {
		account.config.RateUpdater.Observe(func(e observable.Event) {
			if e.Subject == rates.RatesEventSubject {
				account.config.OnEvent(EventSyncDone)
			}
		})
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
	// The notes slice is guaranteed to have at least one element by BaseAccount.Initialize.
	if err := account.notes[0].SetTxNote(txID, note); err != nil {
		return err
	}
	// Delete the notes in legacy files. Don't really care if it fails.
	for i, notes := range account.notes[1:] {
		if err := notes.SetTxNote(txID, ""); err != nil {
			account.log.WithError(err).Errorf("Can't delete a note from a legacy file idx=%d", i)
		}
	}
	// Prompt refresh.
	account.config.OnEvent(EventStatusChanged)
	return nil
}

// TxNote fetches a note for a transcation. Returns the empty string if no note was found.
func (account *BaseAccount) TxNote(txID string) string {
	// Take the first note we can find. The first slice element is the regular location of notes,
	// the other elements lookup notes in legacy locations, so they are not lost when upgrading.
	for _, notes := range account.notes {
		if note := notes.TxNote(txID); note != "" {
			return note
		}
	}
	return ""
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
