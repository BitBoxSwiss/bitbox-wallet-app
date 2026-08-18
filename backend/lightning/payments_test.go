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
	accountsMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	btccoin "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

const testCloseWithdrawDestinationAccountCode accountsTypes.Code = "btc-0"

const (
	testP2PKHAddress  = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
	testP2SHAddress   = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"
	testP2TRAddress   = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297"
	testP2WPKHAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
)

type testPaymentAddress string

func (address testPaymentAddress) ID() string {
	return string(address)
}

func (address testPaymentAddress) EncodeForHumans() string {
	return string(address)
}

func (testPaymentAddress) AbsoluteKeypath() signing.AbsoluteKeypath {
	return nil
}

func testCloseWithdrawAccount() accounts.Interface {
	p2wpkh := signing.ScriptTypeP2WPKH
	p2tr := signing.ScriptTypeP2TR
	return &accountsMocks.InterfaceMock{
		ConfigFunc: func() *accounts.AccountConfig {
			return &accounts.AccountConfig{
				Config: &config.Account{
					CoinCode:          coin.CodeBTC,
					ReceiveScriptType: &p2tr,
				},
			}
		},
		GetUnusedReceiveAddressesFunc: func() ([]accounts.AddressList, error) {
			return []accounts.AddressList{
				{
					ScriptType: &p2wpkh,
					Addresses:  []accounts.Address{testPaymentAddress(testP2WPKHAddress)},
				},
				{
					ScriptType: &p2tr,
					Addresses:  []accounts.Address{testPaymentAddress(testP2TRAddress)},
				},
			}, nil
		},
	}
}

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

func TestTransactions(t *testing.T) {
	lightning := newTestLightning(t, nil)
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))

	lightning.sdkService = &testBreezSDK{
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

func TestToLightningPaymentWithdraw(t *testing.T) {
	lightning := makeTestLightning()
	details := breez_sdk_spark.PaymentDetails(breez_sdk_spark.PaymentDetailsWithdraw{
		TxId: "withdraw-txid",
	})

	payment := lightning.toLightningPayment(breez_sdk_spark.Payment{
		Id:          "spark-payment-id",
		PaymentType: breez_sdk_spark.PaymentTypeSend,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(4),
		Details:     &details,
	})

	require.Equal(t, "spark-payment-id", payment.ID)
	require.Equal(t, "withdraw-txid", payment.TxID)
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
	claimError := testTopUpClaimError(123)
	claimFee := lightning.formatSats(123, true)
	claimFeeSat := uint64(123)

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
				ClaimError: claimError,
			},
			expected: bitcoinDeposit{
				TxID:        "txid-unclaimed",
				State:       bitcoinDepositStateUnclaimed,
				ClaimFee:    &claimFee,
				ClaimFeeSat: &claimFeeSat,
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
					{AmountSats: 400, RefundTxId: stringPointer("refund-txid")},
				},
			}, nil
		},
		recommendedFees: func() (breez_sdk_spark.RecommendedFees, error) {
			return breez_sdk_spark.RecommendedFees{FastestFee: 12}, nil
		},
	})

	payments, err := lightning.ListPayments()

	require.NoError(t, err)
	require.Len(t, payments, 2)
	require.Equal(t, "bitcoin-deposit:deposit-txid:1", payments[0].ID)
	require.NotNil(t, payments[0].BitcoinDeposit)
	require.NotNil(t, payments[0].BitcoinDeposit.RefundFeeRateSatPerVbyte)
	require.Equal(t, uint64(12), *payments[0].BitcoinDeposit.RefundFeeRateSatPerVbyte)
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
					{AmountSats: 400, RefundTxId: stringPointer("refund-txid")},
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

