// SPDX-License-Identifier: Apache-2.0

package accountbuilder

import (
	"errors"
	"fmt"
	"io"
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

var fingerprint = []byte{0x55, 0x55, 0x55, 0x55}

func testCoin(code coinpkg.Code) coinpkg.Coin {
	return &coinmock.CoinMock{
		CodeFunc: func() coinpkg.Code { return code },
		NameFunc: func() string { return "Test coin" },
	}
}

func testBuilder(resolve func(coinpkg.Code) (coinpkg.Coin, error)) *Builder {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return New(resolve, logrus.NewEntry(logger))
}

func testXPub() *hdkeychain.ExtendedKey {
	return test.TstMustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn")
}

func mustKeypath(t *testing.T, path string) signing.AbsoluteKeypath {
	t.Helper()
	keypath, err := signing.NewAbsoluteKeypath(path)
	require.NoError(t, err)
	return keypath
}

func TestBuildBitcoinFiltersScriptsAndBatchesKeysInOrder(t *testing.T) {
	coin := testCoin(coinpkg.CodeBTC)
	var calls []string
	builder := testBuilder(func(code coinpkg.Code) (coinpkg.Coin, error) {
		calls = append(calls, "coin")
		require.Equal(t, coinpkg.CodeBTC, code)
		return coin, nil
	})
	expectedPaths := []string{"m/84'/0'/7'", "m/49'/0'/7'", "m/44'/0'/7'"}
	expectedScripts := []signing.ScriptType{
		signing.ScriptTypeP2WPKH, signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2PKH,
	}
	var xpubs []*hdkeychain.ExtendedKey
	keystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			calls = append(calls, "fingerprint")
			return fingerprint, nil
		},
		SupportsAccountFunc: func(actualCoin coinpkg.Coin, meta interface{}) bool {
			require.Same(t, coin, actualCoin)
			calls = append(calls, "supports:"+string(meta.(signing.ScriptType)))
			return meta != signing.ScriptTypeP2TR
		},
		BTCXPubsFunc: func(actualCoin coinpkg.Coin, paths []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error) {
			calls = append(calls, "xpubs")
			require.Same(t, coin, actualCoin)
			require.Len(t, paths, len(expectedPaths))
			for i, path := range paths {
				require.Equal(t, expectedPaths[i], path.Encode())
				key, err := testXPub().Derive(uint32(i))
				require.NoError(t, err)
				xpubs = append(xpubs, key)
			}
			return xpubs, nil
		},
	}
	code, record, err := builder.Build(coinpkg.CodeBTC, 7, true, "My Bitcoin", keystore, []string{"ignored"})
	require.NoError(t, err)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-7"), code)
	expected := &config.Account{
		Code: code, CoinCode: coinpkg.CodeBTC, Name: "My Bitcoin", HiddenBecauseUnused: true,
	}
	for i, path := range expectedPaths {
		expected.SigningConfigurations = append(expected.SigningConfigurations,
			signing.NewBitcoinConfiguration(expectedScripts[i], fingerprint, mustKeypath(t, path), xpubs[i]))
	}
	require.Equal(t, expected, record)
	require.Equal(t, []string{
		"fingerprint", "coin",
		"supports:" + string(signing.ScriptTypeP2WPKH), "supports:" + string(signing.ScriptTypeP2TR),
		"supports:" + string(signing.ScriptTypeP2WPKHP2SH), "supports:" + string(signing.ScriptTypeP2PKH), "xpubs",
	}, calls)
}

