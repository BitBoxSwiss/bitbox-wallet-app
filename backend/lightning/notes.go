// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"fmt"
	"path/filepath"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/notes"
	utilconfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// Notes returns local payment notes for the configured wallet, even if the SDK is offline.
// Notes are kept separately from the SDK data so recovering the wallet does not overwrite them.
func (lightning *Lightning) Notes() (*notes.Notes, error) {
	lightning.notesLock.Lock()
	defer lightning.notesLock.Unlock()

	account := lightning.Account()
	if account == nil {
		return nil, errp.New("No Lightning account configured")
	}
	if lightning.notes != nil && lightning.notesAccountCode == account.Code {
		return lightning.notes, nil
	}
	if err := utilconfig.EnsurePrivateDir(lightning.lightningDirectoryPath); err != nil {
		return nil, err
	}
	filename := filepath.Join(lightning.lightningDirectoryPath, fmt.Sprintf("notes-%s.json", account.Code))
	accountNotes, err := notes.LoadNotes(filename)
	if err != nil {
		return nil, err
	}
	lightning.notes = accountNotes
	lightning.notesAccountCode = account.Code
	return accountNotes, nil
}

// SetTxNote stores a local payment note and refreshes the payment list if it changed.
func (lightning *Lightning) SetTxNote(paymentID, note string) (bool, error) {
	if paymentID == "" {
		return false, errp.New("Missing Lightning payment ID")
	}
	accountNotes, err := lightning.Notes()
	if err != nil {
		return false, err
	}
	changed, err := accountNotes.SetTxNote(paymentID, note)
	if err != nil {
		return false, err
	}
	if changed {
		lightning.notifyListPaymentsReload()
	}
	return changed, nil
}
