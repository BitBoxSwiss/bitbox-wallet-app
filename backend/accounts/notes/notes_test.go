// SPDX-License-Identifier: Apache-2.0

package notes

import (
	"os"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestNotes(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	require.Equal(t, "", notes.TxNote("tx-id-1"))
	require.Equal(t, "", notes.TxNote("tx-id-2"))

	changed, err := notes.SetTxNote("tx-id-1", "note for tx-id-1")
	require.NoError(t, err)
	require.True(t, changed)

	changed, err = notes.SetTxNote("tx-id-1", "note for tx-id-1")
	require.NoError(t, err)
	require.False(t, changed)

	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "", notes.TxNote("tx-id-2"))

	_, err = notes.SetTxNote("tx-id-2", "note for tx-id-2")
	require.NoError(t, err)
	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "note for tx-id-2", notes.TxNote("tx-id-2"))

	require.Equal(t,
		&Data{
			TransactionNotes: map[string]string{
				"tx-id-1": "note for tx-id-1",
				"tx-id-2": "note for tx-id-2",
			},
		},
		notes.Data())
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
	require.Equal(t,
		&Data{
			TransactionNotes: map[string]string{
				"tx-id-1": "note for tx-id-1",
				"tx-id-2": "note for tx-id-2",
				"tx-id-3": "legacy note for tx-id-3",
			},
		},
		notes.Data())

	// Check that the merged notes were persisted.
	notes, err = LoadNotes(filename)
	require.NoError(t, err)
	require.Equal(t,
		&Data{
			TransactionNotes: map[string]string{
				"tx-id-1": "note for tx-id-1",
				"tx-id-2": "note for tx-id-2",
				"tx-id-3": "legacy note for tx-id-3",
			},
		},
		notes.Data())
}
