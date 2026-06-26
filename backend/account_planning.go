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
	keystore keystore.Keystore,
	accountsConfig *config.AccountsConfig,
) (*config.Account, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return nil, err
	}
	return lowestHiddenAccount(accountCandidates(accountsConfig, rootFingerprint, coinCode)), nil
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
