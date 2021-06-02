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

package backend

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	keystoremock "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustKeypath(keypath string) signing.AbsoluteKeypath {
	kp, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func TestSortAccounts(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	rootFingerprint := []byte{1, 2, 3, 4}
	btcConfig := func(keypath string) signing.Configurations {
		kp, err := signing.NewAbsoluteKeypath(keypath)
		require.NoError(t, err)
		return signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint, kp, xpub),
		}
	}
	ethConfig := func(keypath string) signing.Configurations {
		kp, err := signing.NewAbsoluteKeypath(keypath)
		require.NoError(t, err)
		return signing.Configurations{
			signing.NewEthereumConfiguration(rootFingerprint, kp, xpub),
		}
	}

	accts := []*config.Account{
		{Code: "acct-eth-2", CoinCode: coinpkg.CodeETH, Configurations: ethConfig("m/44'/60'/0'/0/1")},
		{Code: "acct-eth-1", CoinCode: coinpkg.CodeETH, Configurations: ethConfig("m/44'/60'/0'/0/0")},
		{Code: "acct-btc-1", CoinCode: coinpkg.CodeBTC, Configurations: btcConfig("m/84'/0'/0'")},
		{Code: "acct-btc-3", CoinCode: coinpkg.CodeBTC, Configurations: btcConfig("m/84'/0'/2'")},
		{Code: "acct-btc-2", CoinCode: coinpkg.CodeBTC, Configurations: btcConfig("m/84'/0'/1'")},
		{Code: "acct-teth", CoinCode: coinpkg.CodeTETH},
		{Code: "acct-ltc", CoinCode: coinpkg.CodeLTC},
		{Code: "acct-reth", CoinCode: coinpkg.CodeRETH},
		{Code: "acct-tltc", CoinCode: coinpkg.CodeTLTC},
		{Code: "acct-tbtc", CoinCode: coinpkg.CodeTBTC},
	}
	sortAccounts(accts)
	expectedOrder := []accounts.Code{
		"acct-btc-1",
		"acct-btc-2",
		"acct-btc-3",
		"acct-tbtc",
		"acct-ltc",
		"acct-tltc",
		"acct-eth-1",
		"acct-eth-2",
		"acct-teth",
		"acct-reth",
	}
	for i := range accts {
		assert.Equal(t, expectedOrder[i], accts[i].Code)
	}
}

func TestNextAccountNumber(t *testing.T) {
	fingerprint1 := []byte{0x55, 0x55, 0x55, 0x55}
	fingerprint2 := []byte{0x66, 0x66, 0x66, 0x66}
	fingerprintEmpty := []byte{0x77, 0x77, 0x77, 0x77}
	ks := func(fingerprint []byte, supportsMultipleAccounts bool) *keystoremock.KeystoreMock {
		return &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) {
				return fingerprint, nil
			},
			SupportsMultipleAccountsFunc: func() bool {
				return supportsMultipleAccounts
			},
		}
	}

	xprv, err := hdkeychain.NewMaster(make([]byte, hdkeychain.RecommendedSeedLen), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err := xprv.Neuter()
	require.NoError(t, err)

	accountsConfig := &config.AccountsConfig{
		Accounts: []config.Account{
			{
				CoinCode: coinpkg.CodeBTC,
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						fingerprint1,
						mustKeypath("m/84'/0'/0'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeBTC,
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKHP2SH,
						fingerprint1,
						mustKeypath("m/49'/0'/0'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeTBTC,
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						fingerprint1,
						mustKeypath("m/84'/0'/3'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeTBTC,
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						fingerprint2,
						mustKeypath("m/84'/0'/4'"),
						xpub,
					),
				},
			},
		},
	}

	num, err := nextAccountNumber(coinpkg.CodeTBTC, ks(fingerprintEmpty, true), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(0), num)

	num, err = nextAccountNumber(coinpkg.CodeTBTC, ks(fingerprintEmpty, false), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(0), num)

	num, err = nextAccountNumber(coinpkg.CodeBTC, ks(fingerprint1, true), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(1), num)

	_, err = nextAccountNumber(coinpkg.CodeBTC, ks(fingerprint1, false), accountsConfig)
	require.Equal(t, ErrAccountLimitReached, errp.Cause(err))

	num, err = nextAccountNumber(coinpkg.CodeTBTC, ks(fingerprint1, true), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(4), num)

	_, err = nextAccountNumber(coinpkg.CodeTBTC, ks(fingerprint2, true), accountsConfig)
	require.Equal(t, ErrAccountLimitReached, errp.Cause(err))
}
