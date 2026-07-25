// SPDX-License-Identifier: Apache-2.0

package backend

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"

// accountsDB is the persistence boundary for account and keystore records.
//
// Snapshot returns one coherent, caller-owned view of all records. Update serializes and persists
// record mutations.
type accountsDB interface {
	Snapshot() (config.AccountsConfig, error)
	Update(func(*config.AccountsConfig) error) error
}

// configAccountsDB keeps accounts.json behind the accounts database boundary until it is replaced
// by structured storage.
type configAccountsDB struct {
	config *config.Config
}

func (db configAccountsDB) Snapshot() (config.AccountsConfig, error) {
	return db.config.AccountsSnapshot(), nil
}

func (db configAccountsDB) Update(
	update func(*config.AccountsConfig) error,
) error {
	return db.config.ModifyAccountsConfig(update)
}
