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

	require.NoError(t, notes.SetTxNote("tx-id-1", "note for tx-id-1"))
	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "", notes.TxNote("tx-id-2"))

	require.NoError(t, notes.SetTxNote("tx-id-2", "note for tx-id-2"))
	require.Equal(t, "note for tx-id-1", notes.TxNote("tx-id-1"))
	require.Equal(t, "note for tx-id-2", notes.TxNote("tx-id-2"))
}

// TestNotesPersisted checks that notes are persisted.
func TestNotesPersisted(t *testing.T) {
	filename := test.TstTempFile("account-notes")
	notes, err := LoadNotes(filename)
	require.NoError(t, err)

	require.NoError(t, notes.SetTxNote("some-tx-id", "note for some-tx-id"))

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
	require.NoError(t, notes.SetTxNote("tx-id", strings.Repeat("x", 1024)))
	require.Error(t, notes.SetTxNote("tx-id", strings.Repeat("x", 1025)))
}
