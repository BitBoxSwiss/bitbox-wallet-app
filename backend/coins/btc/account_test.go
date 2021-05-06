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
	"math/big"
	"os"
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMock "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
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
		code, "Bitcoin Testnet", unit, net, dbFolder, nil, explorer, socksproxy.NewSocksProxy(false, ""))

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
			Code:                  "accountcode",
			Name:                  "accountname",
			DBFolder:              dbFolder,
			Keystores:             nil,
			OnEvent:               func(accounts.Event) {},
			RateUpdater:           nil,
			SigningConfigurations: signingConfigurations,
			GetNotifier:           func(signing.Configurations) accounts.Notifier { return nil },
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
