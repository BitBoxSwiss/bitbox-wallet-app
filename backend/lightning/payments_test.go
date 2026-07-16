// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"math/big"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	btccoin "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
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
			"",
			socksproxy.NewSocksProxy(false, ""),
		),
		ratesUpdater: rates.NewRateUpdater(nil, os.DevNull),
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

func TestMsatToSatCeil(t *testing.T) {
	t.Parallel()

	require.Equal(t, uint64(0), msatToSat(0, roundToCeil))
	require.Equal(t, uint64(1), msatToSat(1, roundToCeil))
	require.Equal(t, uint64(1), msatToSat(1000, roundToCeil))
	require.Equal(t, uint64(2), msatToSat(1001, roundToCeil))
	require.Equal(t, uint64(2), msatToSat(2000, roundToCeil))
}

func TestMsatToSatFloor(t *testing.T) {
	t.Parallel()

	require.Equal(t, uint64(0), msatToSat(0, roundToFloor))
	require.Equal(t, uint64(0), msatToSat(999, roundToFloor))
	require.Equal(t, uint64(1), msatToSat(1000, roundToFloor))
	require.Equal(t, uint64(1), msatToSat(1999, roundToFloor))
	require.Equal(t, uint64(2), msatToSat(2000, roundToFloor))
}

func TestMsatToSatInvalidRoundingDefaultsToFloor(t *testing.T) {
	t.Parallel()

	require.NotPanics(t, func() {
		require.Equal(t, uint64(1), msatToSat(1999, msatToSatRounding(99)))
	})
}