func TestParseBitcoinPaymentInput(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.parseInput = func(input string) (breez_sdk_spark.InputType, error) {
		require.Equal(t, "bc1qraw", input)
		return breez_sdk_spark.InputTypeBitcoinAddress{
			Field0: breez_sdk_spark.BitcoinAddressDetails{Address: "bc1qraw"},
		}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	input, err := lightning.ParsePaymentInput("bc1qraw")

	require.NoError(t, err)
	require.Equal(t, paymentInputTypeBitcoinAddress, input.Type)
	require.NotNil(t, input.BitcoinAddress)
	require.Equal(t, "bc1qraw", input.BitcoinAddress.Address)
	require.Nil(t, input.BitcoinAddress.AmountSat)
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

			require.Equal(t, breez_sdk_spark.PaymentRequestInput{Input: "lnbc1invoice"}, request.PaymentRequest)
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
		testP2WPKHAddress,
		10_000,
		breez_sdk_spark.FeePolicyFeesIncluded,
	)

	require.Equal(t, breez_sdk_spark.PaymentRequestInput{Input: testP2WPKHAddress}, request.PaymentRequest)
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

	balanceSats           uint64
	parseInput            func(string) (breez_sdk_spark.InputType, error)
	prepareSend           func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error)
	prepareLNURLPay       func(breez_sdk_spark.PrepareLnurlPayRequest) (breez_sdk_spark.PrepareLnurlPayResponse, error)
	send                  func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error)
	lnurlPay              func(breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error)
	listUnclaimedDeposits func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error)
	claimDeposit          func(breez_sdk_spark.ClaimDepositRequest) (breez_sdk_spark.ClaimDepositResponse, error)
	refundDeposit         func(breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error)
	recommendedFees       func() (breez_sdk_spark.RecommendedFees, error)
	disconnectCalled      bool
	destroyCalled         bool
}

func (sdk *testPaymentSDK) GetInfo(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error) {
	return breez_sdk_spark.GetInfoResponse{BalanceSats: sdk.balanceSats}, nil
}

func (sdk *testPaymentSDK) Parse(input string) (breez_sdk_spark.InputType, error) {
	return sdk.parseInput(input)
}

func (sdk *testPaymentSDK) PrepareSendPayment(
	request breez_sdk_spark.PrepareSendPaymentRequest,
) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
	return sdk.prepareSend(request)
}

func (sdk *testPaymentSDK) PrepareLnurlPay(
	request breez_sdk_spark.PrepareLnurlPayRequest,
) (breez_sdk_spark.PrepareLnurlPayResponse, error) {
	return sdk.prepareLNURLPay(request)
}

func (sdk *testPaymentSDK) SendPayment(
	request breez_sdk_spark.SendPaymentRequest,
) (breez_sdk_spark.SendPaymentResponse, error) {
	return sdk.send(request)
}

func (sdk *testPaymentSDK) LnurlPay(
	request breez_sdk_spark.LnurlPayRequest,
) (breez_sdk_spark.LnurlPayResponse, error) {
	return sdk.lnurlPay(request)
}

func (sdk *testPaymentSDK) ListUnclaimedDeposits(
	request breez_sdk_spark.ListUnclaimedDepositsRequest,
) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
	return sdk.listUnclaimedDeposits(request)
}

func (sdk *testPaymentSDK) ClaimDeposit(
	request breez_sdk_spark.ClaimDepositRequest,
) (breez_sdk_spark.ClaimDepositResponse, error) {
	return sdk.claimDeposit(request)
}

func (sdk *testPaymentSDK) RefundDeposit(
	request breez_sdk_spark.RefundDepositRequest,
) (breez_sdk_spark.RefundDepositResponse, error) {
	return sdk.refundDeposit(request)
}

func (sdk *testPaymentSDK) RecommendedFees() (breez_sdk_spark.RecommendedFees, error) {
	return sdk.recommendedFees()
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
	return newActivePaymentTestLightningWithConfigFilenames(
		t,
		sdk,
		test.TstTempFile("appConfig"),
		test.TstTempFile("accountsConfig"),
		lightningConfigFilename,
	)
}

func newActivePaymentTestLightningWithConfigFilenames(
	t *testing.T,
	sdk *testPaymentSDK,
	appConfigFilename string,
	accountsConfigFilename string,
	lightningConfigFilename string,
) *Lightning {
	t.Helper()

	lightning := newTestLightningWithConfigFilenames(
		t,
		nil,
		appConfigFilename,
		accountsConfigFilename,
		lightningConfigFilename,
	)
	displayLightning := makeTestLightning()
	lightning.btcCoin = displayLightning.btcCoin
	lightning.ratesUpdater = displayLightning.ratesUpdater
	if lightning.Account() == nil {
		require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{
			Seed:            "test mnemonic",
			RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
			Code:            "v0-deadbeef-ln-0",
			Number:          0,
		}))
	}
	lightning.sdkService = sdk
	lightning.getAccount = func(accountCode accountsTypes.Code) (accounts.Interface, error) {
		require.Equal(t, testCloseWithdrawDestinationAccountCode, accountCode)
		return testCloseWithdrawAccount(), nil
	}
	return lightning
}