func TestBuildEthereum(t *testing.T) {
	for _, tc := range []struct {
		coinCode coinpkg.Code
		number   uint16
		path     string
		name     string
	}{
		{coinpkg.CodeETH, 0, "m/44'/60'/0'/0/0", "Test coin"},
		{coinpkg.CodeSEPETH, 7, "m/44'/1'/0'/0/7", "Test coin 8"},
	} {
		t.Run(string(tc.coinCode), func(t *testing.T) {
			coin := testCoin(tc.coinCode)
			builder := testBuilder(func(code coinpkg.Code) (coinpkg.Coin, error) {
				require.Equal(t, tc.coinCode, code)
				return coin, nil
			})
			xpub := testXPub()
			keystore := &keystoremock.KeystoreMock{
				RootFingerprintFunc: func() ([]byte, error) { return fingerprint, nil },
				SupportsAccountFunc: func(actualCoin coinpkg.Coin, meta interface{}) bool {
					require.Same(t, coin, actualCoin)
					require.Nil(t, meta)
					return true
				},
				ExtendedPublicKeyFunc: func(actualCoin coinpkg.Coin, path signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
					require.Same(t, coin, actualCoin)
					require.Equal(t, tc.path, path.Encode())
					return xpub, nil
				},
			}
			tokens := []string{"eth-erc20-usdt", "eth-erc20-bat"}
			code, record, err := builder.Build(tc.coinCode, tc.number, false, "", keystore, tokens)
			require.NoError(t, err)
			require.Equal(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-%s-%d", tc.coinCode, tc.number)), code)
			require.Equal(t, &config.Account{
				Code: code, CoinCode: tc.coinCode, Name: tc.name, ActiveTokens: tokens,
				SigningConfigurations: signing.Configurations{
					signing.NewEthereumConfiguration(fingerprint, mustKeypath(t, tc.path), xpub),
				},
			}, record)
			require.Len(t, keystore.RootFingerprintCalls(), 1)
			require.Len(t, keystore.SupportsAccountCalls(), 1)
			require.Len(t, keystore.ExtendedPublicKeyCalls(), 1)
		})
	}
}

func TestBuildUnsupportedAccountsAndFailures(t *testing.T) {
	expectedErr := errors.New("preparation failed")
	for _, stage := range []string{"fingerprint", "coin", "derivation", "unsupported-btc", "unsupported-eth", "xpubs", "xpub"} {
		t.Run(stage, func(t *testing.T) {
			coinCode := coinpkg.CodeBTC
			if stage == "unsupported-eth" || stage == "xpub" {
				coinCode = coinpkg.CodeETH
			}
			if stage == "derivation" {
				coinCode = "unknown"
			}
			builder := testBuilder(func(code coinpkg.Code) (coinpkg.Coin, error) {
				require.NotEqual(t, "fingerprint", stage)
				if stage == "coin" {
					return nil, expectedErr
				}
				return testCoin(code), nil
			})
			keystore := &keystoremock.KeystoreMock{
				RootFingerprintFunc: func() ([]byte, error) {
					if stage == "fingerprint" {
						return nil, expectedErr
					}
					return fingerprint, nil
				},
				SupportsAccountFunc: func(coinpkg.Coin, interface{}) bool {
					return stage != "unsupported-btc" && stage != "unsupported-eth"
				},
				BTCXPubsFunc: func(coinpkg.Coin, []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error) {
					require.Equal(t, "xpubs", stage)
					return nil, expectedErr
				},
				ExtendedPublicKeyFunc: func(coinpkg.Coin, signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
					require.Equal(t, "xpub", stage)
					return nil, expectedErr
				},
			}
			code, record, err := builder.Build(coinCode, 0, false, "", keystore, nil)
			require.Nil(t, record)
			switch stage {
			case "unsupported-btc", "unsupported-eth":
				require.NoError(t, err)
			case "derivation":
				require.EqualError(t, err, "Unrecognized coin code: unknown")
			default:
				require.Same(t, expectedErr, err)
			}
			switch stage {
			case "fingerprint", "coin", "derivation":
				require.Empty(t, code)
				require.Empty(t, keystore.SupportsAccountCalls())
			default:
				require.Equal(t, accountsTypes.Code(fmt.Sprintf("v0-55555555-%s-0", coinCode)), code)
			}
		})
	}
}

func taprootRecord(t *testing.T, code string, coinCode coinpkg.Code, path string) *config.Account {
	t.Helper()
	return &config.Account{
		Code: accountsTypes.Code(code), CoinCode: coinCode, Name: code,
		SigningConfigurations: signing.Configurations{
			signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, fingerprint, mustKeypath(t, path), testXPub()),
		},
	}
}

