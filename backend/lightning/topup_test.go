// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	btccoin "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

const testTopUpSourceAccountCode accountsTypes.Code = "btc-account"

type topUpTestSDK struct {
	breezSDK
	balanceSat       uint64
	incomingSat      uint64
	receiveCallCount int
}

func (sdk *topUpTestSDK) GetInfo(
	breez_sdk_spark.GetInfoRequest,
) (breez_sdk_spark.GetInfoResponse, error) {
	return breez_sdk_spark.GetInfoResponse{BalanceSats: sdk.balanceSat}, nil
}

func (sdk *topUpTestSDK) ListUnclaimedDeposits(
	breez_sdk_spark.ListUnclaimedDepositsRequest,
) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
	return breez_sdk_spark.ListUnclaimedDepositsResponse{
		Deposits: []breez_sdk_spark.DepositInfo{{AmountSats: sdk.incomingSat}},
	}, nil
}

func (sdk *topUpTestSDK) ReceivePayment(
	breez_sdk_spark.ReceivePaymentRequest,
) (breez_sdk_spark.ReceivePaymentResponse, error) {
	sdk.receiveCallCount++
	return breez_sdk_spark.ReceivePaymentResponse{PaymentRequest: "bc1qboarding"}, nil
}

func testTopUpAccount(
	t *testing.T,
	lightning *Lightning,
	txProposal func(*accounts.TxProposalArgs) (coin.Amount, coin.Amount, coin.Amount, error),
) *accountsMocks.InterfaceMock {
	t.Helper()
	accountCoin := makeTestLightning().btcCoin
	account := &accountsMocks.InterfaceMock{
		CoinFunc: func() coin.Coin {
			return accountCoin
		},
		ConfigFunc: func() *accounts.AccountConfig {
			return &accounts.AccountConfig{
				Config:      &config.Account{CoinCode: coin.CodeBTC},
				RateUpdater: lightning.ratesUpdater,
			}
		},
		TxProposalFunc: txProposal,
	}
	lightning.getAccount = func(code accountsTypes.Code) (accounts.Interface, error) {
		require.Equal(t, testTopUpSourceAccountCode, code)
		return account, nil
	}
	return account
}

func TestParseTopUpAmountUsesAccountDisplayUnit(t *testing.T) {
	accountCoin := makeTestLightning().btcCoin.(*btccoin.Coin)

	amount, err := parseTopUpAmount(accountCoin, "0.00125000")
	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(125_000), amount)

	accountCoin.SetFormatUnit(coin.BtcUnitSats)
	amount, err = parseTopUpAmount(accountCoin, "125000")
	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(125_000), amount)
}

func TestPrepareTopUp(t *testing.T) {
	sdk := &topUpTestSDK{balanceSat: 50_000, incomingSat: 25_000}
	lightning := makeActiveLightningWithSDK(t, sdk)
	account := testTopUpAccount(t, lightning, func(args *accounts.TxProposalArgs) (
		coin.Amount, coin.Amount, coin.Amount, error,
	) {
		return coin.NewAmountFromInt64(125_000), coin.NewAmountFromInt64(100), coin.NewAmountFromInt64(125_100), nil
	})

	proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
		SourceAccountCode: testTopUpSourceAccountCode,
		Amount:            "0.00125000",
		FeeTarget:         "economy",
	})

	require.NoError(t, err)
	require.Equal(t, "0.00125000", proposal.Amount.Amount)
	require.Equal(t, "0.00000100", proposal.Fee.Amount)
	require.Equal(t, "0.00125100", proposal.Total.Amount)
	require.Equal(t, "bc1q boar ding", proposal.RecipientDisplayAddress)
	require.Equal(t, 1, sdk.receiveCallCount)
	require.Len(t, account.TxProposalCalls(), 1)
	args := account.TxProposalCalls()[0].TxProposalArgs
	require.Equal(t, "bc1qboarding", args.RecipientAddress)
	require.Equal(t, accounts.FeeTargetCodeEconomy, args.FeeTargetCode)
	parsedAmount, err := args.Amount.Amount(coin.DecimalsExp(account.Coin(), false), false)
	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(125_000), parsedAmount)
}

func TestPrepareTopUpRejectsAmountBelowMinimumBeforeCreatingProposal(t *testing.T) {
	for _, amount := range []string{"0", "0.00000999"} {
		t.Run(amount, func(t *testing.T) {
			sdk := &topUpTestSDK{balanceSat: 50_000, incomingSat: 25_000}
			lightning := makeActiveLightningWithSDK(t, sdk)
			account := testTopUpAccount(t, lightning, func(*accounts.TxProposalArgs) (
				coin.Amount, coin.Amount, coin.Amount, error,
			) {
				t.Fatal("must not create a below-minimum transaction proposal")
				return coin.Amount{}, coin.Amount{}, coin.Amount{}, nil
			})

			proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
				SourceAccountCode: testTopUpSourceAccountCode,
				Amount:            amount,
				FeeTarget:         "economy",
			})

			require.Nil(t, proposal)
			var amountBelowMinimum *lightningAmountBelowMinimumError
			require.ErrorAs(t, err, &amountBelowMinimum)
			require.Equal(t, uint64(minimumTopUpAmountSat), amountBelowMinimum.minAmountSat)
			require.Empty(t, account.TxProposalCalls())
			require.Zero(t, sdk.receiveCallCount)
		})
	}
}