func testLNURLPayDetails() breez_sdk_spark.LnurlPayRequestDetails {
	return breez_sdk_spark.LnurlPayRequestDetails{
		Callback:    "https://example.com/lnurl/callback",
		MinSendable: 1_000,
		MaxSendable: 1_000_000,
		Domain:      "example.com",
		Url:         "https://example.com/.well-known/lnurlp/alice",
	}
}

func testLNURLPaymentSDK(
	t *testing.T,
	invoice string,
	pay func(breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error),
) *testPaymentSDK {
	t.Helper()
	details := testLNURLPayDetails()
	return &testPaymentSDK{
		balanceSats: 1_000,
		parseInput: func(input string) (breez_sdk_spark.InputType, error) {
			require.Equal(t, "alice@example.com", input)
			return breez_sdk_spark.InputTypeLnurlPay{Field0: details}, nil
		},
		prepareLNURLPay: func(request breez_sdk_spark.PrepareLnurlPayRequest) (breez_sdk_spark.PrepareLnurlPayResponse, error) {
			require.Zero(t, request.Amount.Cmp(big.NewInt(100)))
			return breez_sdk_spark.PrepareLnurlPayResponse{
				AmountSats: 100,
				FeeSats:    2,
				PayRequest: details,
				InvoiceDetails: breez_sdk_spark.Bolt11InvoiceDetails{
					Invoice: breez_sdk_spark.Bolt11Invoice{Bolt11: invoice},
				},
			}, nil
		},
		lnurlPay: pay,
	}
}

func TestLNURLPaymentIntentLifecycle(t *testing.T) {
	t.Parallel()

	// Reuse every config file because Config loads them in sequence and stops at the first missing file.
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")
	firstSendErr := errors.New("response lost")
	var firstKey string
	firstSDK := testLNURLPaymentSDK(t, "lnbc1first", func(request breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error) {
		require.NotNil(t, request.IdempotencyKey)
		firstKey = *request.IdempotencyKey
		return breez_sdk_spark.LnurlPayResponse{}, firstSendErr
	})
	lightning := newActivePaymentTestLightningWithConfigFilenames(
		t,
		firstSDK,
		appConfigFilename,
		accountsConfigFilename,
		lightningConfigFilename,
	)
	amountSat := uint64(100)
	request := sendPaymentRequest{
		Type:           paymentInputTypeLNURLPay,
		PaymentInput:   "alice@example.com",
		AmountSat:      &amountSat,
		ApprovedFeeSat: 2,
	}

	err := lightning.SendPayment(request)
	require.ErrorIs(t, err, firstSendErr)
	parsedKey, err := uuid.Parse(firstKey)
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, parsedKey)

	fingerprint := lnurlPaymentFingerprint(testLNURLPayDetails(), amountSat)
	intent, ok := lightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.True(t, ok)
	require.Equal(t, firstKey, intent.IdempotencyKey)
	require.False(t, intent.Completed)
	fee, err := lightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeLNURLPay,
		PaymentInput: "alice@example.com",
		AmountSat:    &amountSat,
		StartNew:     true,
	})
	require.NoError(t, err)
	require.Equal(t, paymentIntentStatusInFlight, fee.LogicalPaymentStatus)
	intent, ok = lightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.True(t, ok)
	require.Equal(t, firstKey, intent.IdempotencyKey)
	require.False(t, intent.Completed)

	var retriedKey string
	prepareCalls := 0
	retrySDK := testLNURLPaymentSDK(t, "lnbc1second", func(request breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error) {
		require.NotNil(t, request.IdempotencyKey)
		retriedKey = *request.IdempotencyKey
		return breez_sdk_spark.LnurlPayResponse{}, nil
	})
	originalPrepare := retrySDK.prepareLNURLPay
	retrySDK.prepareLNURLPay = func(request breez_sdk_spark.PrepareLnurlPayRequest) (breez_sdk_spark.PrepareLnurlPayResponse, error) {
		prepareCalls++
		return originalPrepare(request)
	}
	retrySDK.balanceSats = 0
	restartedLightning := newActivePaymentTestLightningWithConfigFilenames(
		t,
		retrySDK,
		appConfigFilename,
		accountsConfigFilename,
		lightningConfigFilename,
	)
	restartedIntent, ok := restartedLightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.True(t, ok)
	require.False(t, restartedIntent.Completed)

	require.NoError(t, restartedLightning.SendPayment(request))
	require.Equal(t, firstKey, retriedKey)
	intent, ok = restartedLightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.True(t, ok)
	require.True(t, intent.Completed)

	prepareCallsBeforeCompletedRetry := prepareCalls
	require.NoError(t, restartedLightning.SendPayment(request))
	require.Equal(t, prepareCallsBeforeCompletedRetry, prepareCalls)

	fee, err = restartedLightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeLNURLPay,
		PaymentInput: "alice@example.com",
		AmountSat:    &amountSat,
	})
	require.NoError(t, err)
	require.Equal(t, paymentIntentStatusCompleted, fee.LogicalPaymentStatus)

	retrySDK.balanceSats = 1_000
	fee, err = restartedLightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeLNURLPay,
		PaymentInput: "alice@example.com",
		AmountSat:    &amountSat,
		StartNew:     true,
	})
	require.NoError(t, err)
	require.Empty(t, fee.LogicalPaymentStatus)
	_, ok = restartedLightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.False(t, ok)

	retriedKey = ""
	require.NoError(t, restartedLightning.SendPayment(request))
	require.NotEqual(t, firstKey, retriedKey)
	intent, ok = restartedLightning.backendConfig.LookupLightningPaymentIntent(fingerprint)
	require.True(t, ok)
	require.Equal(t, retriedKey, intent.IdempotencyKey)
	require.True(t, intent.Completed)
}

