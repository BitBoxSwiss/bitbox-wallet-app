// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
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
	receiveErr       error
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
	return breez_sdk_spark.ReceivePaymentResponse{PaymentRequest: "bc1qboarding"}, sdk.receiveErr
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

// A fixed top-up uses the SDK destination and reports the Bitcoin network fee warning at 10%.
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
		return coin.NewAmountFromInt64(125_000), coin.NewAmountFromInt64(12_500), coin.NewAmountFromInt64(137_500), nil
	})

	proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
		SourceAccountCode: testTopUpSourceAccountCode,
		Amount:            "0.00125000",
		FeeTarget:         "economy",
	})

	require.NoError(t, err)
	require.Equal(t, "0.00125000", proposal.Amount.Amount)
	require.Equal(t, "0.00012500", proposal.Fee.Amount)
	require.Equal(t, "10.0", proposal.HighFeePercentage)
	require.NotNil(t, proposal.EstimatedClaimFee)
	require.Equal(t, "0.00001188", proposal.EstimatedClaimFee.Amount)
	require.Equal(t, "BTC", proposal.EstimatedClaimFee.Unit)
	require.Equal(t, "0.00137500", proposal.Total.Amount)
	require.Equal(t, "bc1q boar ding", proposal.RecipientDisplayAddress)
	require.Equal(t, 1, sdk.receiveCallCount)
	require.Len(t, account.TxProposalCalls(), 1)
	args := account.TxProposalCalls()[0].TxProposalArgs
	require.False(t, args.Amount.SendAll())
	require.Equal(t, "bc1qboarding", args.RecipientAddress)
	require.Equal(t, accounts.FeeTargetCodeEconomy, args.FeeTargetCode)
	parsedAmount, err := args.Amount.Amount(coin.DecimalsExp(account.Coin(), false), false)
	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(125_000), parsedAmount)
}

// The top-up API accepts boolean flags, defaults omission to false, and rejects string flags.
func TestPrepareTopUpRequestSendAll(t *testing.T) {
	for _, test := range []struct {
		name    string
		body    string
		sendAll bool
		invalid bool
	}{
		{name: "omitted", body: `{}`},
		{name: "false", body: `{"sendAll":false}`},
		{name: "true", body: `{"sendAll":true}`, sendAll: true},
		{name: "empty string", body: `{"sendAll":""}`, invalid: true},
		{name: "yes string", body: `{"sendAll":"yes"}`, invalid: true},
		{name: "no string", body: `{"sendAll":"no"}`, invalid: true},
		{name: "other string", body: `{"sendAll":"invalid"}`, invalid: true},
		{name: "number", body: `{"sendAll":1}`, invalid: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var request prepareTopUpRequest
			err := json.Unmarshal([]byte(test.body), &request)
			if test.invalid {
				var typeError *json.UnmarshalTypeError
				require.ErrorAs(t, err, &typeError)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.sendAll, request.SendAll)
		})
	}
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
			require.Empty(t, proposal.HighFeePercentage)
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

// Bitcoin validates fixed amounts in the selected unit before Lightning checks the final output.
func TestPrepareTopUpFixedAmountValidation(t *testing.T) {
	for _, test := range []struct {
		name        string
		amount      string
		proposalErr error
	}{
		{name: "zero", amount: "0", proposalErr: accountErrors.ErrInvalidAmount},
		{name: "below minimum", amount: "0.00000999"},
		{name: "above margin", amount: "0.00125001"},
		{name: "insufficient funds before limit check", amount: "1", proposalErr: accountErrors.ErrInsufficientFunds},
	} {
		t.Run(test.name, func(t *testing.T) {
			sdk := &topUpTestSDK{balanceSat: 50_000, incomingSat: 25_000}
			lightning := makeActiveLightningWithSDK(t, sdk)
			testTopUpAccount(t, lightning, func(args *accounts.TxProposalArgs) (coin.Amount, coin.Amount, coin.Amount, error) {
				require.Equal(t, "bc1qboarding", args.RecipientAddress)
				amount, err := args.Amount.Amount(coin.DecimalsExp(lightning.btcCoin, false), false)
				if err != nil {
					return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
				}
				if test.proposalErr == accountErrors.ErrInsufficientFunds {
					return coin.Amount{}, coin.Amount{}, coin.Amount{}, accountErrors.ErrInsufficientFunds
				}
				return coin.Amount{}, coin.Amount{}, coin.Amount{}, args.ValidateOutputAmount(amount)
			})
			proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
				SourceAccountCode: testTopUpSourceAccountCode,
				Amount:            test.amount,
				FeeTarget:         "economy",
			})
			require.Nil(t, proposal)
			require.Equal(t, 1, sdk.receiveCallCount)
			switch {
			case test.proposalErr != nil:
				require.ErrorIs(t, err, test.proposalErr)
			case test.name == "below minimum":
				var minimumErr *lightningAmountBelowMinimumError
				require.ErrorAs(t, err, &minimumErr)
				require.Equal(t, uint64(minimumTopUpAmountSat), minimumErr.minAmountSat)
			default:
				var limitErr *topUpFundingLimitError
				require.ErrorAs(t, err, &limitErr)
				require.Equal(t, fundingLimit{LimitSat: 200_000, MarginSat: 125_000}, limitErr.fundingLimit)
			}
		})
	}
}

// Send-all forwards coin selection and validates the final output against both funding bounds.
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
				SendAll:           true,
				SelectedUTXOs:     []string{outpoint},
				FeeTarget:         "custom",
				CustomFee:         "2",
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

// Address lookup failure during preparation must prevent creating a Bitcoin proposal.
func TestPrepareTopUpBoardingAddressFailure(t *testing.T) {
	receiveErr := errors.New("address unavailable")
	sdk := &topUpTestSDK{receiveErr: receiveErr}
	lightning := makeActiveLightningWithSDK(t, sdk)
	account := testTopUpAccount(t, lightning, nil)
	proposal, err := lightning.PrepareTopUp(prepareTopUpRequest{
		SourceAccountCode: testTopUpSourceAccountCode,
		SendAll:           true,
		FeeTarget:         "economy",
	})
	require.ErrorIs(t, err, receiveErr)
	require.Nil(t, proposal)
	require.Empty(t, account.TxProposalCalls())
}
