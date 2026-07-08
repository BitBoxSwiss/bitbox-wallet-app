// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

type expectedScriptDerivation struct {
	scriptType signing.ScriptType
	keypath    string
}

func TestNewAccountDerivationSpecBitcoinLike(t *testing.T) {
	tests := []struct {
		name     string
		coinCode coinpkg.Code
		expected []expectedScriptDerivation
	}{
		{
			name:     "btc",
			coinCode: coinpkg.CodeBTC,
			expected: []expectedScriptDerivation{
				{signing.ScriptTypeP2WPKH, "m/84'/0'/7'"},
				{signing.ScriptTypeP2TR, "m/86'/0'/7'"},
				{signing.ScriptTypeP2WPKHP2SH, "m/49'/0'/7'"},
				{signing.ScriptTypeP2PKH, "m/44'/0'/7'"},
			},
		},
		{
			name:     "tbtc",
			coinCode: coinpkg.CodeTBTC,
			expected: []expectedScriptDerivation{
				{signing.ScriptTypeP2WPKH, "m/84'/1'/7'"},
				{signing.ScriptTypeP2TR, "m/86'/1'/7'"},
				{signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/7'"},
				{signing.ScriptTypeP2PKH, "m/44'/1'/7'"},
			},
		},
		{
			name:     "rbtc",
			coinCode: coinpkg.CodeRBTC,
			expected: []expectedScriptDerivation{
				{signing.ScriptTypeP2WPKH, "m/84'/1'/7'"},
				{signing.ScriptTypeP2TR, "m/86'/1'/7'"},
				{signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/7'"},
				{signing.ScriptTypeP2PKH, "m/44'/1'/7'"},
			},
		},
		{
			name:     "ltc",
			coinCode: coinpkg.CodeLTC,
			expected: []expectedScriptDerivation{
				{signing.ScriptTypeP2WPKH, "m/84'/2'/7'"},
				{signing.ScriptTypeP2WPKHP2SH, "m/49'/2'/7'"},
			},
		},
		{
			name:     "tltc",
			coinCode: coinpkg.CodeTLTC,
			expected: []expectedScriptDerivation{
				{signing.ScriptTypeP2WPKH, "m/84'/1'/7'"},
				{signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/7'"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			spec, err := newAccountDerivationSpec(test.coinCode, 7)
			require.NoError(t, err)
			require.Equal(t, accountDerivationKindBTC, spec.kind)
			require.Empty(t, spec.ethKeypath)
			requireScriptDerivations(t, test.expected, spec.btcConfigs)
		})
	}
}

func TestNewAccountDerivationSpecEthereum(t *testing.T) {
	tests := []struct {
		name     string
		coinCode coinpkg.Code
		keypath  string
	}{
		{
			name:     "eth",
			coinCode: coinpkg.CodeETH,
			keypath:  "m/44'/60'/0'/0/7",
		},
		{
			name:     "sepeth",
			coinCode: coinpkg.CodeSEPETH,
			keypath:  "m/44'/1'/0'/0/7",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			spec, err := newAccountDerivationSpec(test.coinCode, 7)
			require.NoError(t, err)
			require.Equal(t, accountDerivationKindETH, spec.kind)
			require.Empty(t, spec.btcConfigs)
			require.Equal(t, test.keypath, spec.ethKeypath.Encode())
		})
	}
}

func TestNewAccountDerivationSpecUnsupportedCoin(t *testing.T) {
	_, err := newAccountDerivationSpec(coinpkg.Code("doge"), 0)
	require.EqualError(t, err, "Unrecognized coin code: doge")
}

func requireScriptDerivations(
	t *testing.T,
	expected []expectedScriptDerivation,
	actual []scriptTypeWithKeypath,
) {
	t.Helper()

	require.Len(t, actual, len(expected))
	for i, expectedDerivation := range expected {
		require.Equal(t, expectedDerivation.scriptType, actual[i].scriptType)
		require.Equal(t, expectedDerivation.keypath, actual[i].keypath.Encode())
	}
}