func TestLNURLPaymentDoesNotSendWhenIntentCannotBePersisted(t *testing.T) {
	t.Parallel()

	lnurlPayCalled := false
	sdk := testLNURLPaymentSDK(t, "lnbc1invoice", func(breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error) {
		lnurlPayCalled = true
		return breez_sdk_spark.LnurlPayResponse{}, nil
	})
	lightningConfigFilename := test.TstTempFile("lightningConfig")
	lightning := newActivePaymentTestLightningWithConfigFilename(t, sdk, lightningConfigFilename)
	require.NoError(t, os.Remove(lightningConfigFilename))
	require.NoError(t, os.Mkdir(lightningConfigFilename, 0o700))
	t.Cleanup(func() {
		require.NoError(t, os.Remove(lightningConfigFilename))
	})
	amountSat := uint64(100)

	err := lightning.SendPayment(sendPaymentRequest{
		Type:           paymentInputTypeLNURLPay,
		PaymentInput:   "alice@example.com",
		AmountSat:      &amountSat,
		ApprovedFeeSat: 2,
	})

	require.Error(t, err)
	require.False(t, lnurlPayCalled)
	_, ok := lightning.backendConfig.LookupLightningPaymentIntent(
		lnurlPaymentFingerprint(testLNURLPayDetails(), amountSat),
	)
	require.False(t, ok)
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

func testTopUpClaimError(requiredFeeSat uint64) *breez_sdk_spark.DepositClaimError {
	claimError := breez_sdk_spark.DepositClaimError(breez_sdk_spark.DepositClaimErrorMaxDepositClaimFeeExceeded{
		Tx:              "deposit-txid",
		Vout:            1,
		RequiredFeeSats: requiredFeeSat,
	})
	return &claimError
}

func testUnclaimedDeposit(requiredFeeSat uint64) breez_sdk_spark.DepositInfo {
	return breez_sdk_spark.DepositInfo{
		Txid:       "deposit-txid",
		Vout:       1,
		AmountSats: 10_000,
		IsMature:   true,
		ClaimError: testTopUpClaimError(requiredFeeSat),
	}
}

func TestClaimTopUp(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(123),
			},
		}, nil
	}
	sdk.claimDeposit = func(request breez_sdk_spark.ClaimDepositRequest) (breez_sdk_spark.ClaimDepositResponse, error) {
		require.Equal(t, "deposit-txid", request.Txid)
		require.Equal(t, uint32(1), request.Vout)
		require.NotNil(t, request.MaxFee)
		maxFee, ok := (*request.MaxFee).(breez_sdk_spark.MaxFeeFixed)
		require.True(t, ok)
		require.Equal(t, uint64(123), maxFee.Amount)
		details := breez_sdk_spark.PaymentDetails(breez_sdk_spark.PaymentDetailsDeposit{TxId: "claim-txid"})
		return breez_sdk_spark.ClaimDepositResponse{
			Payment: breez_sdk_spark.Payment{Details: &details},
		}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.ClaimTopUp("bitcoin-deposit:deposit-txid:1", 123)

	require.NoError(t, err)
	require.Equal(t, "claim-txid", result.TxID)
}

