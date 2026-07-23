// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
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
			"",
			socksproxy.NewSocksProxy(false, ""),
		),
		ratesUpdater: rates.NewRateUpdater(nil, os.DevNull),
	}
}

type balanceLimitTestSDK struct {
	breezSDK
	balanceSats uint64
}

func (sdk *balanceLimitTestSDK) GetInfo(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
	return breez_sdk_spark.GetInfoResponse{BalanceSats: sdk.balanceSats}, nil
}

type receivePaymentTestSDK struct {
	breezSDK
	request breez_sdk_spark.ReceivePaymentRequest
}

func (sdk *receivePaymentTestSDK) ReceivePayment(
	request breez_sdk_spark.ReceivePaymentRequest,
) (breez_sdk_spark.ReceivePaymentResponse, error) {
	sdk.request = request
	return breez_sdk_spark.ReceivePaymentResponse{PaymentRequest: "lnbc1invoice"}, nil
}

type testPaymentsBreezSDK struct {
	breezSDK

	listPayments func(breez_sdk_spark.ListPaymentsRequest) (breez_sdk_spark.ListPaymentsResponse, error)
}

func (sdk *testPaymentsBreezSDK) ListPayments(
	request breez_sdk_spark.ListPaymentsRequest,
) (breez_sdk_spark.ListPaymentsResponse, error) {
	return sdk.listPayments(request)
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

func TestTransactions(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))

	lightning.sdkService = &testPaymentsBreezSDK{
		listPayments: func(request breez_sdk_spark.ListPaymentsRequest) (breez_sdk_spark.ListPaymentsResponse, error) {
			require.NotNil(t, request.AssetFilter)
			_, ok := (*request.AssetFilter).(breez_sdk_spark.AssetFilterBitcoin)
			require.True(t, ok)
			return breez_sdk_spark.ListPaymentsResponse{
				Payments: []breez_sdk_spark.Payment{
					{
						Id:          "receive-complete",
						PaymentType: breez_sdk_spark.PaymentTypeReceive,
						Status:      breez_sdk_spark.PaymentStatusCompleted,
						Amount:      big.NewInt(100),
						Fees:        big.NewInt(1),
						Timestamp:   100,
					},
					{
						Id:          "send-complete",
						PaymentType: breez_sdk_spark.PaymentTypeSend,
						Status:      breez_sdk_spark.PaymentStatusCompleted,
						Amount:      big.NewInt(30),
						Fees:        big.NewInt(2),
						Timestamp:   200,
					},
					{
						Id:          "receive-pending",
						PaymentType: breez_sdk_spark.PaymentTypeReceive,
						Status:      breez_sdk_spark.PaymentStatusPending,
						Amount:      big.NewInt(1000),
						Fees:        big.NewInt(0),
						Timestamp:   300,
					},
					{
						Id:          "send-failed",
						PaymentType: breez_sdk_spark.PaymentTypeSend,
						Status:      breez_sdk_spark.PaymentStatusFailed,
						Amount:      big.NewInt(1000),
						Fees:        big.NewInt(10),
						Timestamp:   400,
					},
					{
						Id:          "receive-no-timestamp",
						PaymentType: breez_sdk_spark.PaymentTypeReceive,
						Status:      breez_sdk_spark.PaymentStatusCompleted,
						Amount:      big.NewInt(1000),
						Fees:        big.NewInt(0),
						Timestamp:   0,
					},
				},
			}, nil
		},
	}

	txs, err := lightning.Transactions()
	require.NoError(t, err)
	require.Len(t, txs, 3)

	timeseries, err := txs.Timeseries(time.Unix(0, 0), time.Unix(300, 0), time.Hour)
	require.Nil(t, timeseries)
	require.Equal(t, accountErrors.ErrNotAvailable, errp.Cause(err))

	hasUntimestampedReceive := false
	for _, tx := range txs {
		if tx.Timestamp == nil && tx.Type == accounts.TxTypeReceive && tx.Amount.BigInt().Cmp(big.NewInt(1000)) == 0 {
			hasUntimestampedReceive = true
		}
	}
	require.True(t, hasUntimestampedReceive)
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

