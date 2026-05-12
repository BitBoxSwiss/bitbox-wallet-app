// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	btccoin "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func makeTestLightning() *Lightning {
	return &Lightning{
		btcCoin: btccoin.NewCoin(
			coin.CodeBTC,
			"Bitcoin",
			"BTC",
			coin.BtcUnitDefault,
			&chaincfg.MainNetParams,
			".",
			[]*config.ServerInfo{},
			"",
			socksproxy.NewSocksProxy(false, ""),
		),
		ratesUpdater: rates.NewRateUpdater(nil, "/dev/null"),
	}
}

func TestToLightningPayment(t *testing.T) {
	lightning := makeTestLightning()
	description := "invoice description"
	details := breez_sdk_spark.PaymentDetailsLightning{
		Description:       &description,
		Invoice:           "lnbc1invoice",
		DestinationPubkey: "destination",
	}
	var paymentDetails breez_sdk_spark.PaymentDetails = details

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "payment-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(4),
		Timestamp:   42,
		Details:     &paymentDetails,
	})

	require.Equal(t, lightningPayment{
		ID:          "payment-id",
		Type:        accounts.TxTypeReceive,
		Status:      accounts.TxStatusComplete,
		Time:        stringPointer("1970-01-01T00:00:42Z"),
		Description: "invoice description",
		Amount: coinAmountWithConversions(
			"0.00000123",
		),
		AmountAtTime: coinAmountWithConversions(
			"0.00000123",
		),
		DeductedAmountAtTime: coinAmountWithConversions(
			"0.00000000",
		),
		Fee: coinAmountWithConversions(
			"0.00000004",
		),
		Invoice: "lnbc1invoice",
	}, payment)
}

func TestToLightningPaymentSparkInvoiceDetails(t *testing.T) {
	lightning := makeTestLightning()
	description := "spark description"
	details := breez_sdk_spark.PaymentDetailsSpark{
		InvoiceDetails: &breez_sdk_spark.SparkInvoicePaymentDetails{
			Invoice:     "lnsb1invoice",
			Description: &description,
		},
	}
	var paymentDetails breez_sdk_spark.PaymentDetails = details

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "spark-payment-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(4),
		Timestamp:   42,
		Details:     &paymentDetails,
	})

	require.Equal(t, lightningPayment{
		ID:          "spark-payment-id",
		Type:        accounts.TxTypeReceive,
		Status:      accounts.TxStatusComplete,
		Time:        stringPointer("1970-01-01T00:00:42Z"),
		Description: "spark description",
		Amount: coinAmountWithConversions(
			"0.00000123",
		),
		AmountAtTime: coinAmountWithConversions(
			"0.00000123",
		),
		DeductedAmountAtTime: coinAmountWithConversions(
			"0.00000000",
		),
		Fee: coinAmountWithConversions(
			"0.00000004",
		),
		Invoice: "lnsb1invoice",
	}, payment)
}

func TestToLightningPaymentSparkNilInvoiceDetails(t *testing.T) {
	lightning := makeTestLightning()
	details := breez_sdk_spark.PaymentDetailsSpark{}
	var paymentDetails breez_sdk_spark.PaymentDetails = details

	require.NotPanics(t, func() {
		payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
			Id:          "spark-nil-invoice-details",
			PaymentType: breez_sdk_spark.PaymentTypeReceive,
			Status:      breez_sdk_spark.PaymentStatusCompleted,
			Amount:      big.NewInt(123),
			Fees:        big.NewInt(4),
			Timestamp:   42,
			Details:     &paymentDetails,
		})

		require.Equal(t, "", payment.Invoice)
		require.Equal(t, "", payment.Description)
		require.Equal(t, "spark-nil-invoice-details", payment.ID)
		require.Equal(t, accounts.TxTypeReceive, payment.Type)
		require.Equal(t, accounts.TxStatusComplete, payment.Status)
		require.Equal(t, stringPointer("1970-01-01T00:00:42Z"), payment.Time)
		require.Equal(t, coinAmountWithConversions("0.00000123"), payment.Amount)
		require.Equal(t, coinAmountWithConversions("0.00000004"), payment.Fee)
	})
}

func TestToLightningPaymentSendWithMissingTimestamp(t *testing.T) {
	lightning := makeTestLightning()

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "send-id",
		PaymentType: breez_sdk_spark.PaymentTypeSend,
		Status:      breez_sdk_spark.PaymentStatusPending,
		Amount:      big.NewInt(100),
		Fees:        big.NewInt(5),
	})

	require.Nil(t, payment.Time)
	require.Equal(t, accounts.TxTypeSend, payment.Type)
	require.Equal(t, accounts.TxStatusPending, payment.Status)
	require.Equal(t, "0.00000100", payment.Amount.Amount)
	require.Equal(t, "0.00000105", payment.DeductedAmountAtTime.Amount)
	require.Equal(t, "0.00000005", payment.Fee.Amount)
	require.True(t, payment.AmountAtTime.Estimated)
	require.True(t, payment.DeductedAmountAtTime.Estimated)
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

func coinAmountWithConversions(amount string) coin.FormattedAmountWithConversions {
	return coin.FormattedAmountWithConversions{
		Amount:      amount,
		Unit:        "BTC",
		Conversions: coin.ConversionsMap{},
		Estimated:   false,
	}
}

func stringPointer(value string) *string {
	return &value
}
