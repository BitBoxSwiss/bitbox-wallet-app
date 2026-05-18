// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestCoinPolicyCoinEnabled(t *testing.T) {
	tests := []struct {
		name    string
		policy  coinPolicy
		enabled []coinpkg.Code
	}{
		{
			name:    "mainnet",
			policy:  coinPolicy{testing: false, regtest: false},
			enabled: []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH},
		},
		{
			name:    "testnet",
			policy:  coinPolicy{testing: true, regtest: false},
			enabled: []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeSEPETH},
		},
		{
			name:    "regtest",
			policy:  coinPolicy{testing: true, regtest: true},
			enabled: []coinpkg.Code{coinpkg.CodeRBTC},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enabled := map[coinpkg.Code]bool{}
			for _, coinCode := range tt.enabled {
				enabled[coinCode] = true
			}
			for _, coinCode := range []coinpkg.Code{
				coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC,
				coinpkg.CodeLTC, coinpkg.CodeTLTC,
				coinpkg.CodeETH, coinpkg.CodeSEPETH,
			} {
				require.Equal(t, enabled[coinCode], tt.policy.coinEnabled(coinCode), coinCode)
			}
		})
	}
}

func TestCoinPolicySupportedCoins(t *testing.T) {
	tests := []struct {
		name     string
		policy   coinPolicy
		expected []coinpkg.Code
	}{
		{
			name:     "mainnet",
			policy:   coinPolicy{testing: false, regtest: false},
			expected: []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH},
		},
		{
			name:     "testnet",
			policy:   coinPolicy{testing: true, regtest: false},
			expected: []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeSEPETH},
		},
		{
			name:     "regtest",
			policy:   coinPolicy{testing: true, regtest: true},
			expected: []coinpkg.Code{coinpkg.CodeRBTC},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, tt.policy.supportedCoins())
		})
	}
}

func TestCoinPolicyDiscoveryCoins(t *testing.T) {
	tests := []struct {
		name     string
		policy   coinPolicy
		expected []coinpkg.Code
	}{
		{
			name:     "mainnet",
			policy:   coinPolicy{testing: false, regtest: false},
			expected: []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC},
		},
		{
			name:     "testnet",
			policy:   coinPolicy{testing: true, regtest: false},
			expected: []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC},
		},
		{
			name:     "regtest",
			policy:   coinPolicy{testing: true, regtest: true},
			expected: []coinpkg.Code{coinpkg.CodeRBTC},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, tt.policy.discoveryCoins())
		})
	}
}
