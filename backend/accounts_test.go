// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/hex"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/software"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testnetEnabled  = true
	testnetDisabled = false
	regtestEnabled  = true
	regtestDisabled = false
)

func checkShownLoadedAccountsLen(t *testing.T, accounts AccountsList, expectedLoaded int) {
	t.Helper()
	cntLoaded := 0
	for _, acct := range accounts {
		if !acct.Config().Config.HiddenBecauseUnused {
			cntLoaded++
		}
	}
	require.Equal(t, expectedLoaded, cntLoaded)
}

func checkShownAccountsLen(t *testing.T, b *Backend, expectedLoaded int, expectedPersisted int) {
	t.Helper()
	checkShownLoadedAccountsLen(t, b.Accounts(), expectedLoaded)
	cntPersisted := 0
	for _, acct := range b.Config().AccountsConfig().Accounts {
		if !acct.HiddenBecauseUnused {
			cntPersisted++
		}
	}
	require.Equal(t, expectedPersisted, cntPersisted)
}

// TestAccounts performs a series of typical actions related accounts.
// 1) Register a keystore, which automatically adds some default accounts
// 2) Add a second BTC account
// 3) Activate some ETH tokens
// 4) Deactivate an ETH token
// 5) Rename an account
// 6) Deactivate an account.
// 7) Rename an inactive account.
func TestAccounts(t *testing.T) {
	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.Empty(t, b.Accounts())
	require.Empty(t, b.Config().AccountsConfig().Accounts)

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(ks)
	checkShownAccountsLen(t, b, 3, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))

	// 2) Add a second BTC account
	acctCode, err := b.CreateAndPersistAccountConfig(coinpkg.CodeBTC, "A second Bitcoin account", ks)
	require.NoError(t, err)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-1"), acctCode)
	checkShownAccountsLen(t, b, 4, 4)

	// 3) Activate some ETH tokens
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", true))
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))
	require.Equal(t,
		[]string{"eth-erc20-usdt", "eth-erc20-bat"},
		b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").ActiveTokens,
	)
	checkShownAccountsLen(t, b, 6, 4)
	require.NotNil(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-bat"))
	require.NotNil(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-usdt"))

	// 4) Deactivate an ETH token
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", false))
	require.Equal(t,
		[]string{"eth-erc20-bat"},
		b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").ActiveTokens,
	)
	checkShownAccountsLen(t, b, 5, 4)
	require.NotNil(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-bat"))

	// 5) Rename an account
	require.NoError(t, b.RenameAccount("v0-55555555-eth-0", "My ETH"))
	require.Equal(t, "My ETH", b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Name)
	require.Equal(t, "My ETH", b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Name)

	// 6) Deactivate an ETH account - it also deactivates the tokens.
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	require.True(t, b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Inactive)

	// 7) Rename an inactive account.
	require.NoError(t, b.RenameAccount("v0-55555555-eth-0", "My ETH Renamed"))
	require.Equal(t, "My ETH Renamed", b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Name)
	require.Equal(t, "My ETH Renamed", b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Name)
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

	accountConfigs := []*config.Account{
		{
			Code:                  "acct-eth-2",
			CoinCode:              coinpkg.CodeETH,
			SigningConfigurations: ethConfig("m/44'/60'/0'/0/1"),
			ActiveTokens:          []string{"eth-erc20-usdt", "eth-erc20-bat"},
		},
		{Code: "acct-eth-1", CoinCode: coinpkg.CodeETH, SigningConfigurations: ethConfig("m/44'/60'/0'/0/0")},
		{Code: "acct-btc-1", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig("m/84'/0'/0'")},
		{Code: "acct-btc-3", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig("m/84'/0'/2'")},
		{Code: "acct-btc-2", CoinCode: coinpkg.CodeBTC, SigningConfigurations: btcConfig("m/84'/0'/1'")},
		{Code: "acct-sepeth", CoinCode: coinpkg.CodeSEPETH},
		{Code: "acct-ltc", CoinCode: coinpkg.CodeLTC},
		{Code: "acct-tltc", CoinCode: coinpkg.CodeTLTC},
		{Code: "acct-tbtc", CoinCode: coinpkg.CodeTBTC},
	}
	backend := newBackend(t, testnetDisabled, regtestDisabled)
	unlockFN := backend.accountsAndKeystoreLock.Lock()
	for i := range accountConfigs {
		c, err := backend.Coin(accountConfigs[i].CoinCode)
		require.NoError(t, err)
		backend.createAndAddAccount(c, accountConfigs[i])
	}
	unlockFN()

	expectedOrder := []accountsTypes.Code{
		"acct-btc-1",
		"acct-btc-2",
		"acct-btc-3",
		"acct-tbtc",
		"acct-ltc",
		"acct-tltc",
		"acct-eth-1",
		"acct-eth-2",
		"acct-eth-2-eth-erc20-bat",
		"acct-eth-2-eth-erc20-usdt",
		"acct-sepeth",
	}

	for i, acct := range backend.Accounts() {
		assert.Equal(t, expectedOrder[i], acct.Config().Config.Code)
	}
}

func TestNextAccountNumber(t *testing.T) {
	fingerprintEmpty := []byte{0x77, 0x77, 0x77, 0x77}
	ks := func(fingerprint []byte, supportsMultipleAccounts bool) *keystoremock.KeystoreMock {
		return &keystoremock.KeystoreMock{
			SupportsCoinFunc: func(coin coinpkg.Coin) bool {
				return true
			},
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
		Accounts: []*config.Account{
			{
				CoinCode: coinpkg.CodeBTC,
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						rootFingerprint1,
						mustKeypath("m/84'/0'/0'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeBTC,
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKHP2SH,
						rootFingerprint1,
						mustKeypath("m/49'/0'/0'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeTBTC,
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						rootFingerprint1,
						mustKeypath("m/84'/0'/3'"),
						xpub,
					),
				},
			},
			{
				CoinCode: coinpkg.CodeTBTC,
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2WPKH,
						rootFingerprint2,
						mustKeypath("m/84'/0'/5'"),
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

	num, err = nextAccountNumber(coinpkg.CodeBTC, ks(rootFingerprint1, true), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(1), num)

	_, err = nextAccountNumber(coinpkg.CodeBTC, ks(rootFingerprint1, false), accountsConfig)
	require.Equal(t, errAccountLimitReached, errp.Cause(err))

	num, err = nextAccountNumber(coinpkg.CodeTBTC, ks(rootFingerprint1, true), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(4), num)

	_, err = nextAccountNumber(coinpkg.CodeTBTC, ks(rootFingerprint2, true), accountsConfig)
	require.Equal(t, errAccountLimitReached, errp.Cause(err))
}

func TestSupportedCoins(t *testing.T) {
	t.Run("all coins supported, mainnet", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		require.Equal(t,
			[]coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH},
			b.SupportedCoins(&keystoremock.KeystoreMock{
				SupportsCoinFunc: func(coin coinpkg.Coin) bool {
					return true
				},
			}),
		)
	})

	t.Run("all coins supported, testnet", func(t *testing.T) {
		b := newBackend(t, testnetEnabled, regtestDisabled)
		defer b.Close()
		require.Equal(t,
			[]coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeSEPETH},
			b.SupportedCoins(&keystoremock.KeystoreMock{
				SupportsCoinFunc: func(coin coinpkg.Coin) bool {
					return true
				},
			}),
		)
	})

	t.Run("all coins supported, regtest", func(t *testing.T) {
		b := newBackend(t, testnetEnabled, regtestEnabled)
		defer b.Close()
		require.Equal(t,
			[]coinpkg.Code{coinpkg.CodeRBTC},
			b.SupportedCoins(&keystoremock.KeystoreMock{
				SupportsCoinFunc: func(coin coinpkg.Coin) bool {
					return true
				},
			}),
		)
	})

	t.Run("no coins supported", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		require.Equal(t,
			[]coinpkg.Code(nil),
			b.SupportedCoins(&keystoremock.KeystoreMock{
				SupportsCoinFunc: func(code coinpkg.Coin) bool {
					return false
				},
			}),
		)
	})

	t.Run("subset supported", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		require.Equal(t,
			[]coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC},
			b.SupportedCoins(&keystoremock.KeystoreMock{
				SupportsCoinFunc: func(coin coinpkg.Coin) bool {
					return coin.Code() == coinpkg.CodeBTC || coin.Code() == coinpkg.CodeLTC
				},
			}),
		)
	})
}

