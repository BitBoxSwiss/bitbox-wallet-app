// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"fmt"
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
)

// SwapDestinationAccount contains the backend-native data needed to serialize swap destinations.
type SwapDestinationAccount struct {
	Keystore          config.Keystore
	AccountConfig     *config.Account
	AccountCoin       coinpkg.Coin
	ActiveTokenCodes  []string
	KeystoreConnected bool
	LoadedAccount     accounts.Interface
	ParentAccountCode *accountsTypes.Code
}

// SwapDestinationAccounts returns the accounts that can be selected as swap destinations.
func (backend *Backend) SwapDestinationAccounts() []*SwapDestinationAccount {
	persistedAccounts := backend.config.AccountsConfig()
	loadedAccounts := backend.loadedAccountsByCode()
	connectedRootFingerprint := backend.connectedRootFingerprint()

	swapAccounts := []*SwapDestinationAccount{}
	for _, persistedAccount := range persistedAccounts.Accounts {
		if !backend.shouldIncludeSwapDestinationAccount(persistedAccount) {
			continue
		}

		keystore, keystoreConnected, ok := backend.swapDestinationKeystore(
			persistedAccounts,
			persistedAccount,
			connectedRootFingerprint,
		)
		if !ok {
			continue
		}

		accountCoin, err := backend.Coin(persistedAccount.CoinCode)
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not find coin")
			continue
		}

		swapAccounts = append(swapAccounts, &SwapDestinationAccount{
			Keystore:          *keystore,
			AccountConfig:     persistedAccount,
			AccountCoin:       accountCoin,
			ActiveTokenCodes:  activeTokenCodesForAccount(persistedAccount),
			KeystoreConnected: keystoreConnected,
			LoadedAccount:     loadedAccounts[persistedAccount.Code],
		})

		if persistedAccount.CoinCode != coinpkg.CodeETH {
			continue
		}
		swapAccounts = backend.appendERC20SwapDestinationAccounts(
			swapAccounts,
			*keystore,
			persistedAccount,
			keystoreConnected,
			loadedAccounts,
		)
	}

	return swapAccounts
}

func (backend *Backend) loadedAccountsByCode() map[accountsTypes.Code]accounts.Interface {
	loadedAccounts := map[accountsTypes.Code]accounts.Interface{}
	for _, account := range backend.Accounts() {
		if account.Config().Config.HiddenBecauseUnused {
			continue
		}
		loadedAccounts[account.Config().Config.Code] = account
	}
	return loadedAccounts
}

func (backend *Backend) connectedRootFingerprint() []byte {
	if backend.keystore == nil {
		return nil
	}
	rootFingerprint, err := backend.keystore.RootFingerprint()
	if err != nil {
		backend.log.WithError(err).Error("Could not retrieve rootFingerprint")
		return nil
	}
	return rootFingerprint
}

func (backend *Backend) shouldIncludeSwapDestinationAccount(account *config.Account) bool {
	if account.HiddenBecauseUnused {
		return false
	}
	if _, isTestnet := coinpkg.TestnetCoins[account.CoinCode]; isTestnet != backend.Testing() {
		return false
	}
	return true
}

func (backend *Backend) swapDestinationKeystore(
	persistedAccounts config.AccountsConfig,
	persistedAccount *config.Account,
	connectedRootFingerprint []byte,
) (*config.Keystore, bool, bool) {
	rootFingerprint, err := persistedAccount.SigningConfigurations.RootFingerprint()
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).Error("could not identify root fingerprint")
		return nil, false, false
	}
	keystore, err := persistedAccounts.LookupKeystore(rootFingerprint)
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).Error("could not find keystore of account")
		return nil, false, false
	}

	keystoreConnected := bytes.Equal(rootFingerprint, connectedRootFingerprint)
	isWatchonly, err := persistedAccounts.IsAccountWatchOnly(persistedAccount)
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not determine watch-only status")
		return nil, false, false
	}
	if !keystoreConnected && !isWatchonly {
		return nil, false, false
	}
	return keystore, keystoreConnected, true
}

func activeTokenCodesForAccount(account *config.Account) []string {
	if account.CoinCode != coinpkg.CodeETH {
		return nil
	}
	return slices.Clone(account.ActiveTokens)
}

func (backend *Backend) appendERC20SwapDestinationAccounts(
	swapAccounts []*SwapDestinationAccount,
	keystore config.Keystore,
	persistedAccount *config.Account,
	keystoreConnected bool,
	loadedAccounts map[accountsTypes.Code]accounts.Interface,
) []*SwapDestinationAccount {
	for _, token := range ERC20Tokens() {
		tokenCoin, err := backend.Coin(token.Code())
		if err != nil {
			backend.log.WithField("tokenCode", token.Code()).WithError(err).Error("could not find ERC20 coin")
			continue
		}

		tokenAccountCode := Erc20AccountCode(persistedAccount.Code, string(token.Code()))
		tokenName := token.Name()
		accountNumber, err := persistedAccount.SigningConfigurations[0].AccountNumber()
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not get account number")
		} else if accountNumber > 0 {
			tokenName = fmt.Sprintf("%s %d", tokenName, accountNumber+1)
		}

		tokenConfig := &config.Account{
			Inactive:              !slices.Contains(persistedAccount.ActiveTokens, string(token.Code())),
			HiddenBecauseUnused:   persistedAccount.HiddenBecauseUnused,
			CoinCode:              token.Code(),
			Name:                  tokenName,
			Code:                  tokenAccountCode,
			SigningConfigurations: persistedAccount.SigningConfigurations,
		}
		parentCode := persistedAccount.Code
		swapAccounts = append(swapAccounts, &SwapDestinationAccount{
			Keystore:          keystore,
			AccountConfig:     tokenConfig,
			AccountCoin:       tokenCoin,
			KeystoreConnected: keystoreConnected,
			LoadedAccount:     loadedAccounts[tokenAccountCode],
			ParentAccountCode: &parentCode,
		})
	}
	return swapAccounts
}
