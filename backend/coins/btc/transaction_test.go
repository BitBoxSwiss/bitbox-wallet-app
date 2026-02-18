// SPDX-License-Identifier: Apache-2.0

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
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
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

func testAccount(t *testing.T, config *config.Account) *Account {
	t.Helper()
	account := mockAccount(t, config)
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
	require.NoError(t, account.Initialize())
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)
	addresses, err := account.subaccounts[0].changeAddresses.GetUnused()
	require.NoError(t, err)
	account.transactions = &mocks.InterfaceMock{
		SpendableOutputsFunc: func() (map[wire.OutPoint]*transactions.SpendableOutput, error) {
			return map[wire.OutPoint]*transactions.SpendableOutput{
				*wire.NewOutPoint(&chainhash.Hash{}, 0): {TxOut: wire.NewTxOut(1000000000, addresses[0].PubkeyScript())},
				*wire.NewOutPoint(&chainhash.Hash{}, 1): {TxOut: wire.NewTxOut(1000000, addresses[0].PubkeyScript())},
			}, nil
		},
	}
	return account
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
	account := testAccount(t, nil)
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
			AccountConfiguration: &signing.Configuration{
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
	require.Eventually(t, account.Synced, time.Second, time.Millisecond*200)

	account.subaccounts = subaccounts{}
	_, err := account.pickChangeAddress(nil)
	require.ErrorContains(t, err, "Account has no subaccounts")
}

func TestTxProposal(t *testing.T) {
	testCases := []struct {
		name       string
		args       *accounts.TxProposalArgs
		wantAmount coin.Amount
		wantFee    coin.Amount
		wantTotal  coin.Amount
		satoshi    bool
		wantErr    error
	}{
		{
			name: "Success",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
				FeeTargetCode:    accounts.FeeTargetCodeCustom,
				CustomFee:        "100",
				Amount:           coin.NewSendAmount("1"),
			},
			wantAmount: coin.NewAmountFromInt64(100000000),
			wantFee:    coin.NewAmountFromInt64(14400),
			wantTotal:  coin.NewAmountFromInt64(100014400),
		},
		{
			name: "Sendall - success",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
				Amount:           coin.NewSendAmountAll(),
				FeeTargetCode:    accounts.FeeTargetCodeCustom,
				CustomFee:        "100",
			},
			wantAmount: coin.NewAmountFromInt64(1000981900),
			wantFee:    coin.NewAmountFromInt64(18100),
			wantTotal:  coin.NewAmountFromInt64(1001000000),
		},
		{
			name: "Satoshi mode - success",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
				Amount:           coin.NewSendAmount("100000000"),
				FeeTargetCode:    accounts.FeeTargetCodeCustom,
				CustomFee:        "100",
			},
			satoshi:    true,
			wantAmount: coin.NewAmountFromInt64(100000000),
			wantFee:    coin.NewAmountFromInt64(14400),
			wantTotal:  coin.NewAmountFromInt64(100014400),
		},
		{
			name: "UTXO control with SendAll - success",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
				Amount:           coin.NewSendAmountAll(),
				FeeTargetCode:    accounts.FeeTargetCodeCustom,
				CustomFee:        "10",
				SelectedUTXOs: map[wire.OutPoint]struct{}{
					*wire.NewOutPoint(&chainhash.Hash{}, 1): {},
				},
			},
			wantAmount: coin.NewAmountFromInt64(998870),
			wantFee:    coin.NewAmountFromInt64(1130),
			wantTotal:  coin.NewAmountFromInt64(1000000),
		},
		{
			name: "UTXO control with specific amount - success",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
				Amount:           coin.NewSendAmount("0.0001"),
				FeeTargetCode:    accounts.FeeTargetCodeCustom,
				CustomFee:        "10",
				SelectedUTXOs: map[wire.OutPoint]struct{}{
					*wire.NewOutPoint(&chainhash.Hash{}, 1): {},
				},
			},
			wantAmount: coin.NewAmountFromInt64(10000),
			wantFee:    coin.NewAmountFromInt64(1440),
			wantTotal:  coin.NewAmountFromInt64(11440),
		},
		{
			name: "Failure - Invalid address",
			args: &accounts.TxProposalArgs{
				RecipientAddress: "invalidaddress",
			},
			wantErr: errors.ErrInvalidAddress,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			account := testAccount(t, nil)
			if tc.satoshi {
				account.coin.SetFormatUnit(coin.BtcUnitSats)
			}
			amount, fee, total, err := account.TxProposal(tc.args)
			if tc.wantErr == nil {
				require.NoError(t, err)
				require.Equal(t, tc.wantAmount, amount)
				require.Equal(t, tc.wantFee, fee)
				require.Equal(t, tc.wantTotal, total)
			} else {
				require.ErrorContains(t, err, tc.wantErr.Error())
			}

		})
	}
}

