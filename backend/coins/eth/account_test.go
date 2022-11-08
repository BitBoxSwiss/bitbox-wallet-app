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

package eth

import (
	"context"
	"math/big"
	"net/http"
	"os"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	test.TstSetupLogging()
	os.Exit(m.Run())
}

func newAccount(t *testing.T) *Account {
	t.Helper()
	log := logging.Get().WithGroup("account_test")

	net := &chaincfg.TestNet3Params

	dbFolder := test.TstTempDir("eth-dbfolder")
	defer func() { _ = os.RemoveAll(dbFolder) }()

	keypath, err := signing.NewAbsoluteKeypath("m/60'/1'/0'/0")
	require.NoError(t, err)
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)

	signingConfigurations := signing.Configurations{signing.NewEthereumConfiguration(
		[]byte{1, 2, 3, 4},
		keypath,
		xpub)}

	client := &mocks.InterfaceMock{
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
	}
	coin := NewCoin(client, coin.CodeGOETH, "Goerli", "GOETH", "GOETH", params.GoerliChainConfig, "", nil, nil)
	acct := NewAccount(
		&accounts.AccountConfig{
			Code:                  "accountcode",
			Name:                  "accountname",
			DBFolder:              dbFolder,
			Keystore:              nil,
			OnEvent:               func(accounts.Event) {},
			RateUpdater:           nil,
			SigningConfigurations: signingConfigurations,
			GetNotifier:           func(signing.Configurations) accounts.Notifier { return nil },
			GetSaveFilename:       func(suggestedFilename string) string { return suggestedFilename },
		},
		coin,
		&http.Client{},
		log,
	)
	require.NoError(t, acct.Initialize())
	return acct
}

func TestTxProposal(t *testing.T) {
	acct := newAccount(t)
	defer acct.Close()

	t.Run("valid", func(t *testing.T) {
		value, fee, total, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021BF4C139D03Dff59ae763AC73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
		require.Equal(t, coin.NewAmountFromInt64(100000000000000000), value)
		require.Equal(t, coin.NewAmountFromInt64(420000000000000), fee)
		require.Equal(t, coin.NewAmountFromInt64(100420000000000000), total)
	})
	t.Run("valid-address-lowercase", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021bf4c139d03dff59ae763ac73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
	})
	t.Run("valid-address-uppercase", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0XA29163852021BF4C139D03DFF59AE763AC73E84E",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.NoError(t, err)
	})
	t.Run("invalid-address-checksum", func(t *testing.T) {
		// EIP-55 checksum wrong
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xA29163852021BF4C139D03Dff59ae763AC73e84e",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.Error(t, err)
	})

	t.Run("invalid-address", func(t *testing.T) {
		_, _, _, err := acct.TxProposal(&accounts.TxProposalArgs{
			RecipientAddress: "0xa29163852021BF4C1",
			Amount:           coin.NewSendAmount("0.1"),
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "20",
		})
		require.Equal(t, errors.ErrInvalidAddress, errp.Cause(err))
	})
}
