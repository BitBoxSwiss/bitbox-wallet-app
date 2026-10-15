// SPDX-License-Identifier: Apache-2.0

// Package notes provides functionality to retrieve and store account transaction notes.
package notes

import (
	"encoding/json"
	"errors"
	"os"
	"sync"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// MaxNoteLen is the maximum length per note.
const MaxNoteLen = 1024

// Data is the notes JSON data serialized to disk.
type Data struct {
	// More fields to be added when we can label more stuff, e.g. receive addresses, utxos, etc.

	// a map of transaction ID to transaction note.
	TransactionNotes map[string]string `json:"transactions"`
	// TransactionsMetadata tracks metadata for entries in TransactionNotes. It
	// is stored separately so the longstanding notes file shape remains a
	// simple txID -> note map for backwards compatibility.
	TransactionsMetadata map[string]TransactionMetadata `json:"transactionsMetadata,omitempty"`
}

// TransactionMetadata stores metadata for a transaction note.
type TransactionMetadata struct {
	// ModifiedAt is when the transaction note was last edited.
	ModifiedAt time.Time `json:"modifiedAt,omitempty"`
}

// TransactionNoteEntry is a transaction note plus sync metadata.
type TransactionNoteEntry struct {
	Note     string
	Metadata TransactionMetadata
}

// read deserializes the json files into notes. If the file does not exist yet, no error is
// returned, and the struct is retruned with default values.
func read(filename string) (*Data, error) {
	file, err := os.Open(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return &Data{}, nil
		}
		return nil, errp.WithStack(err)
	}
	defer file.Close() //nolint:errcheck
	var notes Data
	if err := json.NewDecoder(file).Decode(&notes); err != nil {
		return nil, errp.WithStack(err)
	}
	return &notes, nil
}

func write(data *Data, filename string) error {
	file, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		return errp.WithStack(err)
	}
	return nil
}

// Notes is a high level helper for notes, allowing you to read and set notes for transactions.
type Notes struct {
	filename string
	data     *Data
	dataMu   sync.RWMutex
}

// LoadNotes makes a new Notes instance, already pre-loading all notes into RAM. If the file does
// not exist, no error is returned.  Returns an error for other kinds of file read errors.
func LoadNotes(filename string) (*Notes, error) {
	data, err := read(filename)
	if err != nil {
		return nil, err
	}
	return &Notes{
		filename: filename,
		data:     data,
	}, nil
}

// SetTxNote stores a note for a transaction. Empty notes are stored explicitly
// as tombstones only when clearing existing note state, so transaction-note sync
// can propagate deletions. TxNote still returns an empty string for both missing
// notes and explicit tombstones.
func (notes *Notes) SetTxNote(txID string, note string) (bool, error) {
	notes.dataMu.Lock()
	defer notes.dataMu.Unlock()

	if len(note) > MaxNoteLen {
		return false, transactionNoteTooLongError(len(note))
	}

	if notes.data.TransactionNotes == nil {
		notes.data.TransactionNotes = map[string]string{}
	}
	current, ok := notes.data.TransactionNotes[txID]
	if !ok && note == "" {
		return false, nil
	}
	changed := !ok || current != note
	if changed {
		notes.setTxNoteModifiedAt(txID, time.Now().UTC())
	}
	notes.data.TransactionNotes[txID] = note
	return changed, write(notes.data, notes.filename)
}

// TxNote fetches a note for a transaction. Returns the empty string if no note was found.
func (notes *Notes) TxNote(txID string) string {
	notes.dataMu.RLock()
	defer notes.dataMu.RUnlock()

	return notes.data.TransactionNotes[txID]
}

// TransactionNoteEntries returns a copy of all stored transaction notes with
// their metadata. Notes from older files may have zero metadata until they are
// edited or updated by sync.
func (notes *Notes) TransactionNoteEntries() map[string]TransactionNoteEntry {
	notes.dataMu.RLock()
	defer notes.dataMu.RUnlock()

	return notes.transactionNoteEntries()
}

