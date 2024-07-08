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

// Package notes provides functionality to retrieve and store account transaction notes.
package notes

import (
	"encoding/json"
	"os"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// MaxNoteLen is the maximum length per note.
const MaxNoteLen = 1024

// Data is the notes JSON data serialized to disk.
type Data struct {
	// More fields to be added when we can label more stuff, e.g. receive addresses, utxos, etc.

	// a map of transaction ID to transaction note.
	TransactionNotes map[string]string `json:"transactions"`
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

// SetTxNote stores a note for a transaction. An empty note will result in the entry being deleted
// (or not written if it didn't exist), since `TxNote()` returns an empty string anyway if there is
// no note. Returns whether the note was modified.
func (notes *Notes) SetTxNote(txID string, note string) (bool, error) {
	notes.dataMu.Lock()
	defer notes.dataMu.Unlock()

	if len(note) > MaxNoteLen {
		return false, errp.Newf("Length of note must be smaller than %d. Got %d", MaxNoteLen, len(note))
	}

	if notes.data.TransactionNotes == nil {
		notes.data.TransactionNotes = map[string]string{}
	}
	changed := notes.data.TransactionNotes[txID] != note
	if note == "" {
		// Since not existing entries are returned as `""` anyway, there no need to actually store
		// them in the JSON file.
		delete(notes.data.TransactionNotes, txID)
	} else {
		notes.data.TransactionNotes[txID] = note
	}
	return changed, write(notes.data, notes.filename)
}

// TxNote fetches a note for a transaction. Returns the empty string if no note was found.
// NOTE: noteID is either txid or txid:n, n MIGHT NOT be the outpoint from the bitcoin transaction.
func (notes *Notes) TxNote(noteID string) string {
	notes.dataMu.RLock()
	defer notes.dataMu.RUnlock()

	return notes.data.TransactionNotes[noteID]
}

// Data retrieves all stored notes. You must not modify the returned object.
func (notes *Notes) Data() *Data {
	notes.dataMu.RLock()
	defer notes.dataMu.RUnlock()
	return notes.data
}

// MergeLegacy merges the notes from an older/legacy notes file. Current/new notes take priority in
// case of conflict.
func (notes *Notes) MergeLegacy(legacy *Notes) error {
	notes.dataMu.Lock()
	defer notes.dataMu.Unlock()

	if notes.data.TransactionNotes == nil {
		notes.data.TransactionNotes = map[string]string{}
	}

	legacyData := legacy.Data()
	for txID, note := range legacyData.TransactionNotes {
		if _, ok := notes.data.TransactionNotes[txID]; !ok {
			notes.data.TransactionNotes[txID] = note
		}
	}
	return write(notes.data, notes.filename)
}