func TestCreateAndPersistAccountConfig(t *testing.T) {
	bitbox02LikeKeystore := makeBitBox02Multi()
	bitbox02LikeKeystore.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}

	// Add a few accounts with BB02.
	t.Run("bitbox02Like", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		// This adds one BTC/LTC/ETH by default.
		b.registerKeystore(bitbox02LikeKeystore)

		// Add another Bitcoin account.
		acctCode, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 2",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-btc-1", string(acctCode))

		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 2",
				Code:     "v0-55555555-btc-1",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/0'/1'"), test.TstMustXKey("xpub6Cxa67Bfe1Aw7YVtdqKPYLhSkf7omb7WkGXQzof15VXbAZKVct1caHHK55UQN2Fnojbp2okiBCbGXyQSRzMQ6XKJJeeM2jAt6FR8K8ckA88")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1, mustKeypath("m/86'/0'/1'"), test.TstMustXKey("xpub6CC9Tsi4eJvmSBj5xoU4sKnFGF9nF8qwExB3axxu2F7oWKFH5RucWQUfrgVGfnTDr6p5acBGpAqAMKb2A7ek8SbAUvDEXtvj37pM1S9X2km")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/0'/1'"), test.TstMustXKey("xpub6CUmEcJb7juvpvNs2hKMc9BP1n82ixzUb4jyHUdYzSLmnXru3nb4hhGsfS23WRx8hgJLxMxZ7WcBGzTiYfiANUQZe3TVFghLrxvA2Ls7u4a")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-1"),
		)

		// Add another Litecoin account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeLTC,
			"litecoin 2",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-ltc-1", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "ltc",
				Name:     "litecoin 2",
				Code:     "v0-55555555-ltc-1",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/2'/1'"), test.TstMustXKey("xpub6DReBHtKxgeZJJrrhPEHz9kzEZU1BaQ4kPQ2J1tfjA9DMBKT2bor1ynoAPCsxdyJyZrYK5YsYmkknV5KPtpKeVb2HMX6iQ9wjpAhNSANGiA")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/2'/1'"), test.TstMustXKey("xpub6CrhULuXbYzo8Lk2iJY5dr6mWjHBKQuohcP99HcioFiouGuEBWEJDMbgLDD89hvJiT1wD94FnuQcSzE4QsxWDv2AQbiitk7EbNvE8mmT17M")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-ltc-1"),
		)

		// Add another Ethereum account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeETH,
			"ethereum 2",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-eth-1", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "eth",
				Name:     "ethereum 2",
				Code:     "v0-55555555-eth-1",
				SigningConfigurations: signing.Configurations{
					signing.NewEthereumConfiguration(rootFingerprint1, mustKeypath("m/44'/60'/0'/0/1"), test.TstMustXKey("xpub6GP83vJASH1kUpndXSe3e942omyTYSPKaav6shfic7Lc3rFJR9ctA3AXaTf7rX7PuSZNUnaqj4hiqgnRXr26jitBz4jLhmFURtVxDykHbQm")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-eth-1"),
		)

		// Add another Bitcoin account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 3",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-btc-2", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 3",
				Code:     "v0-55555555-btc-2",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/0'/2'"), test.TstMustXKey("xpub6Cxa67Bfe1Aw9RoKZ9TdQy1sa2ajV2kFX7gYgSeEUbtJkiCtiv8BwUtmMf62jnqGF49xS4K9hsydZzCnKRJYgGNurJyWhHUfEb1Pb3jU7AE")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1, mustKeypath("m/86'/0'/2'"), test.TstMustXKey("xpub6CC9Tsi4eJvmWfiBUVD3PgzZyJabmcnmRVubhrnfHoQ3WKsXeTATdBtn6wG31fjLjsKN6rePpgjAS165WpKdPFYCCdJEwH6quFgCvLmspHD")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/0'/2'"), test.TstMustXKey("xpub6CUmEcJb7juvtsy83LUg98DBNk2YXQLTRh6HvVCSxEpNKn2UoUhQKrs7CMEfnWtD1a9ezxQvLKHaKXGm1Wd2pamTesJPFxipMq9p225DVnP")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-2"),
		)

		// Add another Litecoin account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeLTC,
			"litecoin 2",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-ltc-2", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "ltc",
				Name:     "litecoin 2",
				Code:     "v0-55555555-ltc-2",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/2'/2'"), test.TstMustXKey("xpub6DReBHtKxgeZMSJ6jG1vjLLVKUzVUZ9kQZyZfEuqLPVPBxNaZb65d2WpokoBukNqMtpGja7R1TF5HpcQ6FASTC83r476hckHd5Y4HHbmuBN")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/2'/2'"), test.TstMustXKey("xpub6CrhULuXbYzoAckL8qPdKvphNJQKF18vQmhaEgSMEjSB4uE3ZULChPrSQ4J2eD1zFW4rVGPe2x1AMY55F4PQSvE4KQaBzD63R5HKAu5e65a")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-ltc-2"),
		)

		// Add another Ethereum account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeETH,
			"ethereum 2",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-eth-2", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "eth",
				Name:     "ethereum 2",
				Code:     "v0-55555555-eth-2",
				SigningConfigurations: signing.Configurations{
					signing.NewEthereumConfiguration(rootFingerprint1, mustKeypath("m/44'/60'/0'/0/2"), test.TstMustXKey("xpub6GP83vJASH1kWxg73WYnAjrLZPzGRoBScD2JqgnPtRK57yQ1eQQuAtTnMaY6wz6HKDo4WeApein4bYmeZZRjxz93yX6AtZCaFBJo9v1NX9r")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-eth-2"),
		)

		// Add BTC/LTC hidden accounts for scanning.
		b.maybeAddHiddenUnusedAccounts()
		require.Equal(t,
			&config.Account{
				HiddenBecauseUnused: true,
				CoinCode:            "btc",
				Name:                "Bitcoin 4",
				Code:                "v0-55555555-btc-3",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/0'/3'"), test.TstMustXKey("xpub6Cxa67Bfe1AwC2ZgtXtZEGhktXtmANfGVNQT9s1Ji66RkCr7zd7weCrDJihJmEUpSeiJwvTfZUSKYpYVqSiSyujaK2iwRsu6jUtps5bpnQV")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1, mustKeypath("m/86'/0'/3'"), test.TstMustXKey("xpub6CC9Tsi4eJvmZAzKWXdpMyc6w8UUsEWkoUDAX3zCVSZw2RTExs6vHSuTMYE765BGe1afYxEY5SMKCPY2H1XyVJpgvR4fHBvaVvCzwCX27dg")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/0'/3'"), test.TstMustXKey("xpub6CUmEcJb7juvwkgAjf2f7WmD5oQx6xhizXTw2xRhPMjDq9SpZp3ELFauXdyU3XbLeHs4gvMMf6VeK7WoekdGQSXwrmVERdFtSPYiXhEFXwJ")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-3"),
		)
		// Add another Bitcoin account. The previously added hidden account is unhidden instead of
		// adding a new one. The name is overwritten.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 4 new name",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-btc-3", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 4 new name",
				Code:     "v0-55555555-btc-3",
				SigningConfigurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint1, mustKeypath("m/84'/0'/3'"), test.TstMustXKey("xpub6Cxa67Bfe1AwC2ZgtXtZEGhktXtmANfGVNQT9s1Ji66RkCr7zd7weCrDJihJmEUpSeiJwvTfZUSKYpYVqSiSyujaK2iwRsu6jUtps5bpnQV")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, rootFingerprint1, mustKeypath("m/86'/0'/3'"), test.TstMustXKey("xpub6CC9Tsi4eJvmZAzKWXdpMyc6w8UUsEWkoUDAX3zCVSZw2RTExs6vHSuTMYE765BGe1afYxEY5SMKCPY2H1XyVJpgvR4fHBvaVvCzwCX27dg")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, rootFingerprint1, mustKeypath("m/49'/0'/3'"), test.TstMustXKey("xpub6CUmEcJb7juvwkgAjf2f7WmD5oQx6xhizXTw2xRhPMjDq9SpZp3ELFauXdyU3XbLeHs4gvMMf6VeK7WoekdGQSXwrmVERdFtSPYiXhEFXwJ")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-3"),
		)

	})

	// If the keystore cannot retrieve an xpub (e.g. USB communication error), no account should be
	// added.
	t.Run("xpub-error", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		expectedErr := errp.New("failed getting xpub")
		// Keystore has a problem getting the xpub.
		ks := &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) {
				return rootFingerprint1, nil
			},
			SupportsCoinFunc: func(coin coinpkg.Coin) bool {
				return true
			},
			SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
				return true
			},
			SupportsMultipleAccountsFunc: func() bool {
				return true
			},
			BTCXPubsFunc: func(coin coinpkg.Coin, keypaths []signing.AbsoluteKeypath,
			) ([]*hdkeychain.ExtendedKey, error) {
				return nil, expectedErr
			},
		}

		_, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 1",
			ks,
		)
		require.Equal(t, expectedErr, err)
	})
}

func TestCreateAndAddAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	fingerprint := []byte{0x55, 0x55, 0x55, 0x55}

	require.Equal(t, AccountsList{}, b.Accounts())

	// Add a Bitcoin account.
	coin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)
	unlockFN := b.accountsAndKeystoreLock.Lock()
	b.createAndAddAccount(
		coin,
		&config.Account{
			Code: "test-btc-account-code",
			Name: "Bitcoin account name",
			SigningConfigurations: signing.Configurations{
				signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/0'/0'"), test.TstMustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")),
			},
		},
	)
	unlockFN()
	require.Len(t, b.Accounts(), 1)
	// Check some properties of the newly added account.
	acct := b.Accounts()[0]
	require.Equal(t, accountsTypes.Code("test-btc-account-code"), acct.Config().Config.Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Bitcoin account name", acct.Config().Config.Name)

	// Add a Litecoin account.
	coin, err = b.Coin(coinpkg.CodeLTC)
	require.NoError(t, err)

	unlockFN = b.accountsAndKeystoreLock.Lock()
	b.createAndAddAccount(coin,
		&config.Account{
			Code: "test-ltc-account-code",
			Name: "Litecoin account name",
			SigningConfigurations: signing.Configurations{
				signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/2'/0'"), test.TstMustXKey("xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP")),
			},
		},
	)
	unlockFN()
	require.Len(t, b.Accounts(), 2)
	// Check some properties of the newly added account.
	acct = b.Accounts()[1]
	require.Equal(t, accountsTypes.Code("test-ltc-account-code"), acct.Config().Config.Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Litecoin account name", acct.Config().Config.Name)

	// Add an Ethereum account with some active ERC20 tokens.
	coin, err = b.Coin(coinpkg.CodeETH)
	require.NoError(t, err)
	unlockFN = b.accountsAndKeystoreLock.Lock()
	b.createAndAddAccount(coin,
		&config.Account{
			Code: "test-eth-account-code",
			Name: "Ethereum account name",
			SigningConfigurations: signing.Configurations{
				signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/0"), test.TstMustXKey("xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E")),
			},
			ActiveTokens: []string{"eth-erc20-mkr"},
		},
	)
	unlockFN()
	// 2 more accounts: the added ETH account plus the active token for the ETH account.
	require.Len(t, b.Accounts(), 4)
	// Check some properties of the newly added account.
	acct = b.Accounts()[2]
	require.Nil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accountsTypes.Code("test-eth-account-code"), acct.Config().Config.Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Ethereum account name", acct.Config().Config.Name)
	acct = b.Accounts()[3]
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accountsTypes.Code("test-eth-account-code-eth-erc20-mkr"), acct.Config().Config.Code)
	require.Equal(t, "Maker", acct.Config().Config.Name)

	// Add another Ethereum account with some active ERC20 tokens.
	coin, err = b.Coin(coinpkg.CodeETH)
	require.NoError(t, err)
	unlockFN = b.accountsAndKeystoreLock.Lock()
	b.createAndAddAccount(coin,
		&config.Account{
			Code: "test-eth-account-code-2",
			Name: "Ethereum account name 2",

			SigningConfigurations: signing.Configurations{
				signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/1"), test.TstMustXKey("xpub6GP83vJASH1kUpndXSe3e942omyTYSPKaav6shfic7Lc3rFJR9ctA3AXaTf7rX7PuSZNUnaqj4hiqgnRXr26jitBz4jLhmFURtVxDykHbQm")),
			},
			ActiveTokens: []string{"eth-erc20-usdt", "eth-erc20-bat"},
		},
	)
	unlockFN()
	// 3 more accounts: the added ETH account plus the two active tokens for the ETH account.
	require.Len(t, b.Accounts(), 7)
	// Check some properties of the newly added accounts.
	acct = b.Accounts()[4]
	require.Nil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accountsTypes.Code("test-eth-account-code-2"), acct.Config().Config.Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Ethereum account name 2", acct.Config().Config.Name)
	acct = b.Accounts()[5]
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accountsTypes.Code("test-eth-account-code-2-eth-erc20-bat"), acct.Config().Config.Code)
	require.Equal(t, "Basic Attention Token 2", acct.Config().Config.Name)
	acct = b.Accounts()[6]
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accountsTypes.Code("test-eth-account-code-2-eth-erc20-usdt"), acct.Config().Config.Code)
	require.Equal(t, "Tether USD 2", acct.Config().Config.Name)
}