func TestToLightningPaymentBitcoinDeposit(t *testing.T) {
	lightning := makeTestLightning()
	details := breez_sdk_spark.PaymentDetails(breez_sdk_spark.PaymentDetailsDeposit{
		TxId: "deposit-txid",
	})

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "deposit-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(0),
		Timestamp:   42,
		Method:      breez_sdk_spark.PaymentMethodDeposit,
		Details:     &details,
	})

	require.Equal(t, &bitcoinDeposit{
		TxID:  "deposit-txid",
		State: bitcoinDepositStateComplete,
	}, payment.BitcoinDeposit)
}

func TestToLightningPaymentBitcoinDepositWithoutDetails(t *testing.T) {
	lightning := makeTestLightning()

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "deposit-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(0),
		Method:      breez_sdk_spark.PaymentMethodDeposit,
	})

	require.Equal(t, &bitcoinDeposit{
		State: bitcoinDepositStateComplete,
	}, payment.BitcoinDeposit)
}

func TestToBitcoinDepositPayment(t *testing.T) {
	lightning := makeTestLightning()
	claimError := breez_sdk_spark.DepositClaimError(breez_sdk_spark.DepositClaimErrorGeneric{
		Message: "claim failed",
	})

	testCases := []struct {
		name        string
		deposit     breez_sdk_spark.DepositInfo
		expected    bitcoinDeposit
		expectedID  string
		expectedAmt string
	}{
		{
			name: "confirming deposit",
			deposit: breez_sdk_spark.DepositInfo{
				Txid:       "txid-confirming",
				Vout:       1,
				AmountSats: 123,
				IsMature:   false,
			},
			expected: bitcoinDeposit{
				TxID:  "txid-confirming",
				Vout:  1,
				State: bitcoinDepositStateConfirming,
			},
			expectedID:  "bitcoin-deposit:txid-confirming:1",
			expectedAmt: "0.00000123",
		},
		{
			name: "claiming deposit",
			deposit: breez_sdk_spark.DepositInfo{
				Txid:       "txid-claiming",
				Vout:       2,
				AmountSats: 456,
				IsMature:   true,
			},
			expected: bitcoinDeposit{
				TxID:  "txid-claiming",
				Vout:  2,
				State: bitcoinDepositStateClaiming,
			},
			expectedID:  "bitcoin-deposit:txid-claiming:2",
			expectedAmt: "0.00000456",
		},
		{
			name: "unclaimed deposit",
			deposit: breez_sdk_spark.DepositInfo{
				Txid:       "txid-unclaimed",
				Vout:       3,
				AmountSats: 789,
				IsMature:   true,
				ClaimError: &claimError,
			},
			expected: bitcoinDeposit{
				TxID:       "txid-unclaimed",
				Vout:       3,
				State:      bitcoinDepositStateUnclaimed,
				ClaimError: "claim failed",
			},
			expectedID:  "bitcoin-deposit:txid-unclaimed:3",
			expectedAmt: "0.00000789",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			payment := lightning.toBitcoinDepositPayment(testCase.deposit)

			require.Equal(t, testCase.expectedID, payment.ID)
			require.Equal(t, accounts.TxTypeReceive, payment.Type)
			require.Equal(t, accounts.TxStatusPending, payment.Status)
			require.Equal(t, coinAmountWithConversions(testCase.expectedAmt), payment.Amount)
			require.Equal(t, testCase.expectedAmt, payment.AmountAtTime.Amount)
			require.Equal(t, &testCase.expected, payment.BitcoinDeposit)
		})
	}
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

func makeActiveLightningWithSDK(t *testing.T, sdk breezSDK) *Lightning {
	t.Helper()

	coinLightning := makeTestLightning()
	lightning := newTestLightning(t, nil)
	lightning.btcCoin = coinLightning.btcCoin
	lightning.ratesUpdater = coinLightning.ratesUpdater
	lightning.sdkService = sdk
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))
	return lightning
}

