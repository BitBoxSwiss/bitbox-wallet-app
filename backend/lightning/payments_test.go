// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

func TestToLightningPayment(t *testing.T) {
	description := "invoice description"
	preimage := "preimage"
	details := breez_sdk_spark.PaymentDetailsLightning{
		Description:       &description,
		Invoice:           "lnbc1invoice",
		DestinationPubkey: "destination",
		HtlcDetails: breez_sdk_spark.SparkHtlcDetails{
			PaymentHash: "hash",
			Preimage:    &preimage,
		},
	}
	var paymentDetails breez_sdk_spark.PaymentDetails = details

	payment := toLightningPayment(breez_sdk_spark.Payment{
		Id:          "payment-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(4),
		Timestamp:   42,
		Details:     &paymentDetails,
	})

	require.Equal(t, lightningPayment{
		ID:              "payment-id",
		Type:            accounts.TxTypeReceive,
		Status:          accounts.TxStatusComplete,
		AmountSat:       123,
		FeesSat:         4,
		Timestamp:       42,
		Description:     "invoice description",
		PaymentHash:     "hash",
		PaymentPreimage: "preimage",
		Invoice:         "lnbc1invoice",
	}, payment)
}

func TestParseLightningUint(t *testing.T) {
	require.Equal(t, uint64(99), parseLightningUint(big.NewInt(99)))
}

func TestPrepareSendPaymentRequest(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name           string
		amountSat      *uint64
		expectedAmount *big.Int
	}{
		{
			name:           "nil amount",
			amountSat:      nil,
			expectedAmount: nil,
		},
		{
			name:           "non-nil amount",
			amountSat:      func() *uint64 { amount := uint64(123); return &amount }(),
			expectedAmount: big.NewInt(123),
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			request := prepareSendPaymentRequest("lnbc1invoice", testCase.amountSat)

			require.Equal(t, "lnbc1invoice", request.PaymentRequest)
			if testCase.expectedAmount == nil {
				require.Nil(t, request.Amount)
				return
			}
			require.NotNil(t, request.Amount)
			require.Equal(t, 0, (*request.Amount).Cmp(testCase.expectedAmount))
		})
	}
}

func TestPreparedPaymentFee(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name        string
		response    breez_sdk_spark.PrepareSendPaymentResponse
		expected    *paymentFee
		expectedErr string
	}{
		{
			name: "bolt11 invoice",
			response: breez_sdk_spark.PrepareSendPaymentResponse{
				PaymentMethod: breez_sdk_spark.SendPaymentMethodBolt11Invoice{
					LightningFeeSats: 7,
				},
				Amount: big.NewInt(123),
			},
			expected: &paymentFee{
				AmountSat:     123,
				FeeSat:        7,
				TotalDebitSat: 130,
			},
		},
		{
			name: "unsupported payment method",
			response: breez_sdk_spark.PrepareSendPaymentResponse{
				PaymentMethod: breez_sdk_spark.SendPaymentMethodBitcoinAddress{},
				Amount:        big.NewInt(123),
			},
			expectedErr: "Payment method",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			quote, err := preparedPaymentFee(testCase.response)

			if testCase.expectedErr != "" {
				require.Error(t, err)
				require.Nil(t, quote)
				require.Contains(t, err.Error(), testCase.expectedErr)
				require.Contains(t, err.Error(), "not supported")
				return
			}

			require.NoError(t, err)
			require.Equal(t, testCase.expected, quote)
		})
	}
}

func TestValidateApprovedLightningFee(t *testing.T) {
	require.NoError(t, checkApprovedPaymentFee(9, 9))
	require.NoError(t, checkApprovedPaymentFee(8, 9))

	err := checkApprovedPaymentFee(10, 9)
	require.Error(t, err)
	require.Equal(t, errPaymentApprovalRequired, errp.Cause(err))
}
