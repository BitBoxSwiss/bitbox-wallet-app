// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"net/mail"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode"

	utilconfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/google/uuid"
)

// Contact error codes identify invalid addresses, duplicates and missing contacts.
const (
	ErrContactInvalidAddress errp.ErrorCode = "lightningContactInvalidAddress"
	ErrContactDuplicate      errp.ErrorCode = "lightningContactDuplicate"
	ErrContactNotFound       errp.ErrorCode = "lightningContactNotFound"
)

// Contact is a locally stored Lightning address and optional display name.
type Contact struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
}

// ContactList contains the contacts and the contact matching a requested address.
type ContactList struct {
	Contacts          []Contact `json:"contacts"`
	MatchingContactID *string   `json:"matchingContactID"`
}

// Contacts stores app-wide contacts independently of any Lightning wallet or SDK connection.
type Contacts struct {
	mu   sync.Mutex
	file contactsFile
}

type contactsFile interface {
	ReadJSON(interface{}) error
	WriteJSON(interface{}) error
}

type atomicContactsFile struct {
	*utilconfig.File
}

// WriteJSON replaces the contact file after the complete JSON is flushed and closed.
func (file atomicContactsFile) WriteJSON(object interface{}) error {
	dir := filepath.Dir(file.Path())
	if err := utilconfig.EnsurePrivateDir(dir); err != nil {
		return err
	}
	temp, err := os.CreateTemp(dir, ".lightning-contacts-*.tmp")
	if err != nil {
		return err
	}
	defer func() {
		_ = temp.Close()
		_ = os.Remove(temp.Name())
	}()
	if err := json.NewEncoder(temp).Encode(object); err != nil {
		return err
	}
	if err := temp.Sync(); err != nil {
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(temp.Name(), file.Path())
}

// NewContacts creates a store in the persistent notes directory. Files are loaded on demand.
func NewContacts(notesDirectory string) *Contacts {
	return &Contacts{file: atomicContactsFile{File: utilconfig.NewFile(notesDirectory, "lightning-contacts.json")}}
}

func (contacts *Contacts) read() ([]Contact, error) {
	result := []Contact{}
	if err := contacts.file.ReadJSON(&result); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if result == nil {
		result = []Contact{}
	}
	return result, nil
}

func contactName(contact Contact) string {
	if contact.Name != "" {
		return contact.Name
	}
	return contact.Address
}

// List returns a sorted snapshot and optionally matches an address, ignoring casing.
func (contacts *Contacts) List(address string) (*ContactList, error) {
	contacts.mu.Lock()
	defer contacts.mu.Unlock()
	entries, err := contacts.read()
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool {
		left, right := strings.ToLower(contactName(entries[i])), strings.ToLower(contactName(entries[j]))
		if left == right {
			return entries[i].Address < entries[j].Address
		}
		return left < right
	})
	result := &ContactList{Contacts: entries}
	for _, contact := range entries {
		if strings.EqualFold(contact.Address, strings.TrimSpace(address)) {
			id := contact.ID
			result.MatchingContactID = &id
			break
		}
	}
	return result, nil
}

func normalizeContactAddress(address string) (string, error) {
	address = strings.TrimSpace(address)
	parsed, err := mail.ParseAddress(address)
	if err != nil || parsed.Address != address || strings.ContainsAny(address, "<>\"()[]:;,\\") ||
		strings.ContainsFunc(address, unicode.IsSpace) {
		return "", ErrContactInvalidAddress
	}
	parts := strings.Split(address, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || !strings.Contains(parts[1], ".") {
		return "", ErrContactInvalidAddress
	}
	return parts[0] + "@" + strings.ToLower(parts[1]), nil
}

// Save creates a contact when ID is empty, or updates an existing contact.
func (contacts *Contacts) Save(contact Contact) (*Contact, error) {
	address, err := normalizeContactAddress(contact.Address)
	if err != nil {
		return nil, err
	}
	contact.Address = address
	contact.Name = strings.TrimSpace(contact.Name)
	contacts.mu.Lock()
	defer contacts.mu.Unlock()
	entries, err := contacts.read()
	if err != nil {
		return nil, err
	}
	index := -1
	for i, entry := range entries {
		if contact.ID != "" && entry.ID == contact.ID {
			index = i
		} else if strings.EqualFold(entry.Address, contact.Address) {
			return nil, ErrContactDuplicate
		}
	}
	if contact.ID == "" {
		contact.ID = uuid.NewString()
		entries = append(entries, contact)
	} else {
		if index == -1 {
			return nil, ErrContactNotFound
		}
		entries[index] = contact
	}
	if err := contacts.file.WriteJSON(entries); err != nil {
		return nil, err
	}
	return &contact, nil
}

// Delete removes an existing contact from persistent storage.
func (contacts *Contacts) Delete(id string) error {
	contacts.mu.Lock()
	defer contacts.mu.Unlock()
	entries, err := contacts.read()
	if err != nil {
		return err
	}
	for i, contact := range entries {
		if contact.ID == id {
			return contacts.file.WriteJSON(append(entries[:i], entries[i+1:]...))
		}
	}
	return ErrContactNotFound
}
