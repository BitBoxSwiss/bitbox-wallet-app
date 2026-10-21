// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestContacts(t *testing.T) {
	dir := t.TempDir()
	store := NewContacts(dir)
	list, err := store.List("")
	require.NoError(t, err)
	require.Empty(t, list.Contacts)
	require.Nil(t, list.MatchingContactID)

	contact, err := store.Save(Contact{Name: "  Nora  ", Address: " Nora@EXAMPLE.COM "})
	require.NoError(t, err)
	_, err = uuid.Parse(contact.ID)
	require.NoError(t, err)
	require.Equal(t, "Nora", contact.Name)
	require.Equal(t, "Nora@example.com", contact.Address)
	_, err = store.Save(Contact{Address: "nora@example.com"})
	require.ErrorIs(t, err, ErrContactDuplicate)

	unnamed, err := store.Save(Contact{Address: "alice@example.com"})
	require.NoError(t, err)
	list, err = NewContacts(dir).List(" NORA@example.com ")
	require.NoError(t, err)
	require.Equal(t, []Contact{*unnamed, *contact}, list.Contacts)
	require.Equal(t, &contact.ID, list.MatchingContactID)

	contact.Name = "Alex"
	contact.Address = "alex@example.com"
	updated, err := store.Save(*contact)
	require.NoError(t, err)
	require.Equal(t, contact, updated)
	contact.Address = unnamed.Address
	_, err = store.Save(*contact)
	require.ErrorIs(t, err, ErrContactDuplicate)
	list, err = store.List("alex@example.com")
	require.NoError(t, err)
	require.Equal(t, updated.ID, *list.MatchingContactID)

	require.NoError(t, store.Delete(updated.ID))
	require.ErrorIs(t, store.Delete(updated.ID), ErrContactNotFound)
	_, err = store.Save(Contact{ID: updated.ID, Address: "other@example.com"})
	require.ErrorIs(t, err, ErrContactNotFound)
	list, err = NewContacts(dir).List("alex@example.com")
	require.NoError(t, err)
	require.Nil(t, list.MatchingContactID)
	require.Equal(t, []Contact{*unnamed}, list.Contacts)

	filename := filepath.Join(dir, "lightning-contacts.json")
	require.NoError(t, os.Chmod(filename, 0644))
	_, err = store.Save(*unnamed)
	require.NoError(t, err)
	info, err := os.Stat(filename)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())
}

func TestContactsWithoutActiveWallet(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.Nil(t, lightning.Account())
	require.Nil(t, lightning.sdkService)
	require.Equal(t, SDKStatusInactive, lightning.SDKStatus())
	store := lightning.Contacts()
	contact, err := store.Save(Contact{Address: "nora@example.com"})
	require.NoError(t, err)
	contact.Name = "Nora"
	_, err = store.Save(*contact)
	require.NoError(t, err)
	list, err := store.List(contact.Address)
	require.NoError(t, err)
	require.Equal(t, []Contact{*contact}, list.Contacts)
	require.NoError(t, store.Delete(contact.ID))
	require.Nil(t, lightning.sdkService)
	require.Equal(t, SDKStatusInactive, lightning.SDKStatus())
}

// TestContactAddressValidation rejects malformed addresses and single-label domains while allowing tags.
func TestContactAddressValidation(t *testing.T) {
	store := NewContacts(t.TempDir())
	for _, address := range []string{"", "nora", "t@t", "@example.com", "nora@", "Nora <nora@example.com>", "lightning:nora@example.com", "nora @example.com", "lnbc1invoice", "https://example.com", "nora@example.com\nother@example.com"} {
		t.Run(address, func(t *testing.T) {
			_, err := store.Save(Contact{Address: address})
			require.ErrorIs(t, err, ErrContactInvalidAddress)
		})
	}
	_, err := store.Save(Contact{Address: "nora.smith+wallet@example.com"})
	require.NoError(t, err)
}

func TestContactsOptionalAndDuplicateNames(t *testing.T) {
	store := NewContacts(t.TempDir())
	first, err := store.Save(Contact{Name: "Same name", Address: "nora@example.com"})
	require.NoError(t, err)
	second, err := store.Save(Contact{Name: first.Name, Address: "alice@example.com"})
	require.NoError(t, err)
	require.NotEqual(t, first.ID, second.ID)

	first.Name = "  "
	first.Address = "NORA@EXAMPLE.COM"
	updated, err := store.Save(*first)
	require.NoError(t, err)
	require.Equal(t, first.ID, updated.ID)
	require.Empty(t, updated.Name)
	require.Equal(t, "NORA@example.com", updated.Address)
	list, err := store.List("nora@example.com")
	require.NoError(t, err)
	require.Equal(t, &first.ID, list.MatchingContactID)
}

type contactsFileWithWriteError struct {
	contactsFile
	err error
}

func (file contactsFileWithWriteError) WriteJSON(interface{}) error {
	return file.err
}

func TestContactsWriteFailurePreservesData(t *testing.T) {
	dir := t.TempDir()
	store := NewContacts(dir)
	contact, err := store.Save(Contact{Address: "nora@example.com"})
	require.NoError(t, err)
	filename := filepath.Join(dir, "lightning-contacts.json")
	original, err := os.ReadFile(filename)
	require.NoError(t, err)
	writeError := errors.New("contact write failed")
	store.file = contactsFileWithWriteError{contactsFile: store.file, err: writeError}

	_, err = store.Save(Contact{Address: "alice@example.com"})
	require.ErrorIs(t, err, writeError)
	contact.Name = "Edited"
	_, err = store.Save(*contact)
	require.ErrorIs(t, err, writeError)
	require.ErrorIs(t, store.Delete(contact.ID), writeError)
	data, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Equal(t, original, data)
}

func TestContactsFileErrors(t *testing.T) {
	dir := t.TempDir()
	filename := filepath.Join(dir, "lightning-contacts.json")
	require.NoError(t, os.WriteFile(filename, []byte("broken json"), 0600))
	store := NewContacts(dir)
	_, err := store.List("")
	require.Error(t, err)
	_, err = store.Save(Contact{Address: "nora@example.com"})
	require.Error(t, err)
	require.Error(t, store.Delete("missing"))
	data, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Equal(t, "broken json", string(data))

	// A regular file cannot serve as the contact store directory.
	_, err = NewContacts(filename).Save(Contact{Address: "nora@example.com"})
	require.Error(t, err)
}

func TestContactsConcurrentDuplicate(t *testing.T) {
	store := NewContacts(t.TempDir())
	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := store.Save(Contact{Address: "nora@example.com"})
			if err != nil {
				require.ErrorIs(t, err, ErrContactDuplicate)
			}
		}()
	}
	wg.Wait()
	list, err := store.List("")
	require.NoError(t, err)
	require.Len(t, list.Contacts, 1)
}
