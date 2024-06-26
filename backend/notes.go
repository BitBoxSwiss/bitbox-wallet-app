// Copyright 2024 Shift Crypto AG
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

package backend

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/notes"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	utilcfg "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// We extend the BIP-329 JSON entry with this data so the BitBoxApp can more easily identify which
// account the label belongs to. The origin field in the BIP is not a perfect fit for us because:
//
//   - We support other coins than Bitcoin (like Ethereum) which do not have BIP-380 descriptors to
//     identify accounts.
//   - In Bitcoin we use unified accounts, which also do not have a BIP-380 descriptor.
//     We could still try to identify which actual descriptor fits the transaction, but that is some
//     effort and has some gnarly edge cases like a transaction paying to multiple descriptors of one
//     unified account at once. We could add support for this anyway if needed.
type bip329BitBoxApp struct {
	CoinCode    coinpkg.Code       `json:"coinCode"`
	AccountCode accountsTypes.Code `json:"code"`
}

type bip329Type string

const (
	bip329TypeTx   bip329Type = "tx"
	bip329TypeXpub bip329Type = "xpub"
)

// https://github.com/bitcoin/bips/blob/master/bip-0329.mediawiki#specification
// Extended with a proprietary field "bitboxapp".
type bip329Entry struct {
	Type  bip329Type `json:"type"`
	Ref   string     `json:"ref"`
	Label string     `json:"label,omitempty"`

	// We don't use the origin field currently, see the docstring of `bip329BitBoxApp` above for the
	// reason why.
	// Origin string `json:"origin,omitempty"`

	BitBoxApp *bip329BitBoxApp `json:"bitboxapp,omitempty"`
}

func (backend *Backend) exportNotes(writer io.Writer) error {
	accounts := backend.Accounts()

	backend.log.Infof("Exporting notes of %d accounts", len(accounts))

	for _, account := range accounts {
		if account.FatalError() {
			continue
		}
		if account.Config().Config.HiddenBecauseUnused {
			continue
		}
		// We do not skip over inactive accounts - we want to export/import them so the user does
		// not accidentally miss any notes.

		if err := account.Initialize(); err != nil {
			return err
		}
		backend.log.WithField("code", account.Config().Config.Code).Info("Exporting name and notes of account")

		accountName := account.Config().Config.Name
		accountCode := account.Config().Config.Code

		// We have unified accounts, but to be compatible with BIP-329, we export the same account
		// name for each xpub in the unified account, so other wallets that import one of the
		// sub-accounts will import the name.
		//
		// We don't export the name for ERC20 tokens, they are not "real" accounts (they are derived
		// from the ETH account), and the user cannot modify the ERC20 token account name.
		ethCoin, isETHCoin := account.Coin().(*eth.Coin)
		isERC20 := isETHCoin && ethCoin.ERC20Token() != nil
		if accountName != "" && !isERC20 {
			for _, signingConfig := range account.Config().Config.SigningConfigurations {
				entry := bip329Entry{
					Type:  bip329TypeXpub,
					Ref:   signingConfig.ExtendedPublicKey().String(),
					Label: accountName,
					// We don't technically need this for the import, as we assume no two accounts
					// in the BitBoxApp contain the same xpub. Note that ERC20-token accounts have
					// the same xpub as the parent ETH account, but they are auto-derived and do not
					// exist in the persisted config where the account name is stored.
					//
					// We add it anyway just in case, as it can't hurt and is more explicit.
					BitBoxApp: &bip329BitBoxApp{
						CoinCode:    account.Config().Config.CoinCode,
						AccountCode: account.Config().Config.Code,
					},
				}
				if err := json.NewEncoder(writer).Encode(entry); err != nil {
					return err
				}
			}
		}

		notesData := account.Notes().Data()
		for txID, note := range notesData.TransactionNotes {
			entry := bip329Entry{
				Type:  bip329TypeTx,
				Ref:   txID,
				Label: note,
				// We use this to aid the import back into the BitBoxApp, as the same txID can be in
				// multiple accounts with different labels (e.g. and ERC20 token in the ERC20 token
				// account as well as in the parent ETH account), and the origin label is not a good
				// fit (see docstring of `bip329BitBoxApp`).
				BitBoxApp: &bip329BitBoxApp{
					CoinCode:    account.Config().Config.CoinCode,
					AccountCode: accountCode,
				},
			}
			if err := json.NewEncoder(writer).Encode(entry); err != nil {
				return err
			}
		}
	}
	return nil
}

