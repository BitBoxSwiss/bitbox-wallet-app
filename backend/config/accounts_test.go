// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/stretchr/testify/require"
)

func mustXKey(key string) *hdkeychain.ExtendedKey {
	xkey, err := hdkeychain.NewKeyFromString(key)
	if err != nil {
		panic(err)
	}
	return xkey
}

func TestLookup(t *testing.T) {
	cfg := AccountsConfig{
		Accounts: []*Account{
			{Code: "a"},
			{Code: "b"},
		},
	}
	acct := cfg.Lookup("a")
	require.NotNil(t, acct)
	require.Equal(t, "a", string(acct.Code))

	acct = cfg.Lookup("b")
	require.NotNil(t, acct)
	require.Equal(t, "b", string(acct.Code))

	require.Nil(t, cfg.Lookup("c"))

	acct = cfg.Lookup("a")
	require.NotNil(t, acct)
	acct.Name = "foo"
	require.Equal(t, "foo", cfg.Accounts[0].Name)
}

func TestLookupByXpub(t *testing.T) {
	keypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'")
	require.NoError(t, err)

	someXPub := "xpub661MyMwAqRbcGAo79WnM4653Aog3nKuTYq2Wy1iURzbaGE36dgnPPMxX5oCvCiky5bFbS2jS9RfAHVtpCNCEBwy6BUjLxhXYGu19NwTgrFX"
	someAccountCode := accountsTypes.Code("a")
	cfg := AccountsConfig{
		Accounts: []*Account{
			{
				Code: someAccountCode,
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						[]byte{1, 2, 3, 4},
						keypath,
						mustXKey(someXPub),
					),
				},
			},
		},
	}

	_, err = cfg.LookupByXpub("foo")
	require.Error(t, err)

	acctCode, err := cfg.LookupByXpub(someXPub)
	require.NoError(t, err)
	require.Equal(t, someAccountCode, acctCode)
}

func TestSetTokenActive(t *testing.T) {
	// not an ETH account.
	require.Error(t, (&Account{CoinCode: coin.CodeGOETH}).SetTokenActive("TOKEN", true))

	acct := &Account{
		CoinCode: coin.CodeETH,
	}
	require.NoError(t, acct.SetTokenActive("TOKEN-1", true))
	require.Equal(t, []string{"TOKEN-1"}, acct.ActiveTokens)
	require.NoError(t, acct.SetTokenActive("TOKEN-2", true))
	require.Equal(t, []string{"TOKEN-1", "TOKEN-2"}, acct.ActiveTokens)

	require.NoError(t, acct.SetTokenActive("TOKEN-1", false))
	require.Equal(t, []string{"TOKEN-2"}, acct.ActiveTokens)
}

func TestGetOrAddKeystore(t *testing.T) {
	cfg := &AccountsConfig{}
	fp1 := []byte("aaaa")
	fp2 := []byte("bbbb")

	ks := cfg.GetOrAddKeystore(fp1)
	ks.Name = "ks1"

	require.Len(t, cfg.Keystores, 1)
	require.Equal(t, ks, cfg.Keystores[0])
	require.Equal(t, fp1, []byte(cfg.Keystores[0].RootFingerprint))
	require.Equal(t, "ks1", cfg.Keystores[0].Name)

	ks = cfg.GetOrAddKeystore(fp1)
	require.Len(t, cfg.Keystores, 1)
	require.Equal(t, "ks1", ks.Name)

	ks = cfg.GetOrAddKeystore(fp2)
	ks.Name = "ks2"

	require.Len(t, cfg.Keystores, 2)
	require.Equal(t, ks, cfg.Keystores[1])
	require.Equal(t, fp2, []byte(cfg.Keystores[1].RootFingerprint))
	require.Equal(t, "ks2", cfg.Keystores[1].Name)
}

func TestMigrateActiveToken(t *testing.T) {
	config := &Config{
		appConfigFilename: "appConfigFilename",
		appConfig:         NewDefaultAppConfig(),

		accountsConfigFilename: "accountsConfigFilename",
		accountsConfig:         newDefaultAccountsonfig(),
	}

	accountConf := config.accountsConfig

	acct := &Account{
		CoinCode: coin.CodeETH,
	}

	accountConf.Accounts = append(accountConf.Accounts, acct)

	require.Equal(t, []*Account{{
		CoinCode: coin.CodeETH,
	}}, accountConf.Accounts)

	require.NoError(t, acct.SetTokenActive("eth-erc20-sai0x89d", true))
	require.Equal(t, []string{"eth-erc20-sai0x89d"}, acct.ActiveTokens)
	require.NoError(t, acct.SetTokenActive("TOKEN-2", true))
	require.Equal(t, []string{"eth-erc20-sai0x89d", "TOKEN-2"}, acct.ActiveTokens)

	require.NoError(t, migrateActiveTokens(&accountConf))

	// eth-erc20-sai0x89d was removed by the migration.
	require.Equal(t, []string{"TOKEN-2"}, acct.ActiveTokens)
}