func TestClaimTopUpRejectsIncreasedFee(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(124),
			},
		}, nil
	}
	sdk.claimDeposit = func(breez_sdk_spark.ClaimDepositRequest) (breez_sdk_spark.ClaimDepositResponse, error) {
		t.Fatal("unapproved fee must not claim deposit")
		return breez_sdk_spark.ClaimDepositResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.ClaimTopUp("bitcoin-deposit:deposit-txid:1", 123)

	require.Nil(t, result)
	require.Equal(t, errPaymentApprovalRequired, errp.Cause(err))
}

func TestClaimTopUpRejectsMissingDeposit(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{}, nil
	}
	sdk.claimDeposit = func(breez_sdk_spark.ClaimDepositRequest) (breez_sdk_spark.ClaimDepositResponse, error) {
		t.Fatal("missing deposit must not be claimed")
		return breez_sdk_spark.ClaimDepositResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.ClaimTopUp("bitcoin-deposit:deposit-txid:1", 123)

	require.Nil(t, result)
	require.ErrorContains(t, err, "unclaimed deposit not found")
}

func TestRefundTopUp(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(123),
			},
		}, nil
	}
	sdk.recommendedFees = func() (breez_sdk_spark.RecommendedFees, error) {
		return breez_sdk_spark.RecommendedFees{FastestFee: 12}, nil
	}
	sdk.refundDeposit = func(request breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error) {
		require.Equal(t, "deposit-txid", request.Txid)
		require.Equal(t, uint32(1), request.Vout)
		require.Equal(t, testP2TRAddress, request.DestinationAddress)
		fee, ok := request.Fee.(breez_sdk_spark.FeeRate)
		require.True(t, ok)
		require.Equal(t, uint64(12), fee.SatPerVbyte)
		return breez_sdk_spark.RefundDepositResponse{TxId: "refund-txid"}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.RefundTopUp("bitcoin-deposit:deposit-txid:1", testCloseWithdrawDestinationAccountCode, 12)

	require.NoError(t, err)
	require.Equal(t, "refund-txid", result.TxID)
}

func TestRefundTopUpRejectsDepositBeingClaimed(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				{
					Txid:       "deposit-txid",
					Vout:       1,
					AmountSats: 10_000,
					IsMature:   true,
				},
			},
		}, nil
	}
	sdk.refundDeposit = func(breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error) {
		t.Fatal("deposit being claimed must not be refunded")
		return breez_sdk_spark.RefundDepositResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.RefundTopUp(
		"bitcoin-deposit:deposit-txid:1",
		testCloseWithdrawDestinationAccountCode,
		123,
	)

	require.Nil(t, result)
	require.ErrorContains(t, err, "deposit is no longer unclaimed")
}

func TestRefundTopUpUsesFastestRecommendedFeeRate(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(123),
			},
		}, nil
	}
	sdk.recommendedFees = func() (breez_sdk_spark.RecommendedFees, error) {
		return breez_sdk_spark.RecommendedFees{FastestFee: 12, MinimumFee: 2}, nil
	}
	sdk.refundDeposit = func(request breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error) {
		fee, ok := request.Fee.(breez_sdk_spark.FeeRate)
		require.True(t, ok)
		require.Equal(t, uint64(12), fee.SatPerVbyte)
		return breez_sdk_spark.RefundDepositResponse{TxId: "refund-txid"}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.RefundTopUp("bitcoin-deposit:deposit-txid:1", testCloseWithdrawDestinationAccountCode, 12)

	require.NoError(t, err)
	require.Equal(t, "refund-txid", result.TxID)
}

func TestRefundTopUpUsesMinimumFeeRate(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(123),
			},
		}, nil
	}
	sdk.recommendedFees = func() (breez_sdk_spark.RecommendedFees, error) {
		return breez_sdk_spark.RecommendedFees{FastestFee: 1}, nil
	}
	sdk.refundDeposit = func(request breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error) {
		fee, ok := request.Fee.(breez_sdk_spark.FeeRate)
		require.True(t, ok)
		require.Equal(t, uint64(2), fee.SatPerVbyte)
		return breez_sdk_spark.RefundDepositResponse{TxId: "refund-txid"}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.RefundTopUp("bitcoin-deposit:deposit-txid:1", testCloseWithdrawDestinationAccountCode, 2)

	require.NoError(t, err)
	require.Equal(t, "refund-txid", result.TxID)
}

