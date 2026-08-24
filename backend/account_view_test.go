// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func TestSortAccountViews(t *testing.T) {
	const (
		alphaWalletName = "Alpha"
		betaWalletName  = "Beta"
	)

	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	rootFingerprint1 := []byte{1, 2, 3, 4}
	rootFingerprint2 := []byte{2, 2, 3, 4}
	rootFingerprint3 := []byte{3, 2, 3, 4}
	btcConfig := func(rootFingerprint []byte, keypath string) signing.Configurations {
		kp, err := signing.NewAbsoluteKeypath(keypath)
		require.NoError(t, err)
		return signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint, kp, xpub),
		}
	}
	ethConfig := func(rootFingerprint []byte, keypath string) signing.Configurations {
		kp, err := signing.NewAbsoluteKeypath(keypath)
		require.NoError(t, err)
		return signing.Configurations{
			signing.NewEthereumConfiguration(rootFingerprint, kp, xpub),
		}
	}

	accountConfigs := []*config.Account{
		{Code: "acct-btc-alpha", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig(rootFingerprint2, "m/84'/0'/0'")},
		{Code: "acct-ltc-alpha", CoinCode: coinpkg.CodeLTC, SigningConfigurations: btcConfig(rootFingerprint2, "m/84'/2'/0'")},
		{
			Code:                  "acct-eth-beta-2",
			CoinCode:              coinpkg.CodeETH,
			SigningConfigurations: ethConfig(rootFingerprint3, "m/44'/60'/0'/0/1"),
			ActiveTokens:          []string{"eth-erc20-usdt", "eth-erc20-bat"},
		},
		{Code: "acct-btc-beta-2", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig(rootFingerprint3, "m/84'/0'/1'")},
		{Code: "acct-btc-beta-1", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig(rootFingerprint1, "m/84'/0'/0'")},
		{Code: "acct-eth-beta-1", CoinCode: coinpkg.CodeETH, SigningConfigurations: ethConfig(rootFingerprint1, "m/44'/60'/0'/0/0")},
	}
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	defer backend.Close()
	require.NoError(t, backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		accountsConfig.Accounts = append(accountsConfig.Accounts, accountConfigs...)
		keystore1 := accountsConfig.GetOrAddKeystore(rootFingerprint1)
		keystore1.Name = betaWalletName
		keystore2 := accountsConfig.GetOrAddKeystore(rootFingerprint2)
		keystore2.Name = alphaWalletName
		keystore3 := accountsConfig.GetOrAddKeystore(rootFingerprint3)
		keystore3.Name = betaWalletName
		return nil
	}))
	unlock := backend.accountsAndKeystoreLock.Lock()
	for _, accountConfig := range accountConfigs {
		accountCoin, err := backend.Coin(accountConfig.CoinCode)
		require.NoError(t, err)
		backend.createAndAddAccount(accountCoin, accountConfig, accountLoadOptions{})
	}
	unlock()

	expectedOrder := []accountsTypes.Code{
		"acct-btc-alpha",
		"acct-ltc-alpha",
		"acct-btc-beta-1",
		"acct-eth-beta-1",
		"acct-btc-beta-2",
		"acct-eth-beta-2",
		"acct-eth-beta-2-eth-erc20-bat",
		"acct-eth-beta-2-eth-erc20-usdt",
	}
	views := backend.Accounts()
	require.Len(t, views, len(expectedOrder))
	for index, view := range views {
		require.Equal(t, expectedOrder[index], view.Record.Code)
	}
}

func TestAccountViewsReadFreshPersistedMetadata(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	defer backend.Close()
	keystore := makeBitBox02Multi()
	backend.registerKeystore(keystore)

	before := backend.Accounts().lookup("v0-55555555-btc-0")
	require.NotNil(t, before)
	require.NoError(t, backend.RenameAccount(before.Record.Code, "Renamed"))

	require.NotEqual(t, "Renamed", before.Record.Name)
	require.Equal(t, "Renamed", backend.Accounts().lookup(before.Record.Code).Record.Name)
}

func TestERC20ViewInheritsParentMetadata(t *testing.T) {
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	defer backend.Close()
	keystore := makeBitBox02Multi()
	backend.registerKeystore(keystore)

	parentCode := accountsTypes.Code("v0-55555555-eth-0")
	tokenCode := "eth-erc20-bat"
	require.NoError(t, backend.SetTokenActive(parentCode, tokenCode, true))
	require.NoError(t, backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		parent := accountsConfig.Lookup(parentCode)
		require.NotNil(t, parent)
		parent.Inactive = true
		parent.HiddenBecauseUnused = true
		parent.InsuranceStatus = "active"
		return nil
	}))

	token := backend.Accounts().lookup(Erc20AccountCode(parentCode, tokenCode))
	require.NotNil(t, token)
	require.NotNil(t, token.ParentCode)
	require.Equal(t, parentCode, *token.ParentCode)
	require.Equal(t, coinpkg.Code(tokenCode), token.Record.CoinCode)
	require.Equal(t, "Basic Attention Token", token.Record.Name)
	require.True(t, token.Record.Inactive)
	require.True(t, token.Record.HiddenBecauseUnused)
	require.Equal(t, "active", token.Record.InsuranceStatus)
	require.Empty(t, token.Record.ActiveTokens)
}
