// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func planningAccount(
	code string,
	coinCode coinpkg.Code,
	rootFingerprint []byte,
	accountNumber uint32,
) *config.Account {
	return &config.Account{
		Code:     accountsTypes.Code(code),
		CoinCode: coinCode,
		SigningConfigurations: signing.Configurations{
			signing.NewBitcoinConfiguration(
				signing.ScriptTypeP2WPKH,
				rootFingerprint,
				signing.NewAbsoluteKeypathFromUint32(
					84+hardenedKeystart,
					hardenedKeystart,
					accountNumber+hardenedKeystart,
				),
				test.TstMustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn"),
			),
		},
	}
}

func planningAccountWithInvalidAccountNumber(
	code string,
	coinCode coinpkg.Code,
	rootFingerprint []byte,
) *config.Account {
	return &config.Account{
		Code:     accountsTypes.Code(code),
		CoinCode: coinCode,
		SigningConfigurations: signing.Configurations{
			signing.NewBitcoinConfiguration(
				signing.ScriptTypeP2WPKH,
				rootFingerprint,
				mustKeypath("m/84'/0'/0/1"),
				test.TstMustXKey("xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn"),
			),
		},
	}
}

func TestNextAccountNumber(t *testing.T) {
	fingerprintEmpty := []byte{0x77, 0x77, 0x77, 0x77}
	ks := func(fingerprint []byte) *keystoremock.KeystoreMock {
		return &keystoremock.KeystoreMock{
			SupportsCoinFunc: func(coin coinpkg.Coin) bool {
				return true
			},
			RootFingerprintFunc: func() ([]byte, error) {
				return fingerprint, nil
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

	num, err := nextAccountNumber(coinpkg.CodeTBTC, ks(fingerprintEmpty), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(0), num)

	num, err = nextAccountNumber(coinpkg.CodeBTC, ks(rootFingerprint1), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(1), num)

	num, err = nextAccountNumber(coinpkg.CodeTBTC, ks(rootFingerprint1), accountsConfig)
	require.NoError(t, err)
	require.Equal(t, uint16(4), num)

	_, err = nextAccountNumber(coinpkg.CodeTBTC, ks(rootFingerprint2), accountsConfig)
	require.Equal(t, errAccountLimitReached, errp.Cause(err))
}

func TestAccountCandidates(t *testing.T) {
	accountsConfig := &config.AccountsConfig{
		Accounts: []*config.Account{
			planningAccount("btc-0", coinpkg.CodeBTC, rootFingerprint1, 0),
			planningAccount("btc-other-fingerprint", coinpkg.CodeBTC, rootFingerprint2, 1),
			planningAccount("ltc-2", coinpkg.CodeLTC, rootFingerprint1, 2),
			planningAccountWithInvalidAccountNumber("btc-invalid-account-number", coinpkg.CodeBTC, rootFingerprint1),
			{Code: "btc-no-config", CoinCode: coinpkg.CodeBTC},
			planningAccount("btc-3", coinpkg.CodeBTC, rootFingerprint1, 3),
		},
	}

	candidates := accountCandidates(accountsConfig, rootFingerprint1, coinpkg.CodeBTC)
	require.Equal(t, []accountCandidate{
		{account: accountsConfig.Accounts[0], number: 0},
		{account: accountsConfig.Accounts[5], number: 3},
	}, candidates)
}

func TestLowestHiddenAccount(t *testing.T) {
	account0 := &config.Account{Code: "account-0"}
	account1 := &config.Account{Code: "account-1", HiddenBecauseUnused: true}
	account3 := &config.Account{Code: "account-3", HiddenBecauseUnused: true}

	require.Equal(t, account1, lowestHiddenAccount([]accountCandidate{
		{account: account3, number: 3},
		{account: account0, number: 0},
		{account: account1, number: 1},
	}))
	require.Nil(t, lowestHiddenAccount([]accountCandidate{
		{account: account0, number: 0},
	}))
}

func TestNextManualAccountNumber(t *testing.T) {
	account0 := &config.Account{Code: "account-0"}
	account3 := &config.Account{Code: "account-3"}
	account5 := &config.Account{Code: "account-5"}

	accountNumber, err := nextManualAccountNumber(coinpkg.CodeBTC, []accountCandidate{
		{account: account0, number: 0},
		{account: account3, number: 3},
	})
	require.NoError(t, err)
	require.Equal(t, uint16(4), accountNumber)

	accountNumber, err = nextManualAccountNumber(coinpkg.CodeBTC, nil)
	require.NoError(t, err)
	require.Equal(t, uint16(0), accountNumber)

	_, err = nextManualAccountNumber(coinpkg.CodeBTC, []accountCandidate{
		{account: account5, number: 5},
	})
	require.Equal(t, errAccountLimitReached, errp.Cause(err))
}