func TestPrepareTopUpRejectsAmountAboveFundingLimitBeforeCreatingProposal(t *testing.T) {
	sdk := &topUpTestSDK{balanceSat: 50_000, incomingSat: 25_000}
	lightning := makeActiveLightningWithSDK(t, sdk)
	account := testTopUpAccount(t, lightning, func(*accounts.TxProposalArgs) (
		coin.Amount, coin.Amount, coin.Amount, error,
	) {
		t.Fatal("must not create an over-limit transaction proposal")
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, nil
	})

	proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
		SourceAccountCode: testTopUpSourceAccountCode,
		Amount:            "0.00125001",
		FeeTarget:         "economy",
	})

	require.Nil(t, proposal)
	limitErr, ok := err.(*topUpFundingLimitError)
	require.True(t, ok)
	require.Equal(t, fundingLimit{LimitSat: 200_000, MarginSat: 125_000}, limitErr.fundingLimit)
	require.Empty(t, account.TxProposalCalls())
	require.Zero(t, sdk.receiveCallCount)
}

func TestValidateTopUpAmount(t *testing.T) {
	err := validateTopUpAmount(coin.NewAmountFromInt64(minimumTopUpAmountSat - 1))
	var amountBelowMinimum *lightningAmountBelowMinimumError
	require.ErrorAs(t, err, &amountBelowMinimum)
	require.Equal(t, uint64(minimumTopUpAmountSat), amountBelowMinimum.minAmountSat)
	require.NoError(t, validateTopUpAmount(coin.NewAmountFromInt64(minimumTopUpAmountSat)))
}

func TestPrepareTopUpSendAll(t *testing.T) {
	for _, test := range []struct {
		name   string
		amount int64
		err    string
	}{
		{name: "below minimum after fees", amount: 999, err: "minimum"},
		{name: "minimum after fees", amount: 1000},
		{name: "funding margin after fees", amount: 125_000},
		{name: "above funding margin", amount: 125_001, err: "limit"},
	} {
		t.Run(test.name, func(t *testing.T) {
			sdk := &topUpTestSDK{balanceSat: 50_000, incomingSat: 25_000}
			lightning := makeActiveLightningWithSDK(t, sdk)
			outpoint := strings.Repeat("0", 64) + ":1"
			account := testTopUpAccount(t, lightning, func(args *accounts.TxProposalArgs) (
				coin.Amount, coin.Amount, coin.Amount, error,
			) {
				require.True(t, args.Amount.SendAll())
				require.Equal(t, accounts.FeeTargetCodeCustom, args.FeeTargetCode)
				require.Equal(t, "2", args.CustomFee)
				require.Len(t, args.SelectedUTXOs, 1)
				for selected := range args.SelectedUTXOs {
					require.Equal(t, outpoint, selected.String())
				}
				amount := coin.NewAmountFromInt64(test.amount)
				require.NotNil(t, args.ValidateOutputAmount)
				if err := args.ValidateOutputAmount(amount); err != nil {
					return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
				}
				return amount, coin.NewAmountFromInt64(100), coin.NewAmountFromInt64(test.amount + 100), nil
			})
			proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
				SourceAccountCode: testTopUpSourceAccountCode,
				Amount:            "ignored for send-all",
				SendAll:           "yes",
				SelectedUTXOs:     []string{outpoint},
				FeeTarget:         "custom",
				CustomFee:         "2",
				ExpectedAddress:   "bc1qboarding",
			})
			require.Len(t, account.TxProposalCalls(), 1)
			switch test.err {
			case "minimum":
				var minimumErr *lightningAmountBelowMinimumError
				require.ErrorAs(t, err, &minimumErr)
				require.Nil(t, proposal)
			case "limit":
				var limitErr *topUpFundingLimitError
				require.ErrorAs(t, err, &limitErr)
				require.Equal(t, int64(125_000), limitErr.fundingLimit.MarginSat)
				require.Nil(t, proposal)
			default:
				require.NoError(t, err)
				require.NotNil(t, proposal)
			}
		})
	}
}

func TestPrepareTopUpRejectsInvalidDestinationOrCoins(t *testing.T) {
	for _, test := range []struct {
		name            string
		expectedAddress string
		selectedUTXOs   []string
	}{
		{name: "changed boarding address", expectedAddress: "bc1qother"},
		{name: "malformed outpoint", selectedUTXOs: []string{"invalid"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			lightning := makeActiveLightningWithSDK(t, &topUpTestSDK{})
			account := testTopUpAccount(t, lightning, nil)
			proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
				SourceAccountCode: testTopUpSourceAccountCode,
				SendAll:           "yes",
				FeeTarget:         "economy",
				ExpectedAddress:   test.expectedAddress,
				SelectedUTXOs:     test.selectedUTXOs,
			})
			require.Error(t, err)
			require.Nil(t, proposal)
			require.Empty(t, account.TxProposalCalls())
			if test.expectedAddress != "" {
				require.ErrorIs(t, err, accountErrors.ErrInvalidAddress)
			}
		})
	}
}
