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

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	blockchainMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/stretchr/testify/require"
)

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
