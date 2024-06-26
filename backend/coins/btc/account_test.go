// Copyright 2020 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

package btc_test

import (
	"crypto/sha256"
	"encoding/base64"
	"math/big"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func mockKeystore() *keystoremock.KeystoreMock {
	return &keystoremock.KeystoreMock{
		CanSignMessageFunc: func(coin.Code) bool { return true },
		SignBTCMessageFunc: func(_ []byte, _ signing.AbsoluteKeypath, _ signing.ScriptType) ([]byte, error) {
			return []byte("signature"), nil
		},
	}
}

func mockAccount(t *testing.T, accountConfig *config.Account) *btc.Account {
	t.Helper()
	code := coin.CodeTBTC
	unit := "TBTC"
	net := &chaincfg.TestNet3Params

	dbFolder := test.TstTempDir("btc-dbfolder")
	defer func() { _ = os.RemoveAll(dbFolder) }()

	coin := btc.NewCoin(
		code, "Bitcoin Testnet", unit, coin.BtcUnitDefault, net, dbFolder, nil, explorer, socksproxy.NewSocksProxy(false, ""))

	blockchainMock := &blockchainMock.BlockchainMock{}
	blockchainMock.MockRegisterOnConnectionErrorChangedEvent = func(f func(error)) {}

	coin.TstSetMakeBlockchain(func() blockchain.Interface { return blockchainMock })

	keypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'")
	require.NoError(t, err)
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := &signing.Configurations{signing.NewBitcoinConfiguration(
		signing.ScriptTypeP2WPKH,
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}

	defaultConfig := &config.Account{
		Code:                  "accountcode",
		Name:                  "accountname",
		SigningConfigurations: *signingConfigurations,
	}

	if accountConfig == nil {
		accountConfig = defaultConfig
	}

	return btc.NewAccount(
		&accounts.AccountConfig{
			Config:          accountConfig,
			DBFolder:        dbFolder,
			OnEvent:         func(accountsTypes.Event) {},
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
			ConnectKeystore: func() (keystore.Keystore, error) {
				return mockKeystore(), nil
			},
		},
		coin, nil,
		logging.Get().WithGroup("account_test"),
		nil,
	)
}

func TestAccount(t *testing.T) {
	account := mockAccount(t, nil)
	require.False(t, account.Synced())
	require.NoError(t, account.Initialize())
	require.True(t, account.Synced())

	balance, err := account.Balance()
	require.NoError(t, err)
	require.Equal(t, big.NewInt(0), balance.Available().BigInt())
	require.Equal(t, big.NewInt(0), balance.Incoming().BigInt())

	transactions, err := account.Transactions()
	require.NoError(t, err)
	require.Equal(t, accounts.OrderedTransactions{}, transactions)

	require.Equal(t, []*btc.SpendableOutput{}, account.SpendableOutputs())
}

func TestInsuredAccountAddresses(t *testing.T) {
	net := &chaincfg.TestNet3Params

	wrapSegKeypath, err := signing.NewAbsoluteKeypath("m/49'/1'/0'")
	require.NoError(t, err)
	wrappedSeed := sha256.Sum256([]byte("wrapped"))
	wrapSegXpub, err := hdkeychain.NewMaster(wrappedSeed[:], net)
	require.NoError(t, err)
	wrapSegXpub, err = wrapSegXpub.Neuter()
	require.NoError(t, err)

	natSegKeypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'")
	require.NoError(t, err)
	natSegSeed := sha256.Sum256([]byte("native"))
	natSegXpub, err := hdkeychain.NewMaster(natSegSeed[:], net)
	require.NoError(t, err)
	natSegXpub, err = natSegXpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKHP2SH,
			[]byte{1, 2, 3, 4},
			wrapSegKeypath,
			wrapSegXpub),
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKH,
			[]byte{1, 2, 3, 4},
			natSegKeypath,
			natSegXpub),
	}
	account := mockAccount(t, &config.Account{
		Code:                  "accountcode",
		Name:                  "accountname",
		SigningConfigurations: signingConfigurations,
	})
	require.NoError(t, account.Initialize())

	// check the number of available addresses for native and wrapped segwit.
	require.Len(t, account.GetUnusedReceiveAddresses()[0].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKHP2SH, *account.GetUnusedReceiveAddresses()[0].ScriptType)
	require.Len(t, account.GetUnusedReceiveAddresses()[1].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKH, *account.GetUnusedReceiveAddresses()[1].ScriptType)

	// Create a new insured account.
	account2 := mockAccount(t, &config.Account{
		Code:                  "accountcode2",
		Name:                  "accountname2",
		SigningConfigurations: signingConfigurations,
		InsuranceStatus:       "active",
	})

	require.NoError(t, account2.Initialize())

	// native segwit is the only address type available.
	require.Len(t, account2.GetUnusedReceiveAddresses(), 1)
	require.Len(t, account2.GetUnusedReceiveAddresses()[0].Addresses, 20)
	require.Equal(t, signing.ScriptTypeP2WPKH, *account2.GetUnusedReceiveAddresses()[0].ScriptType)

}

func TestSignAddress(t *testing.T) {
	account := mockAccount(t, nil)
	require.NoError(t, account.Initialize())
	// pt2r is not an available script type in the mocked account.
	_, _, err := btc.SignBTCAddress(account, "Hello there", signing.ScriptTypeP2TR)
	require.Error(t, err)
	address, signature, err := btc.SignBTCAddress(account, "Hello there", signing.ScriptTypeP2WPKH)
	require.NoError(t, err)
	require.NotEmpty(t, address)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("signature")), signature)

}
