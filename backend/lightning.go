// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// coinCodeLightning is a portfolio-only pseudo coin code. Use BTC for formatting and conversions;
// backend.Coin(coinCodeLightning) does not resolve.
const coinCodeLightning coinpkg.Code = "lightning"

func (backend *Backend) hasLightningAccount() bool {
	return backend.lightning != nil && backend.lightning.Account() != nil
}

func (backend *Backend) lightningFormattedBalance() (*coinFormattedAmount, error) {
	if backend.lightning.Account() == nil {
		return nil, nil
	}
	lightningBalance, err := backend.lightning.Balance()
	if err != nil {
		return nil, err
	}
	btcCoin, err := backend.Coin(coinpkg.CodeBTC)
	if err != nil {
		return nil, err
	}
	formattedBalance := backend.formattedCoinBalance(
		coinCodeLightning,
		"Lightning",
		btcCoin,
		lightningBalance.Available().BigInt(),
	)
	return &formattedBalance, nil
}

// DefaultLightningTopUpAccountCode returns the first funded or still-syncing Bitcoin account of
// the connected keystore. If none is available, it returns the first eligible account of any
// keystore.
func (backend *Backend) DefaultLightningTopUpAccountCode() *accountsTypes.Code {
	connectedKeystore := backend.Keystore()
	var connectedRootFingerprint []byte
	if connectedKeystore != nil {
		var err error
		connectedRootFingerprint, err = connectedKeystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("could not identify connected keystore")
		}
	}

	var firstEligibleAccountCode *accountsTypes.Code
	for _, account := range backend.Accounts() {
		accountConfig := account.Config().Config
		if accountConfig.Inactive || accountConfig.HiddenBecauseUnused || account.Coin().Code() != coinpkg.CodeBTC {
			continue
		}
		balance, err := account.Balance()
		if err != nil {
			if errp.Cause(err) != accounts.ErrSyncInProgress {
				backend.log.WithField("code", accountConfig.Code).WithError(err).Error("could not get account balance")
				continue
			}
		} else if balance == nil || balance.Available().BigInt().Sign() <= 0 {
			continue
		}

		accountCode := accountConfig.Code
		if firstEligibleAccountCode == nil {
			firstEligibleAccountCode = &accountCode
		}
		rootFingerprint, err := accountConfig.SigningConfigurations.RootFingerprint()
		if err != nil {
			backend.log.WithField("code", accountConfig.Code).WithError(err).Error("could not identify root fingerprint")
			continue
		}
		if connectedRootFingerprint != nil && bytes.Equal(rootFingerprint, connectedRootFingerprint) {
			return &accountCode
		}
	}
	return firstEligibleAccountCode
}

func insertLightningFormattedBalance(
	balances []coinFormattedAmount,
	lightningBalance *coinFormattedAmount,
) []coinFormattedAmount {
	if lightningBalance == nil {
		return balances
	}
	for index, balance := range balances {
		if balance.CoinCode == coinpkg.CodeBTC {
			result := make([]coinFormattedAmount, 0, len(balances)+1)
			result = append(result, balances[:index+1]...)
			result = append(result, *lightningBalance)
			result = append(result, balances[index+1:]...)
			return result
		}
	}
	return append([]coinFormattedAmount{*lightningBalance}, balances...)
}
