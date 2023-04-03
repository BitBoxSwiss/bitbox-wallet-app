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
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMocks "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	keystoremock "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/software"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
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

func mustXKey(key string) *hdkeychain.ExtendedKey {
	xkey, err := hdkeychain.NewKeyFromString(key)
	if err != nil {
		panic(err)
	}
	return xkey
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
		{Code: "acct-goeth", CoinCode: coinpkg.CodeGOETH},
		{Code: "acct-ltc", CoinCode: coinpkg.CodeLTC},
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
		"acct-goeth",
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

const (
	testnetEnabled  = true
	testnetDisabled = false
	regtestEnabled  = true
	regtestDisabled = false
)

type environment struct{}

func (e environment) NotifyUser(msg string) {
}

func (e environment) DeviceInfos() []usb.DeviceInfo {
	return []usb.DeviceInfo{}
}

func (e environment) SystemOpen(url string) error {
	return nil
}

func (e environment) UsingMobileData() bool {
	return false
}

func (e environment) NativeLocale() string {
	return ""
}

func (e environment) GetSaveFilename(string) string {
	return ""
}

type mockTransactionsSource struct {
}

func (m *mockTransactionsSource) Transactions(
	blockTipHeight *big.Int,
	address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
	[]*accounts.TransactionData, error) {
	return []*accounts.TransactionData{}, nil
}

func (e environment) SetDarkTheme(bool) {
	// nothing to do here.
}

func newBackend(t *testing.T, testing, regtest bool) *Backend {
	t.Helper()
	b, err := NewBackend(
		arguments.NewArguments(
			test.TstTempDir("appfolder"),
			testing, regtest,
			true,
			&types.GapLimits{Receive: 20, Change: 6}),
		environment{},
	)
	b.ratesUpdater.SetCoingeckoURL("unused") // avoid hitting real API

	// avoid hitting real API for BTC coins.
	for _, code := range []coinpkg.Code{
		coinpkg.CodeBTC,
		coinpkg.CodeTBTC,
		coinpkg.CodeRBTC,
		coinpkg.CodeLTC,
		coinpkg.CodeTLTC,
	} {
		c, err := b.Coin(code)
		require.NoError(t, err)
		c.(*btc.Coin).TstSetMakeBlockchain(func() blockchain.Interface {
			return &blockchainMocks.BlockchainMock{}
		})
	}

	// avoid hitting real API for ETH coins.
	for _, code := range []coinpkg.Code{
		coinpkg.CodeETH,
		coinpkg.CodeGOETH,
	} {
		c, err := b.Coin(code)
		require.NoError(t, err)
		c.(*eth.Coin).TstSetClient(&mocks.InterfaceMock{
			EstimateGasFunc: func(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
				return 21000, nil
			},
			BlockNumberFunc: func(ctx context.Context) (*big.Int, error) {
				return big.NewInt(100), nil
			},
			BalanceFunc: func(ctx context.Context, account common.Address) (*big.Int, error) {
				return big.NewInt(1e18), nil
			},
			PendingNonceAtFunc: func(ctx context.Context, account common.Address) (uint64, error) {
				return 0, nil
			},
		})
		c.(*eth.Coin).TstSetTransactionsSource(&mockTransactionsSource{})
	}
	require.NoError(t, err)
	return b
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
			[]coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeGOETH},
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
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	fingerprint := []byte{0x55, 0x055, 0x55, 0x55}

	// A keystore with a similar config to a BitBox02 - supporting unified and multiple accounts, no
	// legacy P2PKH.
	bitbox02LikeKeystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
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
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	// A keystore with a similar config to a BitBox01 - supports legacy P2PKH, but no unified
	// accounts or multiple accounts. Ethereum is also not supported.
	bitbox01LikeKeystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				return meta.(signing.ScriptType) != signing.ScriptTypeP2TR
			default:
				return false
			}
		},
		SupportsMultipleAccountsFunc: func() bool {
			return false
		},
		SupportsUnifiedAccountsFunc: func() bool {
			return false
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	// Add a few accounts with BB02.
	t.Run("bitbox02Like", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		// Add a Bitcoin account.
		acctCode, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 1",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-btc-0", string(acctCode))

		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 1",
				Code:     "v0-55555555-btc-0",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/0'/0'"), mustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, fingerprint, mustKeypath("m/86'/0'/0'"), mustXKey("xpub6CC9Tsi4eJvmRsGuXwKBfHDWUWN66voNeZFmXRJhYZS6yYgXKZmtz5qnxK9WL2FZP8uF3abyFZ29d7RfMks4FjCCu4LMh3edyeCoyEFuZLZ")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/0'/0'"), mustXKey("xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"),
		)

		// Add a Litecoin account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeLTC,
			"litecoin 1",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-ltc-0", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "ltc",
				Name:     "litecoin 1",
				Code:     "v0-55555555-ltc-0",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/2'/0'"), mustXKey("xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/2'/0'"), mustXKey("xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"),
		)

		// Add an Ethereum account.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeETH,
			"ethereum 1",
			bitbox02LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-eth-0", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "eth",
				Name:     "ethereum 1",
				Code:     "v0-55555555-eth-0",
				Configurations: signing.Configurations{
					signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/0"), mustXKey("xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"),
		)

		// Add another Bitcoin account.
		acctCode, err = b.CreateAndPersistAccountConfig(
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
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/0'/1'"), mustXKey("xpub6Cxa67Bfe1Aw7YVtdqKPYLhSkf7omb7WkGXQzof15VXbAZKVct1caHHK55UQN2Fnojbp2okiBCbGXyQSRzMQ6XKJJeeM2jAt6FR8K8ckA88")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, fingerprint, mustKeypath("m/86'/0'/1'"), mustXKey("xpub6CC9Tsi4eJvmSBj5xoU4sKnFGF9nF8qwExB3axxu2F7oWKFH5RucWQUfrgVGfnTDr6p5acBGpAqAMKb2A7ek8SbAUvDEXtvj37pM1S9X2km")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/0'/1'"), mustXKey("xpub6CUmEcJb7juvpvNs2hKMc9BP1n82ixzUb4jyHUdYzSLmnXru3nb4hhGsfS23WRx8hgJLxMxZ7WcBGzTiYfiANUQZe3TVFghLrxvA2Ls7u4a")),
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
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/2'/1'"), mustXKey("xpub6DReBHtKxgeZJJrrhPEHz9kzEZU1BaQ4kPQ2J1tfjA9DMBKT2bor1ynoAPCsxdyJyZrYK5YsYmkknV5KPtpKeVb2HMX6iQ9wjpAhNSANGiA")),
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/2'/1'"), mustXKey("xpub6CrhULuXbYzo8Lk2iJY5dr6mWjHBKQuohcP99HcioFiouGuEBWEJDMbgLDD89hvJiT1wD94FnuQcSzE4QsxWDv2AQbiitk7EbNvE8mmT17M")),
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
				Configurations: signing.Configurations{
					signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/1"), mustXKey("xpub6GP83vJASH1kUpndXSe3e942omyTYSPKaav6shfic7Lc3rFJR9ctA3AXaTf7rX7PuSZNUnaqj4hiqgnRXr26jitBz4jLhmFURtVxDykHbQm")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-eth-1"),
		)
	})

	// Add a few accounts with BB01.
	t.Run("bitbox01Like", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		// Add a Bitcoin account - it is exploded into three individual accounts as the BB01 does
		// not support unified accounts.
		acctCode, err := b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 1",
			bitbox01LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-btc-0", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 1: bech32",
				Code:     "v0-55555555-btc-0-p2wpkh",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/0'/0'"), mustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-0-p2wpkh"),
		)
		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 1",
				Code:     "v0-55555555-btc-0-p2wpkh-p2sh",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/0'/0'"), mustXKey("xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-0-p2wpkh-p2sh"),
		)
		require.Equal(t,
			&config.Account{
				CoinCode: "btc",
				Name:     "bitcoin 1: legacy",
				Code:     "v0-55555555-btc-0-p2pkh",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2PKH, fingerprint, mustKeypath("m/44'/0'/0'"), mustXKey("xpub6D7KuxJsw7N2LtWPQKy6Tqs8vFyKudiDqcx6mtsFXT6FDb8oLcUYRjf7G4Qx8CK4DAQ4kN98n7uDCKmazxaHYLNjwDbJ1nKmDm6QEQCwkGC")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-btc-0-p2pkh"),
		)

		// Add a Litecoin account - it is exploded into two individual accounts as the BB01 does
		// not support unified accounts, and we don't do P2PKH for Litecoin even with the BB01.
		acctCode, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeLTC,
			"litecoin 1",
			bitbox01LikeKeystore,
		)
		require.NoError(t, err)
		require.Equal(t, "v0-55555555-ltc-0", string(acctCode))
		require.Equal(t,
			&config.Account{
				CoinCode: "ltc",
				Name:     "litecoin 1: bech32",
				Code:     "v0-55555555-ltc-0-p2wpkh",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/2'/0'"), mustXKey("xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0-p2wpkh"),
		)
		require.Equal(t,
			&config.Account{
				CoinCode: "ltc",
				Name:     "litecoin 1",
				Code:     "v0-55555555-ltc-0-p2wpkh-p2sh",
				Configurations: signing.Configurations{
					signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKHP2SH, fingerprint, mustKeypath("m/49'/2'/0'"), mustXKey("xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ")),
				},
			},
			b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0-p2wpkh-p2sh"),
		)
		// We never supported P2PKH in Litecoin,
		require.Nil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0-p2pkh"))

		// Number of accounts stays the same - this is to make the unit test a bit more robust.
		accountsCount := len(b.Config().AccountsConfig().Accounts)
		// Try to add an Ethereum account - can't, not supported.
		_, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeETH,
			"ethereum 1",
			bitbox01LikeKeystore,
		)
		require.NoError(t, err)
		require.Nil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))
		require.Equal(t, accountsCount, len(b.Config().AccountsConfig().Accounts))

		// Try to add another Bitcoin account - can't, only one account supported.
		_, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeBTC,
			"bitcoin 2",
			bitbox01LikeKeystore,
		)
		require.Equal(t, ErrAccountLimitReached, errp.Cause(err))
		require.Equal(t, accountsCount, len(b.Config().AccountsConfig().Accounts))

		// Try to add another Litecoin account - can't, only one account supported.
		_, err = b.CreateAndPersistAccountConfig(
			coinpkg.CodeLTC,
			"litecoin 2",
			bitbox01LikeKeystore,
		)
		require.Equal(t, ErrAccountLimitReached, errp.Cause(err))
		require.Equal(t, accountsCount, len(b.Config().AccountsConfig().Accounts))
	})

	// If the keystore cannot retrieve an xpub (e.g. USB communication error), no account should be
	// added.
	t.Run("xpub-error", func(t *testing.T) {
		b := newBackend(t, testnetDisabled, regtestDisabled)
		defer b.Close()

		expectedErr := errors.New("failed getting xpub")
		// Keystore has a problem getting the xpub.
		ks := &keystoremock.KeystoreMock{
			RootFingerprintFunc: func() ([]byte, error) {
				return fingerprint, nil
			},
			SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
				return true
			},
			SupportsMultipleAccountsFunc: func() bool {
				return true
			},
			SupportsUnifiedAccountsFunc: func() bool {
				return true
			},
			ExtendedPublicKeyFunc: func(coin coinpkg.Coin, absoluteKeypath signing.AbsoluteKeypath,
			) (*hdkeychain.ExtendedKey, error) {
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

	require.Equal(t, []accounts.Interface{}, b.Accounts())

	// Add a Bitcoin account.
	coin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)
	b.createAndAddAccount(coin, "test-btc-account-code", "Bitcoin account name",
		signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/0'/0'"), mustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")),
		},
		true,
		nil,
	)
	require.Len(t, b.Accounts(), 1)
	// Check some properties of the newly added account.
	acct := b.Accounts()[0]
	_, ok := acct.(*btc.Account)
	require.True(t, ok)
	require.Equal(t, accounts.Code("test-btc-account-code"), acct.Config().Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Bitcoin account name", acct.Config().Name)

	// Add a Litecoin account.
	coin, err = b.Coin(coinpkg.CodeLTC)
	require.NoError(t, err)
	b.createAndAddAccount(coin, "test-ltc-account-code", "Litecoin account name",
		signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath("m/84'/2'/0'"), mustXKey("xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP")),
		},
		true,
		nil,
	)
	require.Len(t, b.Accounts(), 2)
	// Check some properties of the newly added account.
	acct = b.Accounts()[1]
	_, ok = acct.(*btc.Account)
	require.True(t, ok)
	require.Equal(t, accounts.Code("test-ltc-account-code"), acct.Config().Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Litecoin account name", acct.Config().Name)

	// Add an Ethereum account with some active ERC20 tokens..
	coin, err = b.Coin(coinpkg.CodeETH)
	require.NoError(t, err)
	b.createAndAddAccount(coin, "test-eth-account-code", "Ethereum account name",
		signing.Configurations{
			signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/0"), mustXKey("xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E")),
		},
		true,
		[]string{"eth-erc20-mkr"},
	)
	// 2 more accounts: the added ETH account plus the active token for the ETH account.
	require.Len(t, b.Accounts(), 4)
	// Check some properties of the newly added account.
	acct = b.Accounts()[2]
	_, ok = acct.(*eth.Account)
	require.True(t, ok)
	require.Nil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accounts.Code("test-eth-account-code"), acct.Config().Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Ethereum account name", acct.Config().Name)
	acct = b.Accounts()[3]
	_, ok = acct.(*eth.Account)
	require.True(t, ok)
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accounts.Code("test-eth-account-code-eth-erc20-mkr"), acct.Config().Code)
	require.Equal(t, "Maker", acct.Config().Name)

	// Add another Ethereum account with some active ERC20 tokens.
	coin, err = b.Coin(coinpkg.CodeETH)
	require.NoError(t, err)
	b.createAndAddAccount(coin, "test-eth-account-code-2", "Ethereum account name 2",
		signing.Configurations{
			signing.NewEthereumConfiguration(fingerprint, mustKeypath("m/44'/60'/0'/0/1"), mustXKey("xpub6GP83vJASH1kUpndXSe3e942omyTYSPKaav6shfic7Lc3rFJR9ctA3AXaTf7rX7PuSZNUnaqj4hiqgnRXr26jitBz4jLhmFURtVxDykHbQm")),
		},
		true,
		[]string{"eth-erc20-usdt", "eth-erc20-bat"},
	)
	// 3 more accounts: the added ETH account plus the two active tokens for the ETH account.
	require.Len(t, b.Accounts(), 7)
	// Check some properties of the newly added accounts.
	acct = b.Accounts()[4]
	_, ok = acct.(*eth.Account)
	require.True(t, ok)
	require.Nil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accounts.Code("test-eth-account-code-2"), acct.Config().Code)
	require.Equal(t, coin, acct.Coin())
	require.Equal(t, "Ethereum account name 2", acct.Config().Name)
	acct = b.Accounts()[5]
	_, ok = acct.(*eth.Account)
	require.True(t, ok)
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accounts.Code("test-eth-account-code-2-eth-erc20-usdt"), acct.Config().Code)
	require.Equal(t, "Tether USD 2", acct.Config().Name)
	acct = b.Accounts()[6]
	_, ok = acct.(*eth.Account)
	require.True(t, ok)
	require.NotNil(t, acct.Coin().(*eth.Coin).ERC20Token())
	require.Equal(t, accounts.Code("test-eth-account-code-2-eth-erc20-bat"), acct.Config().Code)
	require.Equal(t, "Basic Attention Token 2", acct.Config().Name)
}

