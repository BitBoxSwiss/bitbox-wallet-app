// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	btccoin "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

const testTopUpSourceAccountCode accountsTypes.Code = "btc-account"

type topUpTestSDK struct {
	breezSDK
	balanceSat       uint64
	incomingSat      uint64
	receiveCallCount int
	recommendedFees  breez_sdk_spark.RecommendedFees
	feesErr          error
}

func (sdk *topUpTestSDK) RecommendedFees() (breez_sdk_spark.RecommendedFees, error) {
	return sdk.recommendedFees, sdk.feesErr
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
	sdk := &topUpTestSDK{
		balanceSat:      50_000,
		incomingSat:     25_000,
		recommendedFees: breez_sdk_spark.RecommendedFees{FastestFee: 12, HourFee: 3},
	}
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
	require.NotNil(t, proposal.EstimatedClaimFee)
	require.Equal(t, "0.00001188", proposal.EstimatedClaimFee.Amount)
	require.Equal(t, "BTC", proposal.EstimatedClaimFee.Unit)
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

func TestPrepareTopUpClaimFee(t *testing.T) {
	for _, test := range []struct {
		name           string
		feeRate        uint64
		feesErr        error
		expectedFeeSat string
	}{
		{name: "recommended rate", feeRate: 12, expectedFeeSat: "1188"},
		{name: "one sat per vbyte", feeRate: 1, expectedFeeSat: "99"},
		{name: "unavailable rate"},
		{name: "failed lookup", feesErr: errors.New("fee service unavailable")},
	} {
		t.Run(test.name, func(t *testing.T) {
			sdk := &topUpTestSDK{
				recommendedFees: breez_sdk_spark.RecommendedFees{FastestFee: test.feeRate},
				feesErr:         test.feesErr,
			}
			lightning := makeActiveLightningWithSDK(t, sdk)
			account := testTopUpAccount(t, lightning, func(*accounts.TxProposalArgs) (
				coin.Amount, coin.Amount, coin.Amount, error,
			) {
				return coin.NewAmountFromInt64(125_000), coin.NewAmountFromInt64(100), coin.NewAmountFromInt64(125_100), nil
			})
			account.Coin().(*btccoin.Coin).SetFormatUnit(coin.BtcUnitSats)

			proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
				SourceAccountCode: testTopUpSourceAccountCode,
				Amount:            "125000",
				FeeTarget:         "custom",
				CustomFee:         "5",
			})

			require.NoError(t, err)
			require.Equal(t, "125000", proposal.Amount.Amount)
			require.Equal(t, "100", proposal.Fee.Amount)
			require.Equal(t, "125100", proposal.Total.Amount)
			if test.expectedFeeSat == "" {
				require.Nil(t, proposal.EstimatedClaimFee)
			} else {
				require.NotNil(t, proposal.EstimatedClaimFee)
				require.Equal(t, test.expectedFeeSat, proposal.EstimatedClaimFee.Amount)
				require.Equal(t, "sat", proposal.EstimatedClaimFee.Unit)
			}
		})
	}
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