func TestValidateLNURLPayAmount(t *testing.T) {
	t.Parallel()

	payRequest := breez_sdk_spark.LnurlPayRequestDetails{
		MinSendable: 1500,
		MaxSendable: 9999,
	}

	testCases := []struct {
		name      string
		amountSat uint64
		wantErr   bool
	}{
		{
			name:      "zero amount",
			amountSat: 0,
			wantErr:   true,
		},
		{
			name:      "below rounded-up minimum",
			amountSat: 1,
			wantErr:   true,
		},
		{
			name:      "at rounded-up minimum",
			amountSat: 2,
		},
		{
			name:      "at rounded-down maximum",
			amountSat: 9,
		},
		{
			name:      "above rounded-down maximum",
			amountSat: 10,
			wantErr:   true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			err := validateLNURLPayAmount(payRequest, testCase.amountSat)
			if testCase.wantErr {
				require.ErrorIs(t, err, errLightningInvalidAmount)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestLnurlPayDescription(t *testing.T) {
	t.Parallel()

	description := lnurlPayDescription(`[["text/identifier","alice@example.com"],["text/plain","Coffee"]]`)
	require.NotNil(t, description)
	require.Equal(t, "Coffee", *description)

	require.Nil(t, lnurlPayDescription(`[["text/identifier","alice@example.com"]]`))
	require.Nil(t, lnurlPayDescription(`not-json`))
}

func TestToLightningLNURLPay(t *testing.T) {
	t.Parallel()

	address := "alice@example.com"
	lnurlPay := toLightningLNURLPay("lnurl-input", breez_sdk_spark.LnurlPayRequestDetails{
		MinSendable: 1500,
		MaxSendable: 9999,
		MetadataStr: `[["text/plain","Tip jar"]]`,
		Domain:      "example.com",
		Address:     &address,
	})

	require.Equal(t, "lnurl-input", lnurlPay.Input)
	require.Equal(t, "alice@example.com", *lnurlPay.Address)
	require.Equal(t, "example.com", lnurlPay.Domain)
	require.Equal(t, "Tip jar", *lnurlPay.Description)
	require.Equal(t, uint64(2), lnurlPay.MinAmountSat)
	require.Equal(t, uint64(9), lnurlPay.MaxAmountSat)
}

func TestPrepareBolt11PaymentRequest(t *testing.T) {
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

			request := prepareBolt11PaymentRequest("lnbc1invoice", testCase.amountSat)

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

func TestPrepareLNURLPayRequest(t *testing.T) {
	t.Parallel()

	payRequest := breez_sdk_spark.LnurlPayRequestDetails{
		Callback:    "https://example.com/lnurl-pay",
		MinSendable: 1000,
		MaxSendable: 100000,
		MetadataStr: `[["text/plain","Coffee"]]`,
		Domain:      "example.com",
		Url:         "https://example.com/.well-known/lnurlp/alice",
	}

	request := prepareLNURLPayRequest(payRequest, 123)

	require.Equal(t, 0, request.Amount.Cmp(big.NewInt(123)))
	require.Equal(t, payRequest, request.PayRequest)
}

func TestPreparedBolt11PaymentFee(t *testing.T) {
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

			quote, err := preparedBolt11PaymentFee(testCase.response)

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

func TestPreparedLNURLPayFee(t *testing.T) {
	t.Parallel()

	fee := preparedLNURLPayFee(breez_sdk_spark.PrepareLnurlPayResponse{
		AmountSats: 123,
		FeeSats:    7,
	})

	require.Equal(t, &paymentFee{
		AmountSat:     123,
		FeeSat:        7,
		TotalDebitSat: 130,
	}, fee)
}

func TestPrepareBitcoinPaymentRequest(t *testing.T) {
	t.Parallel()

	request := prepareBitcoinPaymentRequest(
		"bc1qdestination",
		10_000,
		breez_sdk_spark.FeePolicyFeesIncluded,
	)

	require.Equal(t, "bc1qdestination", request.PaymentRequest)
	require.NotNil(t, request.Amount)
	require.Zero(t, (*request.Amount).Cmp(big.NewInt(10_000)))
	require.NotNil(t, request.FeePolicy)
	require.Equal(t, breez_sdk_spark.FeePolicyFeesIncluded, *request.FeePolicy)
}

func TestPreparedBitcoinPaymentFee(t *testing.T) {
	t.Parallel()

	feeQuote := breez_sdk_spark.SendOnchainFeeQuote{
		SpeedFast: breez_sdk_spark.SendOnchainSpeedFeeQuote{
			UserFeeSat:        700,
			L1BroadcastFeeSat: 300,
		},
	}

	testCases := []struct {
		name          string
		feePolicy     breez_sdk_spark.FeePolicy
		expectedDebit uint64
	}{
		{
			name:          "fees included",
			feePolicy:     breez_sdk_spark.FeePolicyFeesIncluded,
			expectedDebit: 10_000,
		},
		{
			name:          "fees excluded",
			feePolicy:     breez_sdk_spark.FeePolicyFeesExcluded,
			expectedDebit: 11_000,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			fee, err := preparedBitcoinPaymentFee(breez_sdk_spark.PrepareSendPaymentResponse{
				PaymentMethod: breez_sdk_spark.SendPaymentMethodBitcoinAddress{FeeQuote: feeQuote},
				Amount:        big.NewInt(10_000),
				FeePolicy:     testCase.feePolicy,
			})

			require.NoError(t, err)
			require.Equal(t, uint64(10_000), fee.AmountSat)
			require.Equal(t, uint64(1_000), fee.FeeSat)
			require.Equal(t, testCase.expectedDebit, fee.TotalDebitSat)
		})
	}
}

type testPaymentSDK struct {
	breezSDK

	balanceSats      uint64
	prepareSend      func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error)
	send             func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error)
	disconnectCalled bool
	destroyCalled    bool
}

func (sdk *testPaymentSDK) GetInfo(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
	return breez_sdk_spark.GetInfoResponse{BalanceSats: sdk.balanceSats}, nil
}

func (sdk *testPaymentSDK) PrepareSendPayment(
	request breez_sdk_spark.PrepareSendPaymentRequest,
) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
	return sdk.prepareSend(request)
}

func (sdk *testPaymentSDK) SendPayment(
	request breez_sdk_spark.SendPaymentRequest,
) (breez_sdk_spark.SendPaymentResponse, error) {
	return sdk.send(request)
}

func (sdk *testPaymentSDK) Disconnect() error {
	sdk.disconnectCalled = true
	return nil
}

func (sdk *testPaymentSDK) Destroy() {
	sdk.destroyCalled = true
}

func newActivePaymentTestLightning(t *testing.T, sdk *testPaymentSDK) *Lightning {
	t.Helper()
	return newActivePaymentTestLightningWithConfigFilename(t, sdk, test.TstTempFile("lightningConfig"))
}

func newActivePaymentTestLightningWithConfigFilename(
	t *testing.T,
	sdk *testPaymentSDK,
	lightningConfigFilename string,
) *Lightning {
	t.Helper()

	lightning := newTestLightningWithConfigFilename(t, nil, lightningConfigFilename)
	displayLightning := makeTestLightning()
	lightning.btcCoin = displayLightning.btcCoin
	lightning.ratesUpdater = displayLightning.ratesUpdater
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))
	lightning.sdkService = sdk
	return lightning
}