// TestAccountSupported tests that only accounts supported by a keystore are 1) persisted when the
// keystore is first registered 2) loaded when the keytore is registered.
// The second point is important because it's possible to use e.g. a BitBox02-Multi and a
// Bitbox02-btconly with the same seed, so we shouldn't load all persisted accounts without checking.
func TestAccountSupported(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)

	fingerprint := []byte{0x55, 0x055, 0x55, 0x55}
	bb02Multi := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}
	bb02BtcOnly := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
		},
		SupportsAccountFunc: func(coin coinpkg.Coin, meta interface{}) bool {
			switch coin.(type) {
			case *btc.Coin:
				scriptType := meta.(signing.ScriptType)
				return coin.Code() == coinpkg.CodeBTC && scriptType != signing.ScriptTypeP2PKH
			default:
				return false
			}
		},
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bb02Multi)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)

	b.DeregisterKeystore()
	// Registering a Bitcoin-only like keystore loads only the Bitcoin account, even though altcoins
	// were persisted previously.
	b.registerKeystore(bb02BtcOnly)
	require.Len(t, b.Accounts(), 1)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
}

func TestInactiveAccount(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	fingerprint := []byte{0x55, 0x055, 0x55, 0x55}

	// A keystore with a similar config to a BitBox02 - supporting unified and multiple accounts, no
	// legacy P2PKH.
	bitbox02LikeKeystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
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
		SupportsMultipleAccountsFunc: func() bool {
			return true
		},
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bitbox02LikeKeystore)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.True(t, lookup(b.Accounts(), "v0-55555555-btc-0").Config().Active)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-ltc-0").Inactive)
	require.True(t, lookup(b.Accounts(), "v0-55555555-ltc-0").Config().Active)
	require.NotNil(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0"))
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-eth-0").Inactive)
	require.True(t, lookup(b.Accounts(), "v0-55555555-eth-0").Config().Active)

	// Deactive an account.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", false))
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.True(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.False(t, lookup(b.Accounts(), "v0-55555555-btc-0").Config().Active)

	// Reactivate.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", true))
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.False(t, b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Inactive)
	require.True(t, lookup(b.Accounts(), "v0-55555555-btc-0").Config().Active)

	// Deactivating an ETH account with tokens also removes the tokens
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", true))
	require.NoError(t, b.SetTokenActive("v0-55555555-eth-0", "eth-erc20-bat", true))
	require.Len(t, b.Accounts(), 5)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	require.Len(t, b.Accounts(), 5)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.False(t, lookup(b.Accounts(), "v0-55555555-eth-0").Config().Active)
	require.False(t, lookup(b.Accounts(), "v0-55555555-eth-0-eth-erc20-usdt").Config().Active)
	require.False(t, lookup(b.Accounts(), "v0-55555555-eth-0-eth-erc20-bat").Config().Active)
	// Reactivating restores them again.
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", true))
	require.Len(t, b.Accounts(), 5)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	require.True(t, lookup(b.Accounts(), "v0-55555555-eth-0").Config().Active)
	require.True(t, lookup(b.Accounts(), "v0-55555555-eth-0-eth-erc20-usdt").Config().Active)
	require.True(t, lookup(b.Accounts(), "v0-55555555-eth-0-eth-erc20-bat").Config().Active)

	// Deactivate all accounts.
	require.NoError(t, b.SetAccountActive("v0-55555555-btc-0", false))
	require.NoError(t, b.SetAccountActive("v0-55555555-ltc-0", false))
	require.NoError(t, b.SetAccountActive("v0-55555555-eth-0", false))
	require.Len(t, b.Accounts(), 5)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)

	// Re-registering the keystore (i.e. replugging the device) ends in the same state: no
	// additional accounts created.
	b.DeregisterKeystore()
	b.registerKeystore(bitbox02LikeKeystore)
	require.Len(t, b.Accounts(), 5)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
}