func TestAddTaproot(t *testing.T) {
	records := []*config.Account{
		taprootRecord(t, "ltc", coinpkg.CodeLTC, "m/84'/2'/0'"),
		taprootRecord(t, "btc", coinpkg.CodeBTC, "m/84'/0'/2'"),
		taprootRecord(t, "tbtc", coinpkg.CodeTBTC, "m/84'/1'/3'"),
		taprootRecord(t, "rbtc", coinpkg.CodeRBTC, "m/84'/1'/4'"),
		{Code: "eth", CoinCode: coinpkg.CodeETH},
	}
	builder := testBuilder(func(code coinpkg.Code) (coinpkg.Coin, error) {
		require.NotEqual(t, coinpkg.CodeLTC, code)
		require.NotEqual(t, coinpkg.CodeETH, code)
		return testCoin(code), nil
	})
	var paths []string
	xpub := testXPub()
	keystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) { return fingerprint, nil },
		SupportsAccountFunc: func(coinpkg.Coin, interface{}) bool { return true },
		ExtendedPublicKeyFunc: func(_ coinpkg.Coin, path signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
			paths = append(paths, path.Encode())
			return xpub, nil
		},
	}
	changed, err := builder.AddTaproot(keystore, records)
	require.NoError(t, err)
	require.Equal(t, []accountsTypes.Code{"btc", "tbtc", "rbtc"}, changed)
	require.Equal(t, []string{"m/86'/0'/2'", "m/86'/1'/3'", "m/86'/1'/4'"}, paths)
	require.Len(t, records[0].SigningConfigurations, 1)
	require.Empty(t, records[4].SigningConfigurations)
	for i, record := range records[1:4] {
		require.Len(t, record.SigningConfigurations, 2)
		require.Equal(t, signing.ScriptTypeP2WPKH, record.SigningConfigurations[0].ScriptType())
		require.Equal(t, signing.NewBitcoinConfiguration(signing.ScriptTypeP2TR, fingerprint, mustKeypath(t, paths[i]), xpub), record.SigningConfigurations[1])
	}
	changed, err = builder.AddTaproot(keystore, records)
	require.NoError(t, err)
	require.Nil(t, changed)
	require.Len(t, keystore.ExtendedPublicKeyCalls(), 3)
	require.Len(t, keystore.RootFingerprintCalls(), 3)
}

func TestAddTaprootFailureLeavesOnlyPreparedRecordsChanged(t *testing.T) {
	records := []*config.Account{
		taprootRecord(t, "first", coinpkg.CodeBTC, "m/84'/0'/0'"),
		taprootRecord(t, "second", coinpkg.CodeBTC, "m/84'/0'/1'"),
		taprootRecord(t, "third", coinpkg.CodeBTC, "m/84'/0'/2'"),
	}
	builder := testBuilder(func(code coinpkg.Code) (coinpkg.Coin, error) { return testCoin(code), nil })
	expectedErr := errors.New("hardware disconnected")
	keystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) { return fingerprint, nil },
		SupportsAccountFunc: func(coinpkg.Coin, interface{}) bool { return true },
		ExtendedPublicKeyFunc: func(_ coinpkg.Coin, path signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
			if path.Encode() == "m/86'/0'/0'" {
				return testXPub(), nil
			}
			return nil, expectedErr
		},
	}
	changed, err := builder.AddTaproot(keystore, records)
	require.Same(t, expectedErr, err)
	require.Nil(t, changed)
	require.Len(t, records[0].SigningConfigurations, 2)
	require.Len(t, records[1].SigningConfigurations, 1)
	require.Len(t, records[2].SigningConfigurations, 1)
	require.Len(t, keystore.ExtendedPublicKeyCalls(), 2)
}
