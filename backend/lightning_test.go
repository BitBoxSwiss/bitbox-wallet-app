// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestFormattedLightningBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	b.ratesUpdater = rates.MockRateUpdater()
	defer b.ratesUpdater.Stop()

	btcCoin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)

	balance := b.formattedCoinBalance(
		coinCodeLightning,
		"Lightning",
		btcCoin,
		big.NewInt(1e8),
	)

	require.Equal(t, coinCodeLightning, balance.CoinCode)
	require.Equal(t, "Lightning", balance.CoinName)
	require.Equal(t, "1.00000000", balance.FormattedAmount.Amount)
	require.Equal(t, "BTC", balance.FormattedAmount.Unit)
	require.Equal(t, "21.00", balance.FormattedAmount.Conversions["USD"])
}

func TestLightningFormattedBalanceWithoutAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	balance, err := b.lightningFormattedBalance()

	require.NoError(t, err)
	require.Nil(t, balance)
}

func TestDefaultLightningTopUpAccountCode(t *testing.T) {
	setup := func(t *testing.T) (*Backend, accountsTypes.Code, accountsTypes.Code) {
		t.Helper()
		backend := newBackend(t, testnetDisabled, regtestDisabled)
		t.Cleanup(func() {
			require.NoError(t, backend.Close())
		})

		disconnectedKeystore := makeBitBox02Multi()
		connectedKeystore := makeBitBox02Multi()
		connectedKeystore.RootFingerprintFunc = keystoreHelper2().RootFingerprint
		connectedKeystore.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
		connectedKeystore.BTCXPubsFunc = keystoreHelper2().BTCXPubs

		disconnectedRootFingerprint, err := disconnectedKeystore.RootFingerprint()
		require.NoError(t, err)
		connectedRootFingerprint, err := connectedKeystore.RootFingerprint()
		require.NoError(t, err)

		backend.registerKeystore(disconnectedKeystore)
		require.NoError(t, backend.SetWatchonly(disconnectedRootFingerprint, true))
		backend.DeregisterKeystore()
		backend.registerKeystore(connectedKeystore)
		connectedSecondAccountCode, err := backend.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"Second connected Bitcoin account",
			connectedKeystore,
		)
		require.NoError(t, err)

		var disconnectedAccountCode accountsTypes.Code
		var connectedFirstAccountCode accountsTypes.Code
		for _, account := range backend.Accounts() {
			accountConfig := account.Config().Config
			if accountConfig.Inactive || accountConfig.HiddenBecauseUnused || account.Coin().Code() != coinpkg.CodeBTC {
				continue
			}
			rootFingerprint, err := accountConfig.SigningConfigurations.RootFingerprint()
			require.NoError(t, err)
			switch {
			case bytes.Equal(rootFingerprint, disconnectedRootFingerprint) && disconnectedAccountCode == "":
				disconnectedAccountCode = accountConfig.Code
			case bytes.Equal(rootFingerprint, connectedRootFingerprint) && connectedFirstAccountCode == "":
				connectedFirstAccountCode = accountConfig.Code
			}
		}
		require.NotEmpty(t, disconnectedAccountCode)
		require.NotEmpty(t, connectedFirstAccountCode)
		require.NotEqual(t, connectedFirstAccountCode, connectedSecondAccountCode)
		zeroAllAccountBalances(t, backend)
		return backend, disconnectedAccountCode, connectedSecondAccountCode
	}

	t.Run("prefers first funded account of connected keystore", func(t *testing.T) {
		backend, disconnectedAccountCode, connectedSecondAccountCode := setup(t)
		setAccountBalance(t, backend, disconnectedAccountCode, 1)
		setAccountBalance(t, backend, connectedSecondAccountCode, 1)

		accountCode := backend.DefaultLightningTopUpAccountCode()

		require.NotNil(t, accountCode)
		require.Equal(t, connectedSecondAccountCode, *accountCode)
	})

	t.Run("falls back when connected keystore has no funded account", func(t *testing.T) {
		backend, disconnectedAccountCode, _ := setup(t)
		setAccountBalance(t, backend, disconnectedAccountCode, 1)

		accountCode := backend.DefaultLightningTopUpAccountCode()

		require.NotNil(t, accountCode)
		require.Equal(t, disconnectedAccountCode, *accountCode)
	})

	t.Run("prefers connected account while its balance is syncing", func(t *testing.T) {
		backend, disconnectedAccountCode, connectedSecondAccountCode := setup(t)
		setAccountBalance(t, backend, disconnectedAccountCode, 1)
		connectedAccount, ok := backend.Accounts().lookup(connectedSecondAccountCode).(*accountsMocks.InterfaceMock)
		require.True(t, ok)
		connectedAccount.BalanceFunc = func() (*accounts.Balance, error) {
			return nil, accounts.ErrSyncInProgress
		}

		accountCode := backend.DefaultLightningTopUpAccountCode()

		require.NotNil(t, accountCode)
		require.Equal(t, connectedSecondAccountCode, *accountCode)
	})
}

func TestInsertLightningFormattedBalance(t *testing.T) {
	lightningBalance := coinFormattedAmount{CoinCode: coinCodeLightning}

	tests := []struct {
		name     string
		balances []coinFormattedAmount
		expected []coinpkg.Code
	}{
		{
			name: "after bitcoin",
			balances: []coinFormattedAmount{
				{CoinCode: coinpkg.CodeBTC},
				{CoinCode: coinpkg.CodeETH},
			},
			expected: []coinpkg.Code{
				coinpkg.CodeBTC,
				coinCodeLightning,
				coinpkg.CodeETH,
			},
		},
		{
			name: "first when bitcoin is missing",
			balances: []coinFormattedAmount{
				{CoinCode: coinpkg.CodeETH},
			},
			expected: []coinpkg.Code{
				coinCodeLightning,
				coinpkg.CodeETH,
			},
		},
		{
			name:     "only row",
			balances: []coinFormattedAmount{},
			expected: []coinpkg.Code{coinCodeLightning},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := insertLightningFormattedBalance(tt.balances, &lightningBalance)
			resultCodes := make([]coinpkg.Code, 0, len(result))
			for _, balance := range result {
				resultCodes = append(resultCodes, balance.CoinCode)
			}
			require.Equal(t, tt.expected, resultCodes)
		})
	}

	require.Equal(t,
		[]coinFormattedAmount{{CoinCode: coinpkg.CodeBTC}},
		insertLightningFormattedBalance([]coinFormattedAmount{{CoinCode: coinpkg.CodeBTC}}, nil),
	)
}
