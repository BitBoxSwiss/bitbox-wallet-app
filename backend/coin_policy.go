// SPDX-License-Identifier: Apache-2.0

package backend

import coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"

// coinPolicy centralizes which coins belong to the active network mode.
type coinPolicy struct {
	testing bool
	regtest bool
}

// coinEnabled returns true if accounts for the coin should be visible in this network mode.
func (policy coinPolicy) coinEnabled(coinCode coinpkg.Code) bool {
	isRegtestCoin := coinCode == coinpkg.CodeRBTC
	if policy.regtest {
		// In regtest mode, load regtest accounts only.
		return isRegtestCoin
	}
	if isRegtestCoin {
		// Don't load regtest accounts when running normally or in testnet mode.
		return false
	}

	_, isTestnetCoin := coinpkg.TestnetCoins[coinCode]
	if policy.testing {
		// Don't load mainnet accounts when running in testnet mode.
		return isTestnetCoin
	}
	// Don't load testnet accounts when running normally.
	return !isTestnetCoin
}

// enabledCoinCodes filters the given coin codes to those enabled in this network mode.
func (policy coinPolicy) enabledCoinCodes(coinCodes []coinpkg.Code) []coinpkg.Code {
	var enabled []coinpkg.Code
	for _, coinCode := range coinCodes {
		if policy.coinEnabled(coinCode) {
			enabled = append(enabled, coinCode)
		}
	}
	return enabled
}

// supportedCoins returns the coins that can be used for accounts in this network mode.
func (policy coinPolicy) supportedCoins() []coinpkg.Code {
	accountCoins := []coinpkg.Code{
		coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC,
		coinpkg.CodeLTC, coinpkg.CodeTLTC,
		coinpkg.CodeETH, coinpkg.CodeSEPETH,
	}
	return policy.enabledCoinCodes(accountCoins)
}

// discoveryCoins returns the coins for which hidden account discovery is enabled.
func (policy coinPolicy) discoveryCoins() []coinpkg.Code {
	discoveryCoins := []coinpkg.Code{
		coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC,
		coinpkg.CodeLTC, coinpkg.CodeTLTC,
	}
	return policy.enabledCoinCodes(discoveryCoins)
}