func TestTxProposalRBF(t *testing.T) {
	rbfTxHash := chainhash.HashH([]byte("rbf-original"))
	rbfTxID := rbfTxHash.String()

	newRBFArgs := func() *accounts.TxProposalArgs {
		return &accounts.TxProposalArgs{
			RecipientAddress: "myY3Bbvj5mjwqqvubtu5Hfy2nuCeBfvNXL",
			FeeTargetCode:    accounts.FeeTargetCodeCustom,
			CustomFee:        "100",
			Amount:           coin.NewSendAmount("1"),
			RBFTxID:          rbfTxID,
		}
	}

	testCases := []struct {
		name    string
		args    func() *accounts.TxProposalArgs
		setup   func(t *testing.T, account *Account)
		wantErr error
	}{
		{
			name: "RBF success",
			args: newRBFArgs,
			setup: func(t *testing.T, account *Account) {
				t.Helper()
				addresses, err := account.subaccounts[0].changeAddresses.GetUnused()
				require.NoError(t, err)
				mockTxs := account.transactions.(*mocks.InterfaceMock)
				mockTxs.SpendableOutputsForRBFFunc = func(txHash chainhash.Hash) (
					map[wire.OutPoint]*transactions.SpendableOutput,
					btcutil.Amount,
					btcutil.Amount,
					error,
				) {
					require.Equal(t, rbfTxHash, txHash)
					return map[wire.OutPoint]*transactions.SpendableOutput{
						*wire.NewOutPoint(&chainhash.Hash{}, 0): {TxOut: wire.NewTxOut(1000000000, addresses[0].PubkeyScript())},
						*wire.NewOutPoint(&chainhash.Hash{}, 1): {TxOut: wire.NewTxOut(1000000, addresses[0].PubkeyScript())},
					}, btcutil.Amount(10000), btcutil.Amount(50000), nil
				}
			},
		},
		{
			name: "RBF invalid txid",
			args: func() *accounts.TxProposalArgs {
				args := newRBFArgs()
				args.RBFTxID = "invalid-tx-id"
				return args
			},
			wantErr: errors.ErrRBFInvalidTxID,
		},
		{
			name: "RBF coin control not allowed",
			args: func() *accounts.TxProposalArgs {
				args := newRBFArgs()
				args.SelectedUTXOs = map[wire.OutPoint]struct{}{
					*wire.NewOutPoint(&chainhash.Hash{}, 0): {},
				}
				return args
			},
			wantErr: errors.ErrRBFCoinControlNotAllowed,
		},
		{
			name: "RBF fee rate too low",
			args: newRBFArgs,
			setup: func(t *testing.T, account *Account) {
				t.Helper()
				addresses, err := account.subaccounts[0].changeAddresses.GetUnused()
				require.NoError(t, err)
				account.transactions.(*mocks.InterfaceMock).SpendableOutputsForRBFFunc = func(txHash chainhash.Hash) (
					map[wire.OutPoint]*transactions.SpendableOutput,
					btcutil.Amount,
					btcutil.Amount,
					error,
				) {
					return map[wire.OutPoint]*transactions.SpendableOutput{
						*wire.NewOutPoint(&chainhash.Hash{}, 0): {TxOut: wire.NewTxOut(1000000000, addresses[0].PubkeyScript())},
						*wire.NewOutPoint(&chainhash.Hash{}, 1): {TxOut: wire.NewTxOut(1000000, addresses[0].PubkeyScript())},
					}, btcutil.Amount(10000), btcutil.Amount(100000), nil
				}
			},
			wantErr: errors.ErrRBFFeeTooLow,
		},
		{
			name: "RBF absolute fee too low",
			args: newRBFArgs,
			setup: func(t *testing.T, account *Account) {
				t.Helper()
				addresses, err := account.subaccounts[0].changeAddresses.GetUnused()
				require.NoError(t, err)
				account.transactions.(*mocks.InterfaceMock).SpendableOutputsForRBFFunc = func(txHash chainhash.Hash) (
					map[wire.OutPoint]*transactions.SpendableOutput,
					btcutil.Amount,
					btcutil.Amount,
					error,
				) {
					return map[wire.OutPoint]*transactions.SpendableOutput{
						*wire.NewOutPoint(&chainhash.Hash{}, 0): {TxOut: wire.NewTxOut(1000000000, addresses[0].PubkeyScript())},
						*wire.NewOutPoint(&chainhash.Hash{}, 1): {TxOut: wire.NewTxOut(1000000, addresses[0].PubkeyScript())},
					}, btcutil.Amount(20000), btcutil.Amount(50000), nil
				}
			},
			wantErr: errors.ErrRBFFeeTooLow,
		},
		{
			name: "RBF tx not found from transactions store",
			args: newRBFArgs,
			setup: func(t *testing.T, account *Account) {
				t.Helper()
				account.transactions.(*mocks.InterfaceMock).SpendableOutputsForRBFFunc = func(txHash chainhash.Hash) (
					map[wire.OutPoint]*transactions.SpendableOutput,
					btcutil.Amount,
					btcutil.Amount,
					error,
				) {
					return nil, 0, 0, errors.ErrRBFTxNotFound
				}
			},
			wantErr: errors.ErrRBFTxNotFound,
		},
		{
			name: "RBF rejected for Litecoin",
			args: newRBFArgs,
			setup: func(t *testing.T, account *Account) {
				t.Helper()
				account.coin.code = coin.CodeLTC
			},
			wantErr: errors.ErrRBFInvalidTxID,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			account := testAccount(t, nil)
			if tc.setup != nil {
				tc.setup(t, account)
			}

			_, _, _, err := account.TxProposal(tc.args())
			if tc.wantErr == nil {
				require.NoError(t, err)
				require.Len(t, account.transactions.(*mocks.InterfaceMock).SpendableOutputsForRBFCalls(), 1)
				return
			}
			require.ErrorContains(t, err, tc.wantErr.Error())
		})
	}
}
