// SPDX-License-Identifier: Apache-2.0

package backend

import (
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

type accountCandidate struct {
	account *config.Account
	number  uint16
}

// accountCandidates returns persisted accounts for the coin, root fingerprint, and valid account
// numbers. Accounts with malformed signing configurations are ignored.
func accountCandidates(
	accountsConfig *config.AccountsConfig,
	rootFingerprint []byte,
	coinCode coinpkg.Code,
) []accountCandidate {
	var candidates []accountCandidate
	for _, account := range accountsConfig.Accounts {
		if coinCode != account.CoinCode {
			continue
		}
		if !account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
			continue
		}
		accountNumber, err := account.SigningConfigurations.AccountNumber()
		if err != nil {
			continue
		}
		candidates = append(candidates, accountCandidate{
			account: account,
			number:  accountNumber,
		})
	}
	return candidates
}

// findHiddenAccount finds the hidden unused account with the lowest account number.
func findHiddenAccount(
	coinCode coinpkg.Code,
	rootFingerprint []byte,
	accountsConfig *config.AccountsConfig,
) *config.Account {
	return lowestHiddenAccount(accountCandidates(accountsConfig, rootFingerprint, coinCode))
}

func lowestHiddenAccount(candidates []accountCandidate) *config.Account {
	var result *config.Account
	var resultNumber uint16
	for _, candidate := range candidates {
		if !candidate.account.HiddenBecauseUnused {
			continue
		}
		if result == nil || candidate.number < resultNumber {
			result = candidate.account
			resultNumber = candidate.number
		}
	}
	return result
}

// nextAccountNumber checks if an account for the given coin can be added, and if so, returns the
// account number of the new account.
func nextAccountNumber(
	coinCode coinpkg.Code,
	keystore keystore.Keystore,
	accountsConfig *config.AccountsConfig,
) (uint16, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return 0, err
	}
	candidates := accountCandidates(accountsConfig, rootFingerprint, coinCode)
	return nextManualAccountNumber(coinCode, candidates)
}

func nextManualAccountNumber(
	coinCode coinpkg.Code,
	candidates []accountCandidate,
) (uint16, error) {
	nextAccountNumber := nextAccountNumberAfter(candidates)
	if int(nextAccountNumber) >= accountsHardLimit(coinCode) {
		return 0, errp.WithStack(errAccountLimitReached)
	}
	return nextAccountNumber, nil
}

func nextAccountNumberAfter(candidates []accountCandidate) uint16 {
	nextAccountNumber := uint16(0)
	for _, candidate := range candidates {
		if candidate.number+1 > nextAccountNumber {
			nextAccountNumber = candidate.number + 1
		}
	}
	return nextAccountNumber
}

// nextDiscoveryAccountNumber applies the account discovery gap limit.
// See https://github.com/bitcoin/bips/blob/3db736243cd01389a4dfd98738204df1856dc5b9/bip-0044.mediawiki#user-content-Account_discovery.
//
// We deviate from BIP-44 significantly in two ways:
//   - We always scan the first accounts up to accountsHardLimit (six for BTC/LTC), as historically
//     users could add that many accounts even if all of them were empty. These gaps can exist in
//     wallets created before account discovery was introduced in v4.38.
//   - The accounts scan in BIP-44 is per script type (per purpose field in the BIP-44 keypath).
//     Since we support unified accounts, we consider them together. Someone could have many
//     accounts with coins on P2WPKH addresses and none on P2TR addresses, and still receive to
//     P2TR in the highest account. Other BIP44-compatible software would not discover it.
func nextDiscoveryAccountNumber(
	coinCode coinpkg.Code,
	candidates []accountCandidate,
) (uint16, bool) {
	maxAccountNumber := -1
	var maxAccount *config.Account
	for _, candidate := range candidates {
		if maxAccount == nil || int(candidate.number) > maxAccountNumber {
			maxAccountNumber = int(candidate.number)
			maxAccount = candidate.account
		}
	}

	// Account scan gap limit:
	// - Previous account must be used for the next one to be scanned, but:
	// - The first accounts up to the hard limit are always scanned as before we had accounts
	//   discovery, the BitBoxApp allowed manual creation of that many accounts, so we need to scan
	//   these.
	nextAccountNumber := maxAccountNumber + 1
	if maxAccount == nil || maxAccount.Used || nextAccountNumber < accountsHardLimit(coinCode) {
		return uint16(nextAccountNumber), true
	}
	return 0, false
}