func TestRefundTopUpRejectsIncreasedFeeRate(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{}
	sdk.listUnclaimedDeposits = func(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error) {
		return breez_sdk_spark.ListUnclaimedDepositsResponse{
			Deposits: []breez_sdk_spark.DepositInfo{
				testUnclaimedDeposit(123),
			},
		}, nil
	}
	sdk.recommendedFees = func() (breez_sdk_spark.RecommendedFees, error) {
		return breez_sdk_spark.RecommendedFees{FastestFee: 13}, nil
	}
	sdk.refundDeposit = func(breez_sdk_spark.RefundDepositRequest) (breez_sdk_spark.RefundDepositResponse, error) {
		t.Fatal("unapproved fee rate must not refund deposit")
		return breez_sdk_spark.RefundDepositResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.RefundTopUp("bitcoin-deposit:deposit-txid:1", testCloseWithdrawDestinationAccountCode, 12)

	require.Nil(t, result)
	require.Equal(t, errPaymentApprovalRequired, errp.Cause(err))
}

func testStandardBitcoinPrepareResponse(amountSat uint64, feeSat uint64) breez_sdk_spark.PrepareSendPaymentResponse {
	return breez_sdk_spark.PrepareSendPaymentResponse{
		PaymentMethod: breez_sdk_spark.SendPaymentMethodBitcoinAddress{
			FeeQuote: breez_sdk_spark.SendOnchainFeeQuote{
				SpeedFast: breez_sdk_spark.SendOnchainSpeedFeeQuote{
					UserFeeSat:        feeSat - 1,
					L1BroadcastFeeSat: 1,
				},
			},
		},
		Amount:    new(big.Int).SetUint64(amountSat),
		FeePolicy: breez_sdk_spark.FeePolicyFeesExcluded,
	}
}

func TestPrepareBitcoinPayment(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		require.Equal(t, breez_sdk_spark.PaymentRequestInput{Input: testP2WPKHAddress}, request.PaymentRequest)
		require.NotNil(t, request.Amount)
		require.Zero(t, (*request.Amount).Cmp(big.NewInt(5_000)))
		require.NotNil(t, request.FeePolicy)
		require.Equal(t, breez_sdk_spark.FeePolicyFeesExcluded, *request.FeePolicy)
		return testStandardBitcoinPrepareResponse(5_000, 1_000), nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("prepare must not send payment")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(5_000)

	fee, err := lightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeBitcoinAddress,
		PaymentInput: testP2WPKHAddress,
		AmountSat:    &amountSat,
	})

	require.NoError(t, err)
	require.NotEmpty(t, fee.IdempotencyKey)
	idempotencyKey, err := uuid.Parse(fee.IdempotencyKey)
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, idempotencyKey)
	fee.IdempotencyKey = ""
	require.Equal(t, &paymentFee{
		AmountSat:     5_000,
		FeeSat:        1_000,
		TotalDebitSat: 6_000,
	}, fee)

	const existingIdempotencyKey = "00000000-0000-4000-8000-000000000001"
	fee, err = lightning.PreparePayment(preparePaymentRequest{
		Type:           paymentInputTypeBitcoinAddress,
		PaymentInput:   testP2WPKHAddress,
		AmountSat:      &amountSat,
		IdempotencyKey: existingIdempotencyKey,
	})

	require.NoError(t, err)
	require.Equal(t, existingIdempotencyKey, fee.IdempotencyKey)
}

func TestPrepareBitcoinPaymentRejectsBelowMinimum(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		t.Fatal("amount below minimum must not be passed to the SDK")
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(293)

	fee, err := lightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeBitcoinAddress,
		PaymentInput: testP2WPKHAddress,
		AmountSat:    &amountSat,
	})

	require.Nil(t, fee)
	var amountBelowMinimum *lightningAmountBelowMinimumError
	require.ErrorAs(t, err, &amountBelowMinimum)
	require.Equal(t, uint64(294), amountBelowMinimum.minAmountSat)
}

func TestPrepareBitcoinPaymentRejectsAmountAboveAvailableBalance(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		t.Fatal("amount above available balance must not be passed to the SDK")
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(10_001)

	fee, err := lightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeBitcoinAddress,
		PaymentInput: testP2WPKHAddress,
		AmountSat:    &amountSat,
	})

	require.Nil(t, fee)
	require.ErrorIs(t, err, errLightningInsufficientFunds)
	require.Equal(t, string(errLightningInsufficientFunds), errorResponse(err).ErrorCode)
}