// TestAccountSupported tests that only accounts supported by a keystore are 1) persisted when the
// keystore is first registered 2) loaded when the keytore is registered.
// The second point is important because it's possible to use e.g. a BitBox02-Multi and a
// Bitbox02-btconly with the same seed, so we shouldn't load all persisted accounts without checking.
func TestAccountSupported(t *testing.T) {
	bb02Multi := makeBitBox02Multi()
	bb02BtcOnly := makeBitBox02BTCOnly()

	rootFingerprint, err := bb02Multi.RootFingerprint()
	require.NoError(t, err)

	rootFingerprint2, err := bb02BtcOnly.RootFingerprint()
	require.NoError(t, err)

	require.Equal(t, rootFingerprint, rootFingerprint2)

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bb02Multi)
	checkShownAccountsLen(t, b, 3, 3)
	require.NoError(t, b.SetWatchonly(rootFingerprint, true))

	b.DeregisterKeystore()
	// Registering a Bitcoin-only like keystore loads also the altcoins that were persisted
	// previously, because watch-only is enabled for that keystore.
	b.registerKeystore(bb02BtcOnly)
	checkShownAccountsLen(t, b, 3, 3)

	// If watch-only is disabled, then these will not be loaded if not supported by the keystore.
	require.NoError(t, b.SetWatchonly(rootFingerprint, false))
	b.DeregisterKeystore()

	// Registering a Bitcoin-only like keystore loads only the Bitcoin account, even though altcoins
	// were persisted previously.
	b.registerKeystore(bb02BtcOnly)
	checkShownAccountsLen(t, b, 1, 3)
}