func testBitcoinPrepareResponse(feeSat uint64) breez_sdk_spark.PrepareSendPaymentResponse {
	return breez_sdk_spark.PrepareSendPaymentResponse{
		PaymentMethod: breez_sdk_spark.SendPaymentMethodBitcoinAddress{
			FeeQuote: breez_sdk_spark.SendOnchainFeeQuote{
				SpeedFast: breez_sdk_spark.SendOnchainSpeedFeeQuote{
					UserFeeSat:        feeSat - 1,
					L1BroadcastFeeSat: 1,
				},
			},
		},
		Amount:    big.NewInt(10_000),
		FeePolicy: breez_sdk_spark.FeePolicyFeesIncluded,
	}
}

func TestPrepareCloseWithdraw(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		require.Equal(t, "bc1qdestination", request.PaymentRequest)
		require.NotNil(t, request.Amount)
		require.Zero(t, (*request.Amount).Cmp(big.NewInt(10_000)))
		require.NotNil(t, request.FeePolicy)
		require.Equal(t, breez_sdk_spark.FeePolicyFeesIncluded, *request.FeePolicy)
		return testBitcoinPrepareResponse(1_000), nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("prepare must not send payment")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	quote, err := lightning.PrepareCloseWithdraw("bc1qdestination")

	require.NoError(t, err)
	require.Equal(t, uint64(1_000), quote.FeeSat)
	require.Equal(t, uint64(10_000), quote.BalanceSat)
	require.Equal(t, "0.00010000", quote.Balance.Amount)
	require.Equal(t, "0.00001000", quote.Fee.Amount)
	require.NotNil(t, lightning.Account())
}

func TestCloseWithdraw(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testBitcoinPrepareResponse(1_000), nil
	}
	sdk.send = func(request breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		require.NotNil(t, request.Options)
		options, ok := (*request.Options).(breez_sdk_spark.SendPaymentOptionsBitcoinAddress)
		require.True(t, ok)
		require.Equal(t, breez_sdk_spark.OnchainConfirmationSpeedFast, options.ConfirmationSpeed)
		details := breez_sdk_spark.PaymentDetails(breez_sdk_spark.PaymentDetailsWithdraw{TxId: "tx-id"})
		return breez_sdk_spark.SendPaymentResponse{
			Payment: breez_sdk_spark.Payment{Details: &details},
		}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.CloseWithdraw("bc1qdestination", 10_000, 1_000)

	require.NoError(t, err)
	require.Equal(t, "tx-id", result.TxID)
	require.True(t, result.WalletClosed)
	require.Nil(t, lightning.Account())
	require.True(t, sdk.disconnectCalled)
	require.True(t, sdk.destroyCalled)
}

func TestCloseWithdrawReturnsResultWhenSetAccountFails(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testBitcoinPrepareResponse(1_000), nil
	}
	sdk.send = func(request breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		details := breez_sdk_spark.PaymentDetails(breez_sdk_spark.PaymentDetailsWithdraw{TxId: "tx-id"})
		return breez_sdk_spark.SendPaymentResponse{
			Payment: breez_sdk_spark.Payment{Details: &details},
		}, nil
	}
	lightningConfigFilename := test.TstTempFile("lightningConfig")
	lightning := newActivePaymentTestLightningWithConfigFilename(t, sdk, lightningConfigFilename)
	require.NoError(t, os.Remove(lightningConfigFilename))
	require.NoError(t, os.Mkdir(lightningConfigFilename, 0o700))
	t.Cleanup(func() {
		require.NoError(t, os.Remove(lightningConfigFilename))
	})

	result, err := lightning.CloseWithdraw("bc1qdestination", 10_000, 1_000)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, "tx-id", result.TxID)
	require.False(t, result.WalletClosed)
}

