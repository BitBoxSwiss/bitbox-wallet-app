// SPDX-License-Identifier: Apache-2.0

package notes

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func transactionNoteStrings(entries map[string]TransactionNoteEntry) map[string]string {
	noteStrings := make(map[string]string, len(entries))
	for txID, entry := range entries {
		noteStrings[txID] = entry.Note
	}
	return noteStrings
}

func TestNotes(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	require.Equal(t, "", notes.TxNote("tx-id-1"))
	require.Equal(t, "", notes.TxNote("tx-id-2"))

	changed, err := notes.SetTxNote("tx-id-missing", "")
	require.NoError(t, err)
	require.False(t, changed)
	require.NotContains(t, notes.TransactionNoteEntries(), "tx-id-missing")

	changed, err = notes.SetTxNote("tx-id-1", "note for tx-id-1")
	require.NoError(t, err)
	require.True(t, changed)
	firstModifiedAt := notes.TransactionNoteEntries()["tx-id-1"].Metadata.ModifiedAt
	require.False(t, firstModifiedAt.IsZero())

	changed, err = notes.SetTxNote("tx-id-1", "note for tx-id-1")
	require.NoError(t, err)
	require.False(t, changed)
	require.True(t, firstModifiedAt.Equal(notes.TransactionNoteEntries()["tx-id-1"].Metadata.ModifiedAt))

	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "", notes.TxNote("tx-id-2"))

	_, err = notes.SetTxNote("tx-id-2", "note for tx-id-2")
	require.NoError(t, err)
	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "note for tx-id-2", notes.TxNote("tx-id-2"))

	changed, err = notes.SetTxNote("tx-id-1", "")
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "", notes.TxNote("tx-id-1"))

	entries := notes.TransactionNoteEntries()
	require.Equal(t,
		map[string]string{
			"tx-id-1": "",
			"tx-id-2": "note for tx-id-2",
		},
		transactionNoteStrings(entries))
	require.Contains(t, entries, "tx-id-1")
	require.False(t, entries["tx-id-1"].Metadata.ModifiedAt.IsZero())
	require.Contains(t, entries, "tx-id-2")
	require.False(t, entries["tx-id-2"].Metadata.ModifiedAt.IsZero())
}

// TestNotesPersisted checks that notes are persisted.
func TestNotesPersisted(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	_, err = notes.SetTxNote("some-tx-id", "note for some-tx-id")
	require.NoError(t, err)

	// Reload notes.
	notes, err = LoadNotes(filename)
	require.NoError(t, err)
	require.Equal(t, "note for some-tx-id", notes.TxNote("some-tx-id"))
	require.False(t, notes.TransactionNoteEntries()["some-tx-id"].Metadata.ModifiedAt.IsZero())

	require.NoError(t, os.Remove(filename))
	notes, err = LoadNotes(filename)
	require.NoError(t, err)
	require.Equal(t, "", notes.TxNote("some-tx-id"))
}

// TestMaxLen checks that notes that are too long are rejected.
func TestMaxLen(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)
	_, err = notes.SetTxNote("tx-id", strings.Repeat("x", 1024))
	require.NoError(t, err)
	_, err = notes.SetTxNote("tx-id", strings.Repeat("x", 1025))
	require.Error(t, err)
}

func TestMergeLegacy(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)
	_, err = notes.SetTxNote("tx-id-1", "note for tx-id-1")
	require.NoError(t, err)
	_, err = notes.SetTxNote("tx-id-2", "note for tx-id-2")
	require.NoError(t, err)

	legacyNotes, err := LoadNotes(test.TstTempFile("legacy-notes"))
	require.NoError(t, err)
	_, err = legacyNotes.SetTxNote("tx-id-1", "legacy note for tx-id-1")
	require.NoError(t, err)
	_, err = legacyNotes.SetTxNote("tx-id-3", "legacy note for tx-id-3")
	require.NoError(t, err)

	require.NoError(t, notes.MergeLegacy(legacyNotes))
	entries := notes.TransactionNoteEntries()
	require.Equal(t,
		map[string]string{
			"tx-id-1": "note for tx-id-1",
			"tx-id-2": "note for tx-id-2",
			"tx-id-3": "legacy note for tx-id-3",
		},
		transactionNoteStrings(entries))
	require.Contains(t, entries, "tx-id-3")
	require.False(t, entries["tx-id-3"].Metadata.ModifiedAt.IsZero())

	// Check that the merged notes were persisted.
	notes, err = LoadNotes(filename)
	require.NoError(t, err)
	entries = notes.TransactionNoteEntries()
	require.Equal(t,
		map[string]string{
			"tx-id-1": "note for tx-id-1",
			"tx-id-2": "note for tx-id-2",
			"tx-id-3": "legacy note for tx-id-3",
		},
		transactionNoteStrings(entries))
	require.Contains(t, entries, "tx-id-3")
	require.False(t, entries["tx-id-3"].Metadata.ModifiedAt.IsZero())
}

func TestMergeLegacyLeavesUnknownModifiedAtUnset(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	legacyFilename := test.TstTempFile("legacy-notes")
	require.NoError(t, os.WriteFile(legacyFilename, []byte(`{
  "transactions": {
    "tx-id": "legacy note"
  }
}`), 0600))
	legacyNotes, err := LoadNotes(legacyFilename)
	require.NoError(t, err)

	require.NoError(t, notes.MergeLegacy(legacyNotes))

	entry := notes.TransactionNoteEntries()["tx-id"]
	require.Equal(t, "legacy note", entry.Note)
	require.True(t, entry.Metadata.ModifiedAt.IsZero())
}

func TestLoadLegacyNotesWithoutModifiedAt(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	require.NoError(t, os.WriteFile(filename, []byte(`{
  "transactions": {
    "tx-id": "legacy note"
  }
}`), 0600))

	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	require.Equal(t, "legacy note", notes.TxNote("tx-id"))
	require.True(t, notes.TransactionNoteEntries()["tx-id"].Metadata.ModifiedAt.IsZero())
}

func TestLoadNotesWithTransactionsMetadata(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	require.NoError(t, os.WriteFile(filename, []byte(`{
  "transactions": {
    "tx-id": "note"
  },
  "transactionsMetadata": {
    "tx-id": {
      "modifiedAt": "2026-05-11T10:24:00Z"
    }
  }
}`), 0600))

	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	entry := notes.TransactionNoteEntries()["tx-id"]
	require.Equal(t, "note", entry.Note)
	require.True(t, time.Date(2026, 5, 11, 10, 24, 0, 0, time.UTC).Equal(entry.Metadata.ModifiedAt))
}

func TestUpdateTransactionNoteEntries(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)
	modifiedAt := time.Date(2026, 5, 11, 10, 24, 0, 0, time.UTC)

	changed, err := notes.UpdateTransactionNoteEntries(func(entries map[string]TransactionNoteEntry) (bool, error) {
		entries["tx-id"] = TransactionNoteEntry{
			Note: "synced note",
			Metadata: TransactionMetadata{
				ModifiedAt: modifiedAt,
			},
		}
		return true, nil
	})
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "synced note", notes.TxNote("tx-id"))
	require.True(t, modifiedAt.Equal(notes.TransactionNoteEntries()["tx-id"].Metadata.ModifiedAt))
}