func TestListPaymentsIncludesBitcoinDeposits(t *testing.T) {
	lightning := makeActiveLightningWithSDK(t, &testBreezSDK{
		listPayments: func(breez_sdk_spark.ListPaymentsRequest) (breez_sdk_spark.ListPaymentsResponse, error) {
			return breez_sdk_spark.ListPaymentsResponse{
				Payments: []breez_sdk_spark.Payment{
					{
						Id:          "payment-id",
						PaymentType: breez_sdk_spark.PaymentTypeReceive,
						Status:      breez_sdk_spark.PaymentStatusCompleted,
						Amount:      big.NewInt(100),
						Fees:        big.NewInt(0),
					},
				},
			}, nil
		},
		listUnclaimedDeposits: func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
			return breez_sdk_spark.ListUnclaimedDepositsResponse{
				Deposits: []breez_sdk_spark.DepositInfo{
					{
						Txid:       "deposit-txid",
						Vout:       1,
						AmountSats: 200,
						IsMature:   false,
					},
				},
			}, nil
		},
	})

	payments, err := lightning.ListPayments()

	require.NoError(t, err)
	require.Len(t, payments, 2)
	require.Equal(t, "bitcoin-deposit:deposit-txid:1", payments[0].ID)
	require.NotNil(t, payments[0].BitcoinDeposit)
	require.Equal(t, "payment-id", payments[1].ID)
	require.Nil(t, payments[1].BitcoinDeposit)
}

func TestBalanceIncludesIncomingBitcoinDeposits(t *testing.T) {
	lightning := makeActiveLightningWithSDK(t, &testBreezSDK{
		getInfo: func(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
			return breez_sdk_spark.GetInfoResponse{
				BalanceSats: 100,
			}, nil
		},
		listUnclaimedDeposits: func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
			return breez_sdk_spark.ListUnclaimedDepositsResponse{
				Deposits: []breez_sdk_spark.DepositInfo{
					{AmountSats: 200},
					{AmountSats: 300},
				},
			}, nil
		},
	})

	balance, err := lightning.Balance()

	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(100), balance.Available())
	require.Equal(t, coin.NewAmountFromInt64(500), balance.Incoming())
}

func TestAvailableBalanceDoesNotLoadBitcoinDeposits(t *testing.T) {
	lightning := makeActiveLightningWithSDK(t, &testBreezSDK{
		getInfo: func(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
			return breez_sdk_spark.GetInfoResponse{BalanceSats: 100}, nil
		},
	})

	available, err := lightning.availableBalance()

	require.NoError(t, err)
	require.Equal(t, coin.NewAmountFromInt64(100), available)
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

			availableBalance := coin.NewAmountFromInt64(testCase.availableSat)
			err := checkPaymentBalance(&paymentFee{TotalDebitSat: testCase.totalDebitSat}, availableBalance)
			require.Equal(t, testCase.expectedErr, errp.Cause(err))
		})
	}
}