func TestCloseWithdrawRejectsChangedBalance(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_001}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		t.Fatal("stale quote must not prepare payment")
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.CloseWithdraw("bc1qdestination", 10_000, 1_000)

	require.Nil(t, result)
	require.Equal(t, errPaymentApprovalRequired, errp.Cause(err))
}

func TestCloseWithdrawRejectsIncreasedFee(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testBitcoinPrepareResponse(1_001), nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("unapproved fee must not be sent")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.CloseWithdraw("bc1qdestination", 10_000, 1_000)

	require.Nil(t, result)
	require.Error(t, err)
	require.Equal(t, errPaymentApprovalRequired, errp.Cause(err))
	require.NotNil(t, lightning.Account())
	require.False(t, sdk.disconnectCalled)
	require.False(t, sdk.destroyCalled)
}

func TestCloseWithdrawKeepsWalletActiveWhenSendFails(t *testing.T) {
	t.Parallel()

	sendErr := errors.New("send failed")
	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testBitcoinPrepareResponse(1_000), nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		return breez_sdk_spark.SendPaymentResponse{}, sendErr
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.CloseWithdraw("bc1qdestination", 10_000, 1_000)

	require.Nil(t, result)
	require.ErrorIs(t, err, sendErr)
	require.NotNil(t, lightning.Account())
	require.False(t, sdk.disconnectCalled)
	require.False(t, sdk.destroyCalled)
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

func TestCheckPaymentBalance(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name          string
		totalDebitSat uint64
		availableSat  int64
		expectedErr   error
	}{
		{
			name:          "total debit below available balance",
			totalDebitSat: 99,
			availableSat:  100,
		},
		{
			name:          "total debit equals available balance",
			totalDebitSat: 100,
			availableSat:  100,
		},
		{
			name:          "total debit exceeds available balance",
			totalDebitSat: 101,
			availableSat:  100,
			expectedErr:   errLightningInsufficientFunds,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			balance := accounts.NewBalance(coin.NewAmountFromInt64(testCase.availableSat), coin.NewAmountFromInt64(0))
			err := checkPaymentBalance(&paymentFee{TotalDebitSat: testCase.totalDebitSat}, balance)
			require.Equal(t, testCase.expectedErr, errp.Cause(err))
		})
	}
}

func TestLightningPaymentError(t *testing.T) {
	t.Parallel()

	unrelatedErr := errors.New("network unavailable")
	testCases := []struct {
		name                  string
		err                   error
		expectedErr           error
		expectedErrorContains []string
	}{
		{
			name:                  "typed SDK insufficient funds",
			err:                   breez_sdk_spark.NewSdkErrorInsufficientFunds(),
			expectedErr:           errLightningInsufficientFunds,
			expectedErrorContains: []string{"SdkError: InsufficientFunds", "lightningInsufficientFunds"},
		},
		{
			name:                  "Spark already used invoice",
			err:                   breez_sdk_spark.NewSdkErrorSparkError("Service error: status: AlreadyExists, message: preimage request already exists for paymentHash abc, details: DUPLICATE_OPERATION"),
			expectedErr:           errLightningInvoiceAlreadyUsed,
			expectedErrorContains: []string{"preimage request already exists", "lightningInvoiceAlreadyUsed"},
		},
		{
			name:        "unrelated error",
			err:         unrelatedErr,
			expectedErr: unrelatedErr,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			err := lightningPaymentError(testCase.err)
			require.Equal(t, testCase.expectedErr, errp.Cause(err))
			for _, expectedText := range testCase.expectedErrorContains {
				require.Contains(t, err.Error(), expectedText)
			}
		})
	}
}