// Test that taproot subaccounts are added if a keytore gains taproot support (e.g. BitBox02 gained
// taproot support in v9.10.0)
func TestTaprootUpgrade(t *testing.T) {
	// From mnemonic: wisdom minute home employ west tail liquid mad deal catalog narrow mistake
	rootKey := mustXKey("xprv9s21ZrQH143K3gie3VFLgx8JcmqZNsBcBc6vAdJrsf4bPRhx69U8qZe3EYAyvRWyQdEfz7ZpyYtL8jW2d2Lfkfh6g2zivq8JdZPQqxoxLwB")
	keystoreHelper := software.NewKeystore(rootKey)
	fingerprint := []byte{0x55, 0x055, 0x55, 0x55}

	bitbox02NoTaproot := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}
	bitbox02Taproot := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
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
		SupportsUnifiedAccountsFunc: func() bool {
			return true
		},
		ExtendedPublicKeyFunc: keystoreHelper.ExtendedPublicKey,
	}

	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	// 1) Registering a new keystore persists a set of initial default accounts.
	b.registerKeystore(bitbox02NoTaproot)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	btcAccount := lookup(b.Accounts(), "v0-55555555-btc-0")
	require.NotNil(t, btcAccount)
	ltcAccount := lookup(b.Accounts(), "v0-55555555-ltc-0")
	require.NotNil(t, ltcAccount)
	require.Equal(t, coinpkg.CodeBTC, btcAccount.Coin().Code())
	require.Len(t, btcAccount.Config().SigningConfigurations, 2)
	require.Len(t, ltcAccount.Config().SigningConfigurations, 2)
	require.Equal(t,
		signing.ScriptTypeP2WPKH, btcAccount.Config().SigningConfigurations[0].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2WPKHP2SH, btcAccount.Config().SigningConfigurations[1].ScriptType())
	// Same for the persisted account config.
	require.Equal(t,
		btcAccount.Config().SigningConfigurations,
		b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Configurations)

	// "Unplug", then insert an updated keystore with taproot support.
	b.DeregisterKeystore()
	b.registerKeystore(bitbox02Taproot)
	require.Len(t, b.Accounts(), 3)
	require.Len(t, b.Config().AccountsConfig().Accounts, 3)
	btcAccount = lookup(b.Accounts(), "v0-55555555-btc-0")
	require.NotNil(t, btcAccount)
	ltcAccount = lookup(b.Accounts(), "v0-55555555-ltc-0")
	require.NotNil(t, ltcAccount)
	require.Equal(t, coinpkg.CodeBTC, b.Accounts()[0].Coin().Code())
	require.Len(t, btcAccount.Config().SigningConfigurations, 3)
	// LTC (coin with no taproot support) unchanged.
	require.Len(t, ltcAccount.Config().SigningConfigurations, 2)
	require.Equal(t,
		signing.ScriptTypeP2WPKH, btcAccount.Config().SigningConfigurations[0].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2WPKHP2SH, btcAccount.Config().SigningConfigurations[1].ScriptType())
	require.Equal(t,
		signing.ScriptTypeP2TR, btcAccount.Config().SigningConfigurations[2].ScriptType())
	// Same for the persisted account config.
	require.Equal(t,
		btcAccount.Config().SigningConfigurations,
		b.Config().AccountsConfig().Lookup("v0-55555555-btc-0").Configurations)
}