func TestInactiveAccount(t *testing.T) {
	bitbox02LikeKeystore := makeBitBox02Multi()
	bitbox02LikeKeystore.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bitbox02LikeKeystore)

	checkShownAccountsLen(t, b, 3, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-btc-0").Config().Config.Inactive)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0").Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-ltc-0").Config().Config.Inactive)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Inactive)

	// Deactive an account.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", false))
	checkShownAccountsLen(t, b, 3, 3)
	require.True(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.True(t, b.Accounts().lookup("v0-55555555-btc-0").Config().Config.Inactive)

	// Reactivate.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", true))
	checkShownAccountsLen(t, b, 3, 3)
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-btc-0").Config().Config.Inactive)

	// Deactivating an ETH account with tokens also removes the tokens
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", true))
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))
	checkShownAccountsLen(t, b, 5, 3)
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	checkShownAccountsLen(t, b, 5, 3)
	require.True(t, b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Inactive)
	require.True(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-usdt").Config().Config.Inactive)
	require.True(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-bat").Config().Config.Inactive)
	// Reactivating restores them again.
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", true))
	checkShownAccountsLen(t, b, 5, 3)
	require.False(t, b.Accounts().lookup("v0-55555555-eth-0").Config().Config.Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-usdt").Config().Config.Inactive)
	require.False(t, b.Accounts().lookup("v0-55555555-eth-0-eth-erc20-bat").Config().Config.Inactive)

	// Deactivate all accounts.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", false))
	require.NoError(t, b.SetAccountActive("v0-55555555-ltc-0", false))
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	checkShownAccountsLen(t, b, 5, 3)

	// Re-registering the keystore (i.e. replugging the device) ends in the same state: no
	// additional accounts created.
	b.DeregisterKeystore()
	b.registerKeystore(bitbox02LikeKeystore)
	checkShownAccountsLen(t, b, 5, 3)
}

// Test that taproot subaccounts are added if a keytore gains taproot support (e.g. BitBox02 gained
// taproot support in v9.10.0)
func TestTaprootUpgrade(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	fingerprint := []byte{0x55, 0x055, 0x55, 0x55}

	bitbox02NoTaproot := &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock no taproot", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return scriptType == signing.ScriptTypeP2WPKHP2SH ||
					scriptType == signing.ScriptTypeP2WPKH
			default:
				return true
			}
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
		BTCXPubsFunc:          keystoreHelper.BTCXPubs,
	}
	bitbox02Taproot := &keystoremock.KeystoreMock{
		NameFunc: func() (string, error) {
			return "Mock taproot", nil
		},
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
		},
		SupportsCoinFunc: func(coin coinpkg.Coin) bool {
			return true
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				if scriptType == signing.ScriptTypeP2TR {
					return coin.Code() == coinpkg.CodeBTC
				}
				return scriptType == signing.ScriptTypeP2WPKHP2SH ||
					scriptType == signing.ScriptTypeP2WPKH
			default:
				return true
			}
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
		BTCXPubsFunc:          keystoreHelper.BTCXPubs,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bitbox02NoTaproot)
	checkShownAccountsLen(t, b, 3, 3)
	btcAccount := b.Accounts().lookup("v0-55555555-btc-0")
	require.NotNil(t, btcAccount)
	ltcAccount := b.Accounts().lookup("v0-55555555-ltc-0")
	require.NotNil(t, ltcAccount)
	require.Equal(t, coinpkg.CodeBTC, btcAccount.Coin().Code())
	require.Len(t, btcAccount.Config().Config.SigningConfigurations, 2)
	require.Len(t, ltcAccount.Config().Config.SigningConfigurations, 2)
	require.Equal(t,
		signing.ScriptTypeP2WPKH, btcAccount.Config().Config.SigningConfigurations[0].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2WPKHP2SH, btcAccount.Config().Config.SigningConfigurations[1].ScriptType())
	// Same for the persisted account config.
	require.Equal(t,
		btcAccount.Config().Config.SigningConfigurations,
		b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").SigningConfigurations)

	// "Unplug", then insert an updated keystore with taproot support.
	b.DeregisterKeystore()
	b.registerKeystore(bitbox02Taproot)
	checkShownAccountsLen(t, b, 3, 3)
	btcAccount = b.Accounts().lookup("v0-55555555-btc-0")
	require.NotNil(t, btcAccount)
	ltcAccount = b.Accounts().lookup("v0-55555555-ltc-0")
	require.NotNil(t, ltcAccount)
	require.Equal(t, coinpkg.CodeBTC, b.Accounts()[0].Coin().Code())
	require.Len(t, btcAccount.Config().Config.SigningConfigurations, 3)
	// LTC (coin with no taproot support) unchanged.
	require.Len(t, ltcAccount.Config().Config.SigningConfigurations, 2)
	require.Equal(t,
		signing.ScriptTypeP2WPKH, btcAccount.Config().Config.SigningConfigurations[0].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2WPKHP2SH, btcAccount.Config().Config.SigningConfigurations[1].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2TR, btcAccount.Config().Config.SigningConfigurations[2].ScriptType())
	// Same for the persisted account config.
	require.Equal(t,
		btcAccount.Config().Config.SigningConfigurations,
		b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").SigningConfigurations)
}

func TestRenameAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	bitbox02LikeKeystore := makeBitBox02Multi()
	bitbox02LikeKeystore.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(bitbox02LikeKeystore)

	require.NoError(t, b.RenameAccount("v0-55555555-btc-0", "renamed"))
	require.Equal(t, "renamed", b.Accounts().lookup("v0-55555555-btc-0").Config().Config.Name)
	require.Equal(t, "renamed", b.config.AccountsConfig().Lookup("v0-55555555-btc-0").Name)
}

func TestMaybeAddHiddenUnusedAccounts(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	bitbox02LikeKeystore := makeBitBox02Multi()
	bitbox02LikeKeystore.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(bitbox02LikeKeystore)

	// Initial accounts added: Bitcoin, Litecoin, Ethereum.
	checkShownAccountsLen(t, b, 3, 3)

	// Up to 6 hidden accounts for BTC/LTC are added to be scanned even if the accounts are all
	// empty. Calling this function too many times does not add more than that.
	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	require.Len(t, b.Accounts(), 3+2*5)
	require.Len(t, b.config.AccountsConfig().Accounts, 3+2*5)

	for i := 1; i <= 5; i++ {
		for _, addedAccountCode := range []string{
			fmt.Sprintf("v0-55555555-btc-%d", i),
			fmt.Sprintf("v0-55555555-ltc-%d", i),
		} {
			addedAccount := b.config.AccountsConfig().Lookup(accountsTypes.Code(addedAccountCode))
			require.NotNil(t, addedAccount)
			require.True(t, addedAccount.HiddenBecauseUnused)

			accountNumber, err := addedAccount.SigningConfigurations[0].AccountNumber()
			require.NoError(t, err)
			require.Equal(t, uint16(i), accountNumber)
		}
	}

	// One more call does nothing as the previous account must be used before new ones can be added.
	require.Len(t, b.config.AccountsConfig().Accounts, 13)
	b.maybeAddHiddenUnusedAccounts()
	require.Len(t, b.config.AccountsConfig().Accounts, 13)

	// Mark the last account as used. Then one more hidden account can be added for scanning.
	require.NoError(t, b.config.ModifyAccountsConfig(func(cfg *config.AccountsConfig) error {
		cfg.Lookup("v0-55555555-btc-5").Used = true
		return nil
	}))
	require.Nil(t, b.config.AccountsConfig().Lookup("v0-55555555-btc-6"))
	b.maybeAddHiddenUnusedAccounts()
	require.Len(t, b.config.AccountsConfig().Accounts, 14)
	require.NotNil(t, b.config.AccountsConfig().Lookup("v0-55555555-btc-6"))
}

