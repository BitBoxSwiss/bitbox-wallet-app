// Copyright 2025 Shift Crypto AG
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

package btc

import (
	"strconv"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

func mustKeypath(t *testing.T, keypath string) signing.AbsoluteKeypath {
	t.Helper()
	kp, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		t.Fatal(err)
	}
	return kp
}

func TestGetFeePerKb(t *testing.T) {
	testCases := []struct {
		name       string
		args       *accounts.TxProposalArgs
		wantAmount btcutil.Amount
		wantErr    error
	}{
		{
			name: "Custom Fee - Success",
			args: &accounts.TxProposalArgs{
				FeeTargetCode: accounts.FeeTargetCodeCustom,
				CustomFee:     "100",
			},
			wantAmount: btcutil.Amount(100 * 1000),
		},
		{
			name: "Custom Fee - Can't parse float",
			args: &accounts.TxProposalArgs{
				FeeTargetCode: accounts.FeeTargetCodeCustom,
				CustomFee:     "100.0.0",
			},
			wantErr: strconv.ErrSyntax,
		},
		{
			name: "Custom Fee - Fee too low",
			args: &accounts.TxProposalArgs{
				FeeTargetCode: accounts.FeeTargetCodeCustom,
				CustomFee:     "1",
			},
			wantErr: errors.ErrFeeTooLow,
		},
		{
			name: "UseHighestFee",
			args: &accounts.TxProposalArgs{
				UseHighestFee: true,
			},
			wantAmount: btcutil.Amount(10e7),
		},
		{
			name: "Don't use Highest Fee",
			args: &accounts.TxProposalArgs{
				FeeTargetCode: accounts.FeeTargetCodeEconomy,
			},
			wantAmount: btcutil.Amount(10e4),
		},
		{
			name: "UseHighestFee with FeeTargetCodeCustom",
			args: &accounts.TxProposalArgs{
				UseHighestFee: true,
				FeeTargetCode: accounts.FeeTargetCodeCustom,
				CustomFee:     "100",
			},
			wantAmount: btcutil.Amount(10e7),
		},
		{
			name: "Could not estimate fee",
			args: &accounts.TxProposalArgs{
				FeeTargetCode: "Invalid",
			},
			wantErr: errp.New("Fee could not be estimated"),
		},
	}
	account := mockAccount(t, nil)
	account.coin.TstSetMakeBlockchain(func() blockchain.Interface {
		return &blockchainMocks.BlockchainMock{
			MockRelayFee: func() (btcutil.Amount, error) {
				return btcutil.Amount(1001), nil
			},
			MockEstimateFee: func(number int) (btcutil.Amount, error) {
				switch number {
				case 2:
					return btcutil.Amount(10e7), nil
				case 6:
					return btcutil.Amount(10e6), nil
				case 12:
					return btcutil.Amount(10e5), nil
				case 24:
					return btcutil.Amount(10e4), nil
				default:
					return btcutil.Amount(10e6), nil
				}
			},
		}
	})
	account.coin.blockchain = account.coin.makeBlockchain()
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gotAmount, err := account.getFeePerKb(tc.args)
			if tc.wantErr != nil {
				require.ErrorContains(t, err, tc.wantErr.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tc.wantAmount, gotAmount)
			}
		})
	}

}

func utxo(scriptType signing.ScriptType) maketx.UTXO {
	return maketx.UTXO{
		Address: &addresses.AccountAddress{
			Configuration: &signing.Configuration{
				BitcoinSimple: &signing.BitcoinSimple{
					ScriptType: scriptType,
				},
			},
		},
	}
}