// ExportNotes exports the transactions and accounts labels of all accounts of all
// connected/remembered keystores. Deactivated accounts are included in the export, except for
// deactivated ERC-20 accounts. We export to a file using an extended version of BIP-329:
// https://github.com/bitcoin/bips/blob/master/bip-0329.mediawiki
func (backend *Backend) ExportNotes() error {
	exportsDir, err := utilcfg.ExportsDir()
	if err != nil {
		return err
	}
	name := fmt.Sprintf("%s-notes.txt", time.Now().Format("2006-01-02-at-15-04-05"))
	suggestedPath := filepath.Join(exportsDir, name)
	path := backend.Environment().GetSaveFilename(suggestedPath)
	if path == "" {
		return errp.ErrUserAbort
	}
	err = func() error {
		file, err := os.Create(path)
		if err != nil {
			return err
		}
		defer func() { _ = file.Close() }()

		writer := bufio.NewWriter(file)
		if err := backend.exportNotes(writer); err != nil {
			return err
		}
		return writer.Flush()
	}()
	if err != nil {
		return err
	}

	if runtime.GOOS == "android" || runtime.GOOS == "ios" {
		if err := backend.environment.SystemOpen(path); err != nil {
			return err
		}
	}
	return nil
}

// ImportNotesResult contains stats from the notes import.
type ImportNotesResult struct {
	// AccountCount is the number of account name's updated.
	AccountCount int `json:"accountCount"`
	// TransactionCount is the number of transaction notes updated.
	TransactionCount int `json:"transactionCount"`
}

// ImportNotes imports notes from a jsonlines document according to BIP-329:
// https://github.com/bitcoin/bips/blob/master/bip-0329.mediawiki
//
// Only accounts of connected/remembered keystores are considered, also deactivated accounts (except
// for deactivated ERC-20 accounts). If a label in the import does not belong to one of them, it is
// ignored.
func (backend *Backend) ImportNotes(jsonLines []byte) (*ImportNotesResult, error) {
	sanityCheck := func() error {
		scanner := bufio.NewScanner(bytes.NewReader(jsonLines))
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}
			var entry bip329Entry
			if err := json.Unmarshal(line, &entry); err != nil {
				return err
			}
		}
		return nil
	}
	if err := sanityCheck(); err != nil {
		return nil, err
	}
	scanner := bufio.NewScanner(bytes.NewReader(jsonLines))

	result := &ImportNotesResult{}

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var entry bip329Entry
		if err := json.Unmarshal(line, &entry); err != nil {
			return nil, err
		}

		label := util.TruncateString(strings.TrimSpace(entry.Label), notes.MaxNoteLen)
		ref := strings.TrimSpace(entry.Ref)
		if label == "" || ref == "" {
			continue
		}

		switch entry.Type {
		case bip329TypeXpub:
			// Import account name / label.
			var accountCode accountsTypes.Code
			if entry.BitBoxApp != nil {
				accountCode = entry.BitBoxApp.AccountCode
			} else {
				acctCode, err := backend.config.AccountsConfig().LookupByXpub(ref)
				if err != nil {
					// Could not find any account for this label, skipping.
					continue
				}
				accountCode = acctCode
			}
			err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
				acct := accountsConfig.Lookup(accountCode)
				if acct == nil {
					// Could not find account using this account code, cannot apply label. Skipping.
					return nil
				}
				if entry.BitBoxApp != nil && entry.BitBoxApp.CoinCode != acct.CoinCode {
					// Wrong coin.
					return nil
				}
				if acct.HiddenBecauseUnused {
					// We don't want to modify accounts that were never automatically or manually
					// added, same as we don't export the name of such accounts during notes export.
					return nil
				}
				if label != acct.Name {
					acct.Name = label
					result.AccountCount += 1
				}
				return nil
			})
			if err != nil {
				return nil, err
			}

		case bip329TypeTx:
			// Import transaction note.
			var account accounts.Interface
			if entry.BitBoxApp != nil {
				account = backend.Accounts().lookup(entry.BitBoxApp.AccountCode)
			} else {
				acct, err := backend.Accounts().lookupByTransactionInternalID(ref)
				if err != nil {
					return nil, err
				}
				account = acct
			}
			if account == nil {
				// Could not find account containing this tx. Skipping.
				continue
			}
			// So `account.Notes()` is ready to use.
			if err := account.Initialize(); err != nil {
				return nil, err
			}

			// It is inefficient to store dump all notes to disk for every imported note, which
			// happens by using SetTxNote(). This could be optimized in the future.
			changed, err := account.Notes().SetTxNote(ref, label)
			if err != nil {
				return nil, err
			}
			if changed {
				result.TransactionCount += 1
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, errp.WithStack(err)
	}

	// Reflect updated account names in frontend.
	backend.emitAccountsStatusChanged()
	return result, nil
}
