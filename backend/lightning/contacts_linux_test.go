// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContactsPartialWritePreservesData(t *testing.T) {
	// Isolate the process-wide file size limit from other tests.
	if dir := os.Getenv("BITBOX_TEST_CONTACTS_WRITE_DIR"); dir != "" {
		signal.Ignore(syscall.SIGXFSZ)
		require.NoError(t, syscall.Setrlimit(syscall.RLIMIT_FSIZE, &syscall.Rlimit{Cur: 32, Max: 32}))
		store := NewContacts(dir)
		list, err := store.List("")
		require.NoError(t, err)
		require.Len(t, list.Contacts, 2)
		_, err = store.Save(Contact{Address: "bob@example.com"})
		require.ErrorIs(t, err, syscall.EFBIG)
		updated := list.Contacts[0]
		updated.Name = "Edited"
		_, err = store.Save(updated)
		require.ErrorIs(t, err, syscall.EFBIG)
		require.ErrorIs(t, store.Delete(updated.ID), syscall.EFBIG)
		persisted, err := NewContacts(dir).List("")
		require.NoError(t, err)
		require.Equal(t, list, persisted)
		return
	}

	dir := t.TempDir()
	store := NewContacts(dir)
	for _, address := range []string{"nora@example.com", "alice@example.com"} {
		_, err := store.Save(Contact{Address: address})
		require.NoError(t, err)
	}
	filename := filepath.Join(dir, "lightning-contacts.json")
	original, err := os.ReadFile(filename)
	require.NoError(t, err)
	cmd := exec.Command(os.Args[0], "-test.run=^TestContactsPartialWritePreservesData$")
	cmd.Env = append(os.Environ(), "BITBOX_TEST_CONTACTS_WRITE_DIR="+dir)
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, "%s", output)
	data, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Equal(t, original, data)
	files, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.Len(t, files, 1)
	require.Equal(t, "lightning-contacts.json", files[0].Name())
}