// UpdateTransactionNoteEntries atomically updates transaction notes together
// with their metadata.
//
// update is called while the notes lock is held. It may inspect and mutate the
// supplied map, but it must not retain it after returning. The map is written to
// disk only when update returns changed=true.
func (notes *Notes) UpdateTransactionNoteEntries(
	update func(map[string]TransactionNoteEntry) (changed bool, err error),
) (bool, error) {
	notes.dataMu.Lock()
	defer notes.dataMu.Unlock()

	entries := notes.transactionNoteEntries()
	changed, err := update(entries)
	if err != nil || !changed {
		return changed, err
	}
	if err := validateTransactionNoteEntries(entries); err != nil {
		return false, err
	}
	notes.setTransactionNoteEntries(entries)
	return true, write(notes.data, notes.filename)
}

// MergeLegacy merges the notes from an older/legacy notes file. Current/new notes take priority in
// case of conflict.
func (notes *Notes) MergeLegacy(legacy *Notes) error {
	notes.dataMu.Lock()
	defer notes.dataMu.Unlock()

	if notes.data.TransactionNotes == nil {
		notes.data.TransactionNotes = map[string]string{}
	}

	for txID, entry := range legacy.TransactionNoteEntries() {
		if _, ok := notes.data.TransactionNotes[txID]; !ok {
			notes.data.TransactionNotes[txID] = entry.Note
			if !entry.Metadata.isZero() {
				notes.setTransactionMetadata(txID, entry.Metadata)
			}
		}
	}
	return write(notes.data, notes.filename)
}

func (notes *Notes) setTxNoteModifiedAt(txID string, modifiedAt time.Time) {
	if notes.data.TransactionsMetadata == nil {
		notes.data.TransactionsMetadata = map[string]TransactionMetadata{}
	}
	metadata := notes.data.TransactionsMetadata[txID]
	metadata.ModifiedAt = modifiedAt.UTC()
	notes.data.TransactionsMetadata[txID] = metadata
}

func (notes *Notes) transactionNoteEntries() map[string]TransactionNoteEntry {
	entries := make(map[string]TransactionNoteEntry, len(notes.data.TransactionNotes))
	for txID, note := range notes.data.TransactionNotes {
		metadata := notes.data.TransactionsMetadata[txID]
		entries[txID] = TransactionNoteEntry{
			Note:     note,
			Metadata: metadata,
		}
	}
	return entries
}

func (notes *Notes) setTransactionNoteEntries(entries map[string]TransactionNoteEntry) {
	notes.data.TransactionNotes = make(map[string]string, len(entries))
	notes.data.TransactionsMetadata = nil
	for txID, entry := range entries {
		notes.data.TransactionNotes[txID] = entry.Note
		if !entry.Metadata.isZero() {
			notes.setTransactionMetadata(txID, entry.Metadata)
		}
	}
}

func (metadata TransactionMetadata) isZero() bool {
	return metadata.ModifiedAt.IsZero()
}

func (notes *Notes) setTransactionMetadata(txID string, metadata TransactionMetadata) {
	if !metadata.ModifiedAt.IsZero() {
		metadata.ModifiedAt = metadata.ModifiedAt.UTC()
	}
	if notes.data.TransactionsMetadata == nil {
		notes.data.TransactionsMetadata = map[string]TransactionMetadata{}
	}
	notes.data.TransactionsMetadata[txID] = metadata
}

func validateTransactionNoteEntries(entries map[string]TransactionNoteEntry) error {
	var errs []error
	for _, entry := range entries {
		if len(entry.Note) > MaxNoteLen {
			errs = append(errs, transactionNoteTooLongError(len(entry.Note)))
		}
	}
	return errors.Join(errs...)
}

func transactionNoteTooLongError(noteLen int) error {
	return errp.Newf("Length of note must be at most %d. Got %d", MaxNoteLen, noteLen)
}
