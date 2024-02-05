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
	"math/big"
	"os"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestAccount(t *testing.T) {
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

	keypath, err := signing.NewAbsoluteKeypath("m/49'/1'/0'")
	require.NoError(t, err)
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{signing.NewBitcoinConfiguration(
		signing.ScriptTypeP2WPKHP2SH,
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}

	account := btc.NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: signingConfigurations,
			},
			DBFolder:        dbFolder,
			OnEvent:         func(accountsTypes.Event) {},
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
		},
		coin, nil,
		logging.Get().WithGroup("account_test"),
	)
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

	account := btc.NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: signingConfigurations,
			},
			DBFolder:        dbFolder,
			OnEvent:         func(accountsTypes.Event) {},
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
		},
		coin, nil,
		logging.Get().WithGroup("account_test"),
	)
	require.NoError(t, account.Initialize())

	// check the number of available addresses for native and wrapped segwit.
	require.Equal(t, len(account.GetUnusedReceiveAddresses()[0].Addresses), 20)
	require.Equal(t, *account.GetUnusedReceiveAddresses()[0].ScriptType, signing.ScriptTypeP2WPKHP2SH)
	require.Equal(t, len(account.GetUnusedReceiveAddresses()[1].Addresses), 20)
	require.Equal(t, *account.GetUnusedReceiveAddresses()[1].ScriptType, signing.ScriptTypeP2WPKH)

	// Create a new insured account.
	account2 := btc.NewAccount(
		&accounts.AccountConfig{
			Config: &config.Account{
				Code:                  "accountcode2",
				Name:                  "accountname2",
				SigningConfigurations: signingConfigurations,
				InsuranceStatus:       "active",
			},
			DBFolder:        dbFolder,
			OnEvent:         func(accountsTypes.Event) {},
			RateUpdater:     nil,
			GetNotifier:     func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename: func(suggestedFilename string) string { return suggestedFilename },
		},
		coin, nil,
		logging.Get().WithGroup("account_test"),
	)
	require.NoError(t, account2.Initialize())

	// native segwit is the only address type available.
	require.Equal(t, len(account2.GetUnusedReceiveAddresses()), 1)
	require.Equal(t, len(account2.GetUnusedReceiveAddresses()[0].Addresses), 20)
	require.Equal(t, *account2.GetUnusedReceiveAddresses()[0].ScriptType, signing.ScriptTypeP2WPKH)

}