func TestPrepareBitcoinPaymentReturnsFeeWhenTotalExceedsAvailableBalance(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testStandardBitcoinPrepareResponse(9_500, 1_000), nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(9_500)

	fee, err := lightning.PreparePayment(preparePaymentRequest{
		Type:         paymentInputTypeBitcoinAddress,
		PaymentInput: testP2WPKHAddress,
		AmountSat:    &amountSat,
	})

	require.ErrorIs(t, err, errLightningInsufficientFunds)
	require.Equal(t, &paymentFee{
		AmountSat:     9_500,
		FeeSat:        1_000,
		TotalDebitSat: 10_500,
	}, fee)
	require.Equal(t, map[string]interface{}{
		"amountSat":     uint64(9_500),
		"feeSat":        uint64(1_000),
		"totalDebitSat": uint64(10_500),
	}, preparePaymentErrorResponse(err, fee).ErrorData)
}

func TestSendBitcoinPayment(t *testing.T) {
	t.Parallel()

	prepareResponse := testStandardBitcoinPrepareResponse(5_000, 1_000)
	idempotencyKey := "00000000-0000-4000-8000-000000000001"
	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return prepareResponse, nil
	}
	sdk.send = func(request breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		require.Equal(t, prepareResponse, request.PrepareResponse)
		require.NotNil(t, request.Options)
		options, ok := (*request.Options).(breez_sdk_spark.SendPaymentOptionsBitcoinAddress)
		require.True(t, ok)
		require.Equal(t, breez_sdk_spark.OnchainConfirmationSpeedFast, options.ConfirmationSpeed)
		require.NotNil(t, request.IdempotencyKey)
		require.Equal(t, idempotencyKey, *request.IdempotencyKey)
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(5_000)

	err := lightning.SendPayment(sendPaymentRequest{
		Type:           paymentInputTypeBitcoinAddress,
		PaymentInput:   testP2WPKHAddress,
		AmountSat:      &amountSat,
		ApprovedFeeSat: 1_000,
		IdempotencyKey: idempotencyKey,
	})

	require.NoError(t, err)
}

func TestSendBitcoinPaymentRejectsBelowMinimum(t *testing.T) {
	t.Parallel()

	const feeSat = uint64(1)
	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		return testStandardBitcoinPrepareResponse(293, feeSat), nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("amount below minimum must not be sent")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(293)

	err := lightning.SendPayment(sendPaymentRequest{
		Type:           paymentInputTypeBitcoinAddress,
		PaymentInput:   testP2WPKHAddress,
		AmountSat:      &amountSat,
		ApprovedFeeSat: feeSat,
		IdempotencyKey: "00000000-0000-4000-8000-000000000001",
	})

	var amountBelowMinimum *lightningAmountBelowMinimumError
	require.ErrorAs(t, err, &amountBelowMinimum)
	require.Equal(t, uint64(294), amountBelowMinimum.minAmountSat)
}

func TestSendBitcoinPaymentRequiresIdempotencyKey(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		t.Fatal("payment must not be prepared without an idempotency key")
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("payment must not be sent without an idempotency key")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)
	amountSat := uint64(5_000)

	err := lightning.SendPayment(sendPaymentRequest{
		Type:           paymentInputTypeBitcoinAddress,
		PaymentInput:   testP2WPKHAddress,
		AmountSat:      &amountSat,
		ApprovedFeeSat: 1_000,
	})

	require.ErrorIs(t, err, errLightningInvalidPaymentInput)
}