func TestWatchonly(t *testing.T) {
	// No watchonly - accounts are loaded when registering keystore and unloaded when deregistering
	// keystore.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()
		b.registerKeystore(makeBitBox02Multi())
		checkShownAccountsLen(t, b, 3, 3)
		b.DeregisterKeystore()
		checkShownAccountsLen(t, b, 0, 3)
	})

	// Watchonly enabled while keystore is registered keeps accounts available after disconnect.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		ks := makeBitBox02Multi()

		rootFingerprint, err := ks.RootFingerprint()
		require.NoError(t, err)

		b.registerKeystore(ks)
		checkShownAccountsLen(t, b, 3, 3)
		require.NoError(t, b.SetWatchonly(rootFingerprint, true))

		b.DeregisterKeystore()
		// Accounts remain loaded.
		checkShownAccountsLen(t, b, 3, 3)
	})

	// Hidden accounts should not remain loaded when watchonly is enabled and the keystore disconnects.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		ks := makeBitBox02Multi()
		rootFingerprint, err := ks.RootFingerprint()
		require.NoError(t, err)

		hiddenAccountsAdded := make(chan struct{})
		b.tstMaybeAddHiddenUnusedAccounts = func() {
			close(hiddenAccountsAdded)
		}

		b.registerKeystore(ks)

		select {
		case <-hiddenAccountsAdded:
		case <-time.After(5 * time.Second):
			require.Fail(t, "expected hidden accounts to be added")
		}

		require.Greater(t, len(b.Config().AccountsConfig().Accounts), 3)

		require.NoError(t, b.SetWatchonly(rootFingerprint, true))
		b.DeregisterKeystore()

		require.Len(t, b.Accounts(), 3)
	})

	// Watchonly of a keystore is disabled while some watched accounts are shown with no keystore
	// connected.  All accounts of the keystore should disappear. When re-enabling watchonly, they
	// do not reappear - connecting the keystore again is necessary.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		ks := makeBitBox02Multi()

		rootFingerprint, err := ks.RootFingerprint()
		require.NoError(t, err)

		b.registerKeystore(ks)
		require.NoError(t, b.SetWatchonly(rootFingerprint, true))

		b.DeregisterKeystore()
		// Accounts remain loaded.
		checkShownAccountsLen(t, b, 3, 3)

		// Disable watchonly, all accounts disappear.
		require.NoError(t, b.SetWatchonly(rootFingerprint, false))
		checkShownAccountsLen(t, b, 0, 3)
	})

	// Disable keystore's watchonly setting while keystore is connected does not make the accounts
	// disappear yet. They only disappear once the keytore is disconnected.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		ks := makeBitBox02Multi()

		rootFingerprint, err := ks.RootFingerprint()
		require.NoError(t, err)

		b.registerKeystore(ks)
		checkShownAccountsLen(t, b, 3, 3)
		require.NoError(t, b.SetWatchonly(rootFingerprint, true))

		// Disable watchonly, all accounts remain as the keystore is still connected.
		require.NoError(t, b.SetWatchonly(rootFingerprint, false))
		checkShownAccountsLen(t, b, 3, 3)

		// Accounts disappear when the keystore is disconnected.
		b.DeregisterKeystore()
		checkShownAccountsLen(t, b, 0, 3)
	})

	// Test with two keystores, one watched and the other not.
	t.Run("", func(t *testing.T) {
		// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
		rootKey1 := test.TstMustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
		keystoreHelper1 := software.NewKeystore(rootKey1)
		// From mnemonic: lava scare swap mystery lawsuit army rubber clean mean bronze keen volcano
		rootKey2 := test.TstMustXKey("xprv9s21ZrQH143K3cfe2832UrUDA5jmFWvm3acoempvZofxin26VdqjosJfTjHsVgjgszDYHiEgepM7J7U9N7HpayNZDRPUoxGKQbJCuHzgnuy")
		keystoreHelper2 := software.NewKeystore(rootKey2)

		rootFingerprint1 := []byte{0x55, 0x055, 0x55, 0x55}
		rootFingerprint2 := []byte{0x66, 0x066, 0x66, 0x66}

		// A keystore with a similar config to a BitBox02 - supporting unified accounts, no legacy
		// P2PKH.
		ks1 := &keystoremock.KeystoreMock{
			NameFunc: func() (string, error) {
				return "Mock keystore 1", nil
			},
			RootFingerprintFunc: func() ([]byte, error) {
				return rootFingerprint1, nil
			},
			SupportsCoinFunc: func(coin coinpkg.Coin) bool {
				return true
			},
			SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
				switch coin.(type) {
				case *btc.Coin:
					scriptType := meta.(signing.ScriptType)
					return scriptType != signing.ScriptTypeP2PKH
				default:
					return true
				}
			},
			ExtendedPublicKeyFunc: keystoreHelper1.ExtendedPublicKey,
			BTCXPubsFunc:          keystoreHelper1.BTCXPubs,
		}
		ks2 := &keystoremock.KeystoreMock{
			NameFunc: func() (string, error) {
				return "Mock keystore 2", nil
			},
			RootFingerprintFunc: func() ([]byte, error) {
				return rootFingerprint2, nil
			},
			SupportsCoinFunc: func(coin coinpkg.Coin) bool {
				return true
			},
			SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
				switch coin.(type) {
				case *btc.Coin:
					scriptType := meta.(signing.ScriptType)
					return scriptType != signing.ScriptTypeP2PKH
				default:
					return true
				}
			},
			ExtendedPublicKeyFunc: keystoreHelper2.ExtendedPublicKey,
			BTCXPubsFunc:          keystoreHelper2.BTCXPubs,
		}

		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		b.registerKeystore(ks1)
		checkShownAccountsLen(t, b, 3, 3)
		// Watch this wallet.
		require.NoError(t, b.SetWatchonly(rootFingerprint1, true))
		b.DeregisterKeystore()
		// Accounts remain loaded.
		checkShownAccountsLen(t, b, 3, 3)

		b.registerKeystore(ks2)
		checkShownAccountsLen(t, b, 6, 6)
		b.DeregisterKeystore()
		// ks1 accouts remain loaded.
		checkShownAccountsLen(t, b, 3, 6)

		b.registerKeystore(ks2)
		checkShownAccountsLen(t, b, 6, 6)
		// Watch second wallet as well.
		require.NoError(t, b.SetWatchonly(rootFingerprint2, true))
		b.DeregisterKeystore()
		// All accounts remain loaded.
		checkShownAccountsLen(t, b, 6, 6)

		// Stop watching first wallet.
		require.NoError(t, b.SetWatchonly(rootFingerprint1, false))
		checkShownAccountsLen(t, b, 3, 6)
	})

	// Adding new accounts after the keystore has been connected keeps them available if watchonly is enabled.
	t.Run("", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		// registering a keystore calls `go maybeAddHiddenunusedAccounts()` - we need wait for it to
		// complete to avoid race conditions in this test about which account is added at what time.
		hiddenAccountsAdded := make(chan struct{})
		b.tstMaybeAddHiddenUnusedAccounts = func() {
			close(hiddenAccountsAdded)
		}

		ks := makeBitBox02Multi()
		ks.RootFingerprintFunc = func() ([]byte, error) {
			return rootFingerprint1, nil
		}

		rootFingerprint, err := ks.RootFingerprint()
		require.NoError(t, err)

		b.registerKeystore(ks)
		checkShownAccountsLen(t, b, 3, 3)

		select {
		case <-hiddenAccountsAdded:
		case <-time.After(5 * time.Second):
			require.Fail(t, "expected hidden accounts to be added")
		}

		require.NoError(t, b.SetWatchonly(rootFingerprint, true))

		// An account has already been added as part of autodiscover, so we add two.
		newAccountCode1, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"Bitcoin account name",
			ks,
		)
		require.NoError(t, err)
		require.Equal(t, accountsTypes.Code("v0-55555555-btc-1"), newAccountCode1)

		expectedNewAccountCode2 := accountsTypes.Code("v0-55555555-btc-2")
		// Make sure the account to be added has not been added yet (autodiscover), so we know we
		// are testing the intended account persistence.
		require.Nil(t, b.Config().AccountsConfig().Lookup(expectedNewAccountCode2))

		newAccountCode2, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"Bitcoin account name 2",
			ks,
		)
		require.NoError(t, err)
		require.Equal(t, expectedNewAccountCode2, newAccountCode2)

		require.NoError(t, err)

		b.DeregisterKeystore()

		// Accounts, including the newly added ones, remain loaded.
		checkShownAccountsLen(t, b, 5, 5)
	})
}

