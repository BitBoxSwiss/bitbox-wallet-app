// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
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