func TestBalanceLimit(t *testing.T) {
	lightning := newTestLightning(t, nil)
	lightning.btcCoin = makeTestLightning().btcCoin
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))

	testCases := []struct {
		name                       string
		availableSat               uint64
		formatUnit                 coin.BtcUnit
		hasRequestedAmount         bool
		requestedAmountSat         int64
		expectedLimitAmount        string
		expectedLimitLabel         string
		expectedRemainingAmount    string
		expectedRemainingLabel     string
		expectedExcessAmount       string
		expectedExcessLabel        string
		expectedUnit               string
		expectedLimitReached       bool
		expectedLimitExceeded      bool
		expectedAmountExceedsLimit bool
	}{
		{
			name:                    "empty balance without requested amount",
			formatUnit:              coin.BtcUnitDefault,
			expectedLimitAmount:     "0.00200000",
			expectedLimitLabel:      "0.002 BTC",
			expectedRemainingAmount: "0.00200000",
			expectedRemainingLabel:  "0.002 BTC",
			expectedExcessAmount:    "0.00000000",
			expectedExcessLabel:     "0 BTC",
			expectedUnit:            "BTC",
		},
		{
			name:                    "request exactly fills remaining capacity",
			availableSat:            lightningBalanceLimitSat - 1,
			formatUnit:              coin.BtcUnitSats,
			hasRequestedAmount:      true,
			requestedAmountSat:      1,
			expectedLimitAmount:     "200000",
			expectedLimitLabel:      "200000 sat",
			expectedRemainingAmount: "1",
			expectedRemainingLabel:  "1 sat",
			expectedExcessAmount:    "0",
			expectedExcessLabel:     "0 sat",
			expectedUnit:            "sat",
		},
		{
			name:                       "request exceeds remaining capacity by one sat",
			availableSat:               lightningBalanceLimitSat - 1,
			formatUnit:                 coin.BtcUnitSats,
			hasRequestedAmount:         true,
			requestedAmountSat:         2,
			expectedLimitAmount:        "200000",
			expectedLimitLabel:         "200000 sat",
			expectedRemainingAmount:    "1",
			expectedRemainingLabel:     "1 sat",
			expectedExcessAmount:       "1",
			expectedExcessLabel:        "1 sat",
			expectedUnit:               "sat",
			expectedAmountExceedsLimit: true,
		},
		{
			name:                    "balance exactly at limit",
			availableSat:            lightningBalanceLimitSat,
			formatUnit:              coin.BtcUnitDefault,
			hasRequestedAmount:      true,
			expectedLimitAmount:     "0.00200000",
			expectedLimitLabel:      "0.002 BTC",
			expectedRemainingAmount: "0.00000000",
			expectedRemainingLabel:  "0 BTC",
			expectedExcessAmount:    "0.00000000",
			expectedExcessLabel:     "0 BTC",
			expectedUnit:            "BTC",
			expectedLimitReached:    true,
		},
		{
			name:                    "balance above limit clamps remaining to zero",
			availableSat:            lightningBalanceLimitSat + 1,
			formatUnit:              coin.BtcUnitSats,
			expectedLimitAmount:     "200000",
			expectedLimitLabel:      "200000 sat",
			expectedRemainingAmount: "0",
			expectedRemainingLabel:  "0 sat",
			expectedExcessAmount:    "1",
			expectedExcessLabel:     "1 sat",
			expectedUnit:            "sat",
			expectedLimitReached:    true,
			expectedLimitExceeded:   true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			lightning.btcCoin.(*btccoin.Coin).SetFormatUnit(testCase.formatUnit)
			lightning.sdkService = &balanceLimitTestSDK{balanceSats: testCase.availableSat}

			var requestedAmount *coin.Amount
			if testCase.hasRequestedAmount {
				amount := coin.NewAmountFromInt64(testCase.requestedAmountSat)
				requestedAmount = &amount
			}

			limit, err := lightning.BalanceLimit(requestedAmount)
			require.NoError(t, err)
			require.Equal(t, coin.FormattedAmountWithConversions{
				Amount:      testCase.expectedLimitAmount,
				Unit:        testCase.expectedUnit,
				Conversions: coin.ConversionsMap{},
			}, limit.Amount)
			require.Equal(t, testCase.expectedLimitLabel, limit.AmountLabel)
			require.Equal(t, coin.FormattedAmountWithConversions{
				Amount:      testCase.expectedRemainingAmount,
				Unit:        testCase.expectedUnit,
				Conversions: coin.ConversionsMap{},
			}, limit.RemainingAmount)
			require.Equal(t, testCase.expectedRemainingLabel, limit.RemainingAmountLabel)
			require.Equal(t, coin.FormattedAmountWithConversions{
				Amount:      testCase.expectedExcessAmount,
				Unit:        testCase.expectedUnit,
				Conversions: coin.ConversionsMap{},
			}, limit.ExcessAmount)
			require.Equal(t, testCase.expectedExcessLabel, limit.ExcessAmountLabel)
			require.Equal(t, testCase.expectedLimitReached, limit.LimitReached)
			require.Equal(t, testCase.expectedLimitExceeded, limit.LimitExceeded)
			require.Equal(t, testCase.expectedAmountExceedsLimit, limit.AmountExceedsLimit)
		})
	}
}

func TestReceivePaymentAllowsAmountAboveBalanceLimit(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{Code: "v0-test-ln-0"}))
	sdk := &receivePaymentTestSDK{}
	lightning.sdkService = sdk
	amountSat := uint64(lightningBalanceLimitSat + 1)

	response, err := lightning.ReceivePayment(amountSat, "Over-limit invoice")
	require.NoError(t, err)
	require.Equal(t, &receivePaymentResponse{Invoice: "lnbc1invoice"}, response)
	require.Equal(t, breez_sdk_spark.ReceivePaymentRequest{
		PaymentMethod: breez_sdk_spark.ReceivePaymentMethodBolt11Invoice{
			Description: "Over-limit invoice",
			AmountSats:  &amountSat,
		},
	}, sdk.request)
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
