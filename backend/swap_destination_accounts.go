// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"slices"
	"sort"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// SwapDestinationAccount contains the backend-native data needed to serialize swap destinations.
type SwapDestinationAccount struct {
	Keystore          config.Keystore
	AccountConfig     *config.Account
	AccountCoin       coinpkg.Coin
	KeystoreConnected bool
	ParentAccountCode *accountsTypes.Code
}

// SwapDestinationAccounts returns the accounts that can be selected as swap destinations.
func (backend *Backend) SwapDestinationAccounts() []*SwapDestinationAccount {
	persistedAccounts := backend.config.AccountsConfig()

	swapAccounts := []*SwapDestinationAccount{}
	for _, persistedAccount := range persistedAccounts.Accounts {
		if !backend.shouldIncludeSwapDestinationAccount(persistedAccount) {
			continue
		}

		keystore, keystoreConnected, ok := backend.swapDestinationKeystore(
			persistedAccounts,
			persistedAccount,
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
			KeystoreConnected: keystoreConnected,
		})

		if persistedAccount.CoinCode != coinpkg.CodeETH {
			continue
		}
		swapAccounts = backend.appendERC20SwapDestinationAccounts(
			swapAccounts,
			*keystore,
			persistedAccount,
			keystoreConnected,
		)
	}

	sort.Slice(swapAccounts, func(i, j int) bool {
		return lessAccountSortOrder(
			swapAccounts[i].AccountCoin,
			swapAccounts[i].AccountConfig,
			swapAccounts[j].AccountCoin,
			swapAccounts[j].AccountConfig,
		)
	})

	return swapAccounts
}

// SignSwap prepares the selected destination before the real swap signing flow is implemented.
func (backend *Backend) SignSwap(buyAccountCode, sellAccountCode accountsTypes.Code, routeID, sellAmount string) error {
	_ = sellAccountCode
	_ = routeID
	_ = sellAmount
	for _, account := range backend.SwapDestinationAccounts() {
		if account.AccountConfig.Code != buyAccountCode {
			continue
		}
		if account.ParentAccountCode != nil {
			return backend.SetTokenActive(*account.ParentAccountCode, string(account.AccountCoin.Code()), true)
		}
		if account.AccountConfig.Inactive {
			return backend.SetAccountActive(account.AccountConfig.Code, true)
		}

		// TODO implement swap sign logic here.
		return nil
	}
	return errp.Newf("Could not find swap destination account %s", buyAccountCode)
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

// swapDestinationKeystore returns the account keystore, whether it is currently connected,
// and whether the account can be offered as a swap destination.
func (backend *Backend) swapDestinationKeystore(
	persistedAccounts config.AccountsConfig,
	persistedAccount *config.Account,
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

	var connectedRootFingerprint []byte
	if backend.keystore != nil {
		connectedRootFingerprint, err = backend.keystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("Could not retrieve rootFingerprint")
			return nil, false, false
		}
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

func (backend *Backend) appendERC20SwapDestinationAccounts(
	swapAccounts []*SwapDestinationAccount,
	keystore config.Keystore,
	persistedAccount *config.Account,
	keystoreConnected bool,
) []*SwapDestinationAccount {
	for _, token := range ERC20Tokens() {
		tokenCoin, err := backend.Coin(token.Code)
		if err != nil {
			backend.log.WithField("tokenCode", token.Code).WithError(err).Error("could not find ERC20 coin")
			continue
		}

		tokenAccountCode := Erc20AccountCode(persistedAccount.Code, string(token.Code))
		tokenName, err := configuredAccountName(tokenCoin, persistedAccount)
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not get account number")
		}

		tokenConfig := &config.Account{
			Inactive:              !slices.Contains(persistedAccount.ActiveTokens, string(token.Code)),
			HiddenBecauseUnused:   persistedAccount.HiddenBecauseUnused,
			CoinCode:              token.Code,
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
			ParentAccountCode: &parentCode,
		})
	}
	return swapAccounts
}