func TestPrepareCloseWithdraw(t *testing.T) {
	t.Parallel()

	sdk := &testPaymentSDK{balanceSats: 10_000}
	sdk.prepareSend = func(request breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		require.Equal(t, breez_sdk_spark.PaymentRequestInput{Input: testP2TRAddress}, request.PaymentRequest)
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

	quote, err := lightning.PrepareCloseWithdraw(testCloseWithdrawDestinationAccountCode)

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

	result, err := lightning.CloseWithdraw(testCloseWithdrawDestinationAccountCode, 10_000, 1_000)

	require.NoError(t, err)
	require.Equal(t, "tx-id", result.TxID)
	require.True(t, result.WalletClosed)
	require.Nil(t, lightning.Account())
	require.True(t, sdk.disconnectCalled)
	require.True(t, sdk.destroyCalled)
}

func TestCloseWithdrawRejectsBelowMinimumAfterFees(t *testing.T) {
	t.Parallel()

	const (
		amountSat = uint64(336)
		feeSat    = uint64(7)
	)
	sdk := &testPaymentSDK{balanceSats: amountSat}
	sdk.prepareSend = func(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error) {
		response := testBitcoinPrepareResponse(feeSat)
		response.Amount = new(big.Int).SetUint64(amountSat)
		return response, nil
	}
	sdk.send = func(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error) {
		t.Fatal("amount below minimum after fees must not be sent")
		return breez_sdk_spark.SendPaymentResponse{}, nil
	}
	lightning := newActivePaymentTestLightning(t, sdk)

	result, err := lightning.CloseWithdraw(
		testCloseWithdrawDestinationAccountCode,
		amountSat,
		feeSat,
	)

	require.Nil(t, result)
	var amountBelowMinimum *lightningAmountBelowMinimumError
	require.ErrorAs(t, err, &amountBelowMinimum)
	require.Equal(t, uint64(330), amountBelowMinimum.minAmountSat)
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

	result, err := lightning.CloseWithdraw(testCloseWithdrawDestinationAccountCode, 10_000, 1_000)

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

	result, err := lightning.CloseWithdraw(testCloseWithdrawDestinationAccountCode, 10_000, 1_000)

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

	result, err := lightning.CloseWithdraw(testCloseWithdrawDestinationAccountCode, 10_000, 1_000)

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

	result, err := lightning.CloseWithdraw(testCloseWithdrawDestinationAccountCode, 10_000, 1_000)

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

			availableBalance := coin.NewAmountFromInt64(testCase.availableSat)
			err := checkPaymentBalance(&paymentFee{TotalDebitSat: testCase.totalDebitSat}, availableBalance)
			require.Equal(t, testCase.expectedErr, errp.Cause(err))
		})
	}
}

func TestValidateBitcoinPaymentAmountAgainstDustLimit(t *testing.T) {
	t.Parallel()

	lightning := makeTestLightning()
	testCases := []struct {
		name         string
		address      string
		minAmountSat uint64
	}{
		{
			name:         "P2PKH",
			address:      testP2PKHAddress,
			minAmountSat: 546,
		},
		{
			name:         "P2SH",
			address:      testP2SHAddress,
			minAmountSat: 540,
		},
		{
			name:         "P2TR",
			address:      testP2TRAddress,
			minAmountSat: 330,
		},
		{
			name:         "P2WPKH",
			address:      testP2WPKHAddress,
			minAmountSat: 294,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			err := lightning.validateBitcoinPaymentAmountAgainstDustLimit(
				testCase.address,
				testCase.minAmountSat-1,
			)
			var amountBelowMinimum *lightningAmountBelowMinimumError
			require.ErrorAs(t, err, &amountBelowMinimum)
			require.Equal(t, testCase.minAmountSat, amountBelowMinimum.minAmountSat)

			require.NoError(t, lightning.validateBitcoinPaymentAmountAgainstDustLimit(
				testCase.address,
				testCase.minAmountSat,
			))
		})
	}
}

func TestLightningPaymentError(t *testing.T) {
	t.Parallel()

	unrelatedErr := errors.New("network unavailable")
	unrelatedInvalidInputErr := breez_sdk_spark.NewSdkErrorInvalidInput("Malformed payment request")
	testCases := []struct {
		name                  string
		err                   error
		expectedErr           error
		expectedErrorContains []string
	}{
		{
			name:                  "typed SDK insufficient funds",
			err:                   breez_sdk_spark.NewSdkErrorInsufficientFunds(nil),
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
			name:        "unrelated SDK invalid input",
			err:         unrelatedInvalidInputErr,
			expectedErr: unrelatedInvalidInputErr,
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

func TestErrorResponseAmountBelowMinimum(t *testing.T) {
	t.Parallel()

	response := errorResponse(&lightningAmountBelowMinimumError{minAmountSat: 294})

	require.False(t, response.Success)
	require.Equal(t, string(errLightningAmountBelowMinimum), response.ErrorCode)
	require.Equal(t, map[string]interface{}{"minAmountSat": uint64(294)}, response.ErrorData)
	require.Empty(t, response.ErrorMessage)
}