func TestPickChangeAddressSucceeds(t *testing.T) {
	rootFingerprint := []byte{1, 2, 3, 4}
	baseSigningConfigurations := signing.Configurations{
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKHP2SH,
			rootFingerprint,
			mustKeypath(t, "m/49'/0'/1'"),
			test.TstMustXKey("xpub6CUmEcJb7juvpvNs2hKMc9BP1n82ixzUb4jyHUdYzSLmnXru3nb4hhGsfS23WRx8hgJLxMxZ7WcBGzTiYfiANUQZe3TVFghLrxvA2Ls7u4a")),
	}

	testCases := []struct {
		name                  string
		signingConfigurations signing.Configurations
		utxos                 map[wire.OutPoint]maketx.UTXO
		wantAddress           string
	}{
		{
			name: "multiple Taproot UTXOs and non-Taproot UTXOs",
			signingConfigurations: signing.Configurations{
				signing.NewBitcoinConfiguration(
					signing.ScriptTypeP2TR,
					rootFingerprint,
					mustKeypath(t, "m/86'/0'/1'"),
					test.TstMustXKey("xpub6CC9Tsi4eJvmSBj5xoU4sKnFGF9nF8qwExB3axxu2F7oWKFH5RucWQUfrgVGfnTDr6p5acBGpAqAMKb2A7ek8SbAUvDEXtvj37pM1S9X2km")),
				signing.NewBitcoinConfiguration(
					signing.ScriptTypeP2WPKH,
					rootFingerprint,
					mustKeypath(t, "m/84'/0'/1'"),
					test.TstMustXKey("xpub6Cxa67Bfe1Aw7YVtdqKPYLhSkf7omb7WkGXQzof15VXbAZKVct1caHHK55UQN2Fnojbp2okiBCbGXyQSRzMQ6XKJJeeM2jAt6FR8K8ckA88")),
			},
			utxos: map[wire.OutPoint]maketx.UTXO{
				*wire.NewOutPoint(&chainhash.Hash{}, 1): utxo(signing.ScriptTypeP2PKH),
				*wire.NewOutPoint(&chainhash.Hash{}, 2): utxo(signing.ScriptTypeP2WPKH),
				*wire.NewOutPoint(&chainhash.Hash{}, 3): utxo(signing.ScriptTypeP2TR),
			},
			wantAddress: "tb1p00h4lrrxueq94y62e3668sp42hxs7w0kulp54uq72050urnplf9s54w5x5",
		},
		{
			name:                  "One subaccount",
			signingConfigurations: baseSigningConfigurations,
			wantAddress:           "2MsjfL7qJTBDnuhUiDJEUR9iWhtcyEnzQYU",
		},
		{
			name: "p2wpkh",
			signingConfigurations: append(baseSigningConfigurations,
				signing.NewBitcoinConfiguration(
					signing.ScriptTypeP2WPKH,
					rootFingerprint,
					mustKeypath(t, "m/84'/0'/1'"),
					test.TstMustXKey("xpub6Cxa67Bfe1Aw7YVtdqKPYLhSkf7omb7WkGXQzof15VXbAZKVct1caHHK55UQN2Fnojbp2okiBCbGXyQSRzMQ6XKJJeeM2jAt6FR8K8ckA88")),
			),
			wantAddress: "tb1q42x65gqluatm6x6vvwlpg93wqcvz8jn3arakke",
		},
		{
			name: "multiple accounts, no p2wpkh or p2tr",
			signingConfigurations: append(signing.Configurations{
				signing.NewBitcoinConfiguration(
					signing.ScriptTypeP2PKH,
					rootFingerprint,
					mustKeypath(t, "m/44'/2'/1'"),
					test.TstMustXKey("xpub6DReBHtKxgeZJJrrhPEHz9kzEZU1BaQ4kPQ2J1tfjA9DMBKT2bor1ynoAPCsxdyJyZrYK5YsYmkknV5KPtpKeVb2HMX6iQ9wjpAhNSANGiA")),
			}, baseSigningConfigurations...),
			wantAddress: "mnYvVvCwL8v3bUSP3wbHzAzRcXV8pN3sSr",
		},
		{
			name: "p2tr",
			signingConfigurations: append(baseSigningConfigurations,
				signing.NewBitcoinConfiguration(
					signing.ScriptTypeP2TR,
					rootFingerprint,
					mustKeypath(t, "m/86'/0'/1'"),
					test.TstMustXKey("xpub6CC9Tsi4eJvmSBj5xoU4sKnFGF9nF8qwExB3axxu2F7oWKFH5RucWQUfrgVGfnTDr6p5acBGpAqAMKb2A7ek8SbAUvDEXtvj37pM1S9X2km")),
			),
			utxos: map[wire.OutPoint]maketx.UTXO{
				*wire.NewOutPoint(&chainhash.Hash{}, 1): utxo(signing.ScriptTypeP2TR),
			},
			wantAddress: "tb1p00h4lrrxueq94y62e3668sp42hxs7w0kulp54uq72050urnplf9s54w5x5",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			account := mockAccount(t, &config.Account{
				Code:                  "accountcode",
				Name:                  "accountname",
				SigningConfigurations: tc.signingConfigurations,
			})
			require.NoError(t, account.Initialize())
			account.ensureAddresses()
			require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)

			address, err := account.pickChangeAddress(tc.utxos)
			require.NoError(t, err)
			require.Equal(t, tc.wantAddress, address.EncodeForHumans())
		})
	}

}

func TestPickChangeAddressFails(t *testing.T) {
	rootFingerprint := []byte{1, 2, 3, 4}
	signingConfiguration := signing.Configurations{
		signing.NewBitcoinConfiguration(
			signing.ScriptTypeP2WPKHP2SH,
			rootFingerprint,
			mustKeypath(t, "m/49'/0'/1'"),
			test.TstMustXKey("xpub6CUmEcJb7juvpvNs2hKMc9BP1n82ixzUb4jyHUdYzSLmnXru3nb4hhGsfS23WRx8hgJLxMxZ7WcBGzTiYfiANUQZe3TVFghLrxvA2Ls7u4a")),
	}
	account := mockAccount(t, &config.Account{
		Code:                  "accountcode",
		Name:                  "accountname",
		SigningConfigurations: signingConfiguration,
	})
	require.NoError(t, account.Initialize())
	account.ensureAddresses()
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)

	account.subaccounts = subaccounts{}
	_, err := account.pickChangeAddress(nil)
	require.ErrorContains(t, err, "Account has no subaccounts")
}