func TestAccountsByKeystore(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks1 := makeBitBox02Multi()
	ks2 := makeBitBox02Multi()

	ks2.RootFingerprintFunc = keystoreHelper2().RootFingerprint
	ks2.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
	ks2.BTCXPubsFunc = keystoreHelper2().BTCXPubs

	ks1Fingerprint, err := ks1.RootFingerprint()
	require.NoError(t, err)
	ks2Fingerprint, err := ks2.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks1)
	require.NoError(t, b.SetWatchonly(ks1Fingerprint, true))
	b.DeregisterKeystore()
	b.registerKeystore(ks2)
	accountsMap, err := b.AccountsByKeystore()
	require.NoError(t, err)

	require.NotNil(t, accountsMap[hex.EncodeToString(ks1Fingerprint)])
	checkShownLoadedAccountsLen(t, accountsMap[hex.EncodeToString(ks1Fingerprint)], 3)
	require.NotNil(t, accountsMap[hex.EncodeToString(ks2Fingerprint)])
	checkShownLoadedAccountsLen(t, accountsMap[hex.EncodeToString(ks2Fingerprint)], 3)

	b.DeregisterKeystore()
	accountsMap, err = b.AccountsByKeystore()
	require.NoError(t, err)
	require.NotNil(t, accountsMap[hex.EncodeToString(ks1Fingerprint)])
	checkShownLoadedAccountsLen(t, accountsMap[hex.EncodeToString(ks1Fingerprint)], 3)
	require.Nil(t, accountsMap[hex.EncodeToString(ks2Fingerprint)])
}

func TestKeystoresBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	b.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
		accountMock := MockBtcAccount(t, config, coin, gapLimits, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(1e8), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		accountMock := MockEthAccount(config, coin, httpClient, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(1e18), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	ks1 := makeBitBox02Multi()
	ks2 := makeBitBox02Multi()

	ks2.RootFingerprintFunc = keystoreHelper2().RootFingerprint
	ks2.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
	ks2.BTCXPubsFunc = keystoreHelper2().BTCXPubs

	ks1Fingerprint, err := ks1.RootFingerprint()
	require.NoError(t, err)

	ks2Fingerprint, err := ks2.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks1)
	require.NoError(t, b.SetWatchonly(ks1Fingerprint, true))

	// Up to 6 hidden accounts for BTC/LTC are added to be scanned even if the accounts are all
	// empty. Calling this function too many times does not add more than that.
	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	b.DeregisterKeystore()
	b.registerKeystore(ks2)

	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	// This needs to be after all changes in accounts, otherwise it will try to fetch
	// new values and fail.
	b.ratesUpdater = rates.MockRateUpdater()
	defer b.ratesUpdater.Stop()

	keystoresBalance, err := b.keystoresBalance()
	require.NoError(t, err)

	require.NotNil(t, keystoresBalance[hex.EncodeToString(ks1Fingerprint)])
	require.Equal(t, "1.00000000", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeBTC].Amount)
	require.Equal(t, "21.00", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeBTC].Conversions["USD"])
	require.Equal(t, "1.00000000", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeLTC].Amount)
	require.Equal(t, "", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeLTC].Conversions["USD"])
	require.Equal(t, "1", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeETH].Amount)
	require.Equal(t, "1.00", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].CoinsBalance[coinpkg.CodeETH].Conversions["USD"])
	require.Equal(t, "22.00", keystoresBalance[hex.EncodeToString(ks1Fingerprint)].Total)

	require.NotNil(t, keystoresBalance[hex.EncodeToString(ks2Fingerprint)])
	require.Equal(t, "22.00", keystoresBalance[hex.EncodeToString(ks2Fingerprint)].Total)
}

func TestCoinsTotalBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	b.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
		accountMock := MockBtcAccount(t, config, coin, gapLimits, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(1e8), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		accountMock := MockEthAccount(config, coin, httpClient, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(2e18), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	ks1 := makeBitBox02Multi()
	ks2 := makeBitBox02Multi()

	ks2.RootFingerprintFunc = keystoreHelper2().RootFingerprint
	ks2.ExtendedPublicKeyFunc = keystoreHelper2().ExtendedPublicKey
	ks2.BTCXPubsFunc = keystoreHelper2().BTCXPubs

	ks1Fingerprint, err := ks1.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks1)
	require.NoError(t, b.SetWatchonly(ks1Fingerprint, true))

	// Up to 6 hidden accounts for BTC/LTC are added to be scanned even if the accounts are all
	// empty. Calling this function too many times does not add more than that.
	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	b.DeregisterKeystore()
	b.registerKeystore(ks2)

	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	// This needs to be after all changes in accounts, otherwise it will try to fetch
	// new values and fail.
	b.ratesUpdater = rates.MockRateUpdater()
	defer b.ratesUpdater.Stop()

	coinsTotalBalance, err := b.coinsTotalBalance()
	require.NoError(t, err)
	require.Equal(t, coinpkg.CodeBTC, coinsTotalBalance[0].CoinCode)
	require.Equal(t, "2.00000000", coinsTotalBalance[0].FormattedAmount.Amount)
	require.Equal(t, coinpkg.CodeLTC, coinsTotalBalance[1].CoinCode)
	require.Equal(t, "2.00000000", coinsTotalBalance[1].FormattedAmount.Amount)
	require.Equal(t, coinpkg.CodeETH, coinsTotalBalance[2].CoinCode)
	require.Equal(t, "4", coinsTotalBalance[2].FormattedAmount.Amount)
}

func TestAccountsFiatAndCoinBalance(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	b.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
		accountMock := MockBtcAccount(t, config, coin, gapLimits, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(1e8), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		accountMock := MockEthAccount(config, coin, httpClient, log)
		accountMock.BalanceFunc = func() (*accounts.Balance, error) {
			return accounts.NewBalance(coinpkg.NewAmountFromInt64(1e18), coinpkg.NewAmountFromInt64(0)), nil
		}
		return accountMock
	}

	ks1 := makeBitBox02Multi()

	ks1Fingerprint, err := ks1.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks1)
	require.NoError(t, b.SetWatchonly(ks1Fingerprint, true))

	// Up to 6 hidden accounts for BTC/LTC are added to be scanned even if the accounts are all
	// empty. Calling this function too many times does not add more than that.
	for i := 1; i <= 10; i++ {
		b.maybeAddHiddenUnusedAccounts()
	}

	// This needs to be after all changes in accounts, otherwise it will try to fetch
	// new values and fail.
	b.ratesUpdater = rates.MockRateUpdater()
	defer b.ratesUpdater.Stop()

	accountsByKestore, err := b.AccountsByKeystore()
	require.NoError(t, err)

	expectedCurrencies := map[rates.Fiat]string{
		rates.USD: "22.00",
		rates.EUR: "18.90",
		rates.CHF: "19.95",
	}

	accountList, ok := accountsByKestore[hex.EncodeToString(ks1Fingerprint)]
	require.True(t, ok, "Expected accounts for keystore with fingerprint %s", hex.EncodeToString(ks1Fingerprint))

	for currency, expectedBalance := range expectedCurrencies {
		balance, _, err := b.AccountsFiatAndCoinBalance(accountList, string(currency))
		require.NoError(t, err)
		require.Equalf(t, expectedBalance, balance.FloatString(2), "Got balance of %s, expected %s", balance.FloatString(2), expectedBalance)
	}

}

func TestCheckAccountUsed(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	b.tstCheckAccountUsed = nil
	defer b.Close()
	accountMocks := map[accountsTypes.Code]*accountsMocks.InterfaceMock{}
	// A Transactions function that always returns one transaction, so the account is always used.
	txFunc := func() (accounts.OrderedTransactions, error) {
		return accounts.OrderedTransactions{&accounts.TransactionData{}}, nil
	}

	b.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
		accountMock := MockBtcAccount(t, config, coin, gapLimits, log)
		accountMock.TransactionsFunc = txFunc
		accountMocks[config.Config.Code] = accountMock
		return accountMock
	}

	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		accountMock := MockEthAccount(config, coin, httpClient, log)
		accountMock.TransactionsFunc = txFunc
		accountMocks[config.Config.Code] = accountMock
		return accountMock
	}

	ks1 := makeBitBox02Multi()

	ks1Fingerprint, err := ks1.RootFingerprint()
	require.NoError(t, err)

	b.registerKeystore(ks1)
	require.NoError(t, b.SetWatchonly(ks1Fingerprint, true))

	accountsByKestore, err := b.AccountsByKeystore()
	require.NoError(t, err)

	accountList, ok := accountsByKestore[hex.EncodeToString(ks1Fingerprint)]
	require.True(t, ok, "Expected accounts for keystore with fingerprint %s", hex.EncodeToString(ks1Fingerprint))

	// Check all accounts, make sure they are set as used.
	for _, acct := range accountList {
		mock, ok := accountMocks[acct.Config().Config.Code]
		require.True(t, ok, "No mock for account %s", acct.Config().Config.Code)

		b.checkAccountUsed(acct)
		// Ensure that Transactions is called
		require.Len(t, mock.TransactionsCalls(), 1)
		require.True(t, acct.Config().Config.Used)

		// Call checkAccountUsed again, Transactions should not be called again.
		b.checkAccountUsed(acct)
		require.Len(t, mock.TransactionsCalls(), 1)
		// And Used should still be true.
		require.True(t, acct.Config().Config.Used)
	}

}
