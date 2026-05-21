// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
)

// LightningTopUpInfo contains the source account choices needed by the Lightning top-up screen.
type LightningTopUpInfo struct {
	// SourceAccounts are active, loaded BTC accounts that can fund a top-up.
	SourceAccounts           []LightningTopUpSourceAccount
	DefaultSourceAccountCode *accountsTypes.Code
	// AccountToConnectRootFingerprint is set when a matching BTC account exists in the config,
	// but is not loaded because its BitBox is not connected.
	AccountToConnectRootFingerprint []byte
}

// LightningTopUpSourceAccount contains the base account data needed by the frontend account selector.
type LightningTopUpSourceAccount struct {
	Keystore          config.Keystore
	KeystoreConnected bool
	AccountConfig     *config.Account
	AccountCoin       coinpkg.Coin
}

// LightningTopUpInfo returns active BTC accounts that can source a Lightning top-up.
func (backend *Backend) LightningTopUpInfo() (LightningTopUpInfo, error) {
	sourceAccounts, err := backend.lightningTopUpSourceAccounts()
	if err != nil {
		return LightningTopUpInfo{}, err
	}

	lightningAccount := backend.lightning.Account()
	result := LightningTopUpInfo{
		SourceAccounts:           sourceAccounts,
		DefaultSourceAccountCode: lightningTopUpDefaultSourceAccount(sourceAccounts, lightningAccount),
	}

	if len(sourceAccounts) == 0 && backend.Keystore() == nil && lightningAccount != nil &&
		backend.hasConfiguredLightningTopUpSourceAccount(lightningAccount.RootFingerprint) {
		// Let the frontend open the shared connect prompt immediately. If no matching
		// configured BTC account exists, the user needs account management instead.
		result.AccountToConnectRootFingerprint = append([]byte(nil), lightningAccount.RootFingerprint...)
	}

	return result, nil
}

func (backend *Backend) lightningTopUpSourceAccounts() ([]LightningTopUpSourceAccount, error) {
	connectedKeystore, err := backend.connectedKeystoreConfig()
	if err != nil {
		return nil, err
	}

	persistedAccounts := backend.config.AccountsConfig()
	sourceAccounts := []LightningTopUpSourceAccount{}
	for _, account := range backend.Accounts() {
		// Use loaded accounts for the actual selector. Disconnected non-watch accounts are not
		// loaded, while inactive accounts should stay unavailable until enabled by the user.
		accountConfig := account.Config().Config
		if !isLightningTopUpSourceAccount(accountConfig) {
			continue
		}

		rootFingerprint, err := accountConfig.SigningConfigurations.RootFingerprint()
		if err != nil {
			backend.log.WithField("code", accountConfig.Code).Error("could not identify root fingerprint")
			continue
		}
		keystore, err := persistedAccounts.LookupKeystore(rootFingerprint)
		if err != nil {
			backend.log.WithField("code", accountConfig.Code).Error("could not find keystore of account")
			continue
		}

		keystoreConnected := connectedKeystore != nil &&
			bytes.Equal(rootFingerprint, connectedKeystore.RootFingerprint)
		sourceAccounts = append(sourceAccounts, LightningTopUpSourceAccount{
			Keystore:          *keystore,
			KeystoreConnected: keystoreConnected,
			AccountConfig:     accountConfig,
			AccountCoin:       account.Coin(),
		})
	}
	return sourceAccounts, nil
}

func isLightningTopUpSourceAccount(account *config.Account) bool {
	// Top-up is a regular on-chain BTC send to the Lightning boarding address.
	// Inactive accounts are omitted so the UI can direct users to Manage accounts.
	return account.CoinCode == coinpkg.CodeBTC &&
		!account.HiddenBecauseUnused &&
		!account.Inactive
}

func lightningTopUpDefaultSourceAccount(
	sourceAccounts []LightningTopUpSourceAccount,
	lightningAccount *config.LightningAccountConfig,
) *accountsTypes.Code {
	if len(sourceAccounts) == 0 {
		return nil
	}
	if lightningAccount != nil {
		// Prefer the BTC account from the BitBox that created the Lightning account.
		for _, account := range sourceAccounts {
			rootFingerprint, err := account.AccountConfig.SigningConfigurations.RootFingerprint()
			if err != nil {
				continue
			}
			if bytes.Equal(rootFingerprint, lightningAccount.RootFingerprint) {
				code := account.AccountConfig.Code
				return &code
			}
		}
	}
	code := sourceAccounts[0].AccountConfig.Code
	return &code
}

func (backend *Backend) hasConfiguredLightningTopUpSourceAccount(rootFingerprint []byte) bool {
	// This checks persisted config, not loaded accounts, so an unplugged BitBox can still
	// produce a connect prompt when it has an active BTC account configured.
	for _, account := range backend.config.AccountsConfig().Accounts {
		if !isLightningTopUpSourceAccount(account) {
			continue
		}
		if account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
			return true
		}
	}
	return false
}
