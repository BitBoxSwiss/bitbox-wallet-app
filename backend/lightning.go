// SPDX-License-Identifier: Apache-2.0

package backend

import coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"

// coinCodeLightning is a portfolio-only pseudo coin code. Use BTC for formatting and conversions;
// backend.Coin(coinCodeLightning) does not resolve.
const coinCodeLightning coinpkg.Code = "lightning"

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
