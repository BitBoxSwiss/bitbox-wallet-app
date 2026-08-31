// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/wire/v2"
	"github.com/google/uuid"
)

const (
	errPaymentApprovalRequired      errp.ErrorCode = "paymentApprovalRequired"
	errLightningAmountBelowMinimum  errp.ErrorCode = "lightningAmountBelowMinimum"
	errLightningInvalidAmount       errp.ErrorCode = "lightningInvalidAmount"
	errLightningInvalidPaymentInput errp.ErrorCode = "lightningInvalidPaymentInput"
	errLightningInsufficientFunds   errp.ErrorCode = "lightningInsufficientFunds"
	errLightningInvoiceAlreadyUsed  errp.ErrorCode = "lightningInvoiceAlreadyUsed"
)

type lightningAmountBelowMinimumError struct {
	minAmountSat uint64
}

func (err *lightningAmountBelowMinimumError) Error() string {
	return errLightningAmountBelowMinimum.Error()
}

func (err *lightningAmountBelowMinimumError) Cause() error {
	return errLightningAmountBelowMinimum
}

type lightningBolt11Invoice struct {
	Invoice     string  `json:"invoice"`
	Description *string `json:"description,omitempty"`
	AmountSat   *uint64 `json:"amountSat,omitempty"`
}

type lightningLNURLPay struct {
	Input        string  `json:"input"`
	Address      *string `json:"address,omitempty"`
	Domain       string  `json:"domain"`
	Description  *string `json:"description,omitempty"`
	MinAmountSat uint64  `json:"minAmountSat"`
	MaxAmountSat uint64  `json:"maxAmountSat"`
}

type lightningBitcoinPaymentInput struct {
	Address     string  `json:"address"`
	AmountSat   *uint64 `json:"amountSat,omitempty"`
	Description *string `json:"description,omitempty"`
}

type paymentInput struct {
	Type           string                        `json:"type"`
	Bolt11         *lightningBolt11Invoice       `json:"invoice,omitempty"`
	LNURLPay       *lightningLNURLPay            `json:"lnurlPay,omitempty"`
	BitcoinAddress *lightningBitcoinPaymentInput `json:"bitcoinAddress,omitempty"`
}

type bitcoinDepositState string

const (
	bitcoinDepositStateConfirming bitcoinDepositState = "confirming"
	bitcoinDepositStateClaiming   bitcoinDepositState = "claiming"
	bitcoinDepositStateComplete   bitcoinDepositState = "complete"
	bitcoinDepositStateUnclaimed  bitcoinDepositState = "unclaimed"
)

type bitcoinDeposit struct {
	TxID                     string                               `json:"txid"`
	State                    bitcoinDepositState                  `json:"state"`
	ClaimFee                 *coin.FormattedAmountWithConversions `json:"claimFee,omitempty"`
	ClaimFeeSat              *uint64                              `json:"claimFeeSat,omitempty"`
	RefundFeeRateSatPerVbyte *uint64                              `json:"refundFeeRateSatPerVbyte,omitempty"`
}

type lightningPayment struct {
	ID                   string                              `json:"id"`
	Type                 accounts.TxType                     `json:"type"`
	Status               accounts.TxStatus                   `json:"status"`
	Time                 *string                             `json:"time"`
	Description          string                              `json:"description,omitempty"`
	Amount               coin.FormattedAmountWithConversions `json:"amount"`
	AmountAtTime         coin.FormattedAmountWithConversions `json:"amountAtTime"`
	DeductedAmountAtTime coin.FormattedAmountWithConversions `json:"deductedAmountAtTime"`
	Fee                  coin.FormattedAmountWithConversions `json:"fee"`
	Invoice              string                              `json:"invoice,omitempty"`
	TxID                 string                              `json:"txId,omitempty"`
	BitcoinDeposit       *bitcoinDeposit                     `json:"bitcoinDeposit,omitempty"`
}

type receivePaymentResponse struct {
	Invoice string `json:"invoice"`
}

type preparePaymentRequest struct {
	Type           string  `json:"type"`
	PaymentInput   string  `json:"paymentInput"`
	AmountSat      *uint64 `json:"amountSat,omitempty"`
	IdempotencyKey string  `json:"idempotencyKey,omitempty"`
}

type sendPaymentRequest struct {
	Type           string  `json:"type"`
	PaymentInput   string  `json:"paymentInput"`
	AmountSat      *uint64 `json:"amountSat"`
	ApprovedFeeSat uint64  `json:"approvedFeeSat"`
	IdempotencyKey string  `json:"idempotencyKey,omitempty"`
}

type paymentFee struct {
	AmountSat      uint64 `json:"amountSat"`
	FeeSat         uint64 `json:"feeSat"`
	TotalDebitSat  uint64 `json:"totalDebitSat"`
	IdempotencyKey string `json:"idempotencyKey,omitempty"`
}

type closeWithdrawQuote struct {
	Balance    coin.FormattedAmountWithConversions `json:"balance"`
	BalanceSat uint64                              `json:"balanceSat"`
	Fee        coin.FormattedAmountWithConversions `json:"fee"`
	FeeSat     uint64                              `json:"feeSat"`
}

type closeWithdrawResult struct {
	TxID         string `json:"txId,omitempty"`
	WalletClosed bool   `json:"walletClosed"`
}

const (
	paymentInputTypeBitcoinAddress = "bitcoinAddress"
	paymentInputTypeBolt11         = "bolt11"
	paymentInputTypeLNURLPay       = "lnurlPay"
)

type msatToSatRounding int

const (
	roundToFloor msatToSatRounding = iota
	roundToCeil
)

func msatToSat(msat uint64, rounding msatToSatRounding) uint64 {
	if rounding == roundToCeil {
		return (msat + 999) / 1000
	}
	return msat / 1000
}

func validateLNURLPayAmount(payRequest breez_sdk_spark.LnurlPayRequestDetails, amountSat uint64) error {
	if amountSat == 0 {
		return errLightningInvalidAmount
	}
	if amountSat < msatToSat(payRequest.MinSendable, roundToCeil) ||
		amountSat > msatToSat(payRequest.MaxSendable, roundToFloor) {
		return errLightningInvalidAmount
	}
	return nil
}

func lnurlPayDescription(metadataStr string) *string {
	var metadata [][]string
	if err := json.Unmarshal([]byte(metadataStr), &metadata); err != nil {
		return nil
	}
	for _, entry := range metadata {
		// LUD-06 requires a text/plain entry:
		// https://github.com/lnurl/luds/blob/luds/06.md
		// Use the first valid one as the payment description and ignore malformed entries.
		if len(entry) >= 2 && entry[0] == "text/plain" {
			description := entry[1]
			return &description
		}
	}
	return nil
}

func toLightningLNURLPay(inputStr string, payRequest breez_sdk_spark.LnurlPayRequestDetails) lightningLNURLPay {
	return lightningLNURLPay{
		Input:        inputStr,
		Address:      payRequest.Address,
		Domain:       payRequest.Domain,
		Description:  lnurlPayDescription(payRequest.MetadataStr),
		MinAmountSat: msatToSat(payRequest.MinSendable, roundToCeil),
		MaxAmountSat: msatToSat(payRequest.MaxSendable, roundToFloor),
	}
}

// ParsePaymentInput validates and classifies a lightning input string.
func (lightning *Lightning) ParsePaymentInput(inputStr string) (*paymentInput, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	input, err := lightning.sdkService.Parse(inputStr)
	if err != nil {
		lightning.log.WithError(err).Error("Parse lightning payment input failed")
		return nil, errLightningInvalidPaymentInput
	}

	switch inputType := input.(type) {
	case breez_sdk_spark.InputTypeBitcoinAddress:
		lightning.log.Debug("Input is Bitcoin address")
		return &paymentInput{
			Type: paymentInputTypeBitcoinAddress,
			BitcoinAddress: &lightningBitcoinPaymentInput{
				Address: inputType.Field0.Address,
			},
		}, nil

	case breez_sdk_spark.InputTypeBip21:
		// The SDK accepts required parameters for payment methods that BitBoxApp cannot execute.
		// Validate against the app's capabilities before selecting a supported fallback method.
		if err := lightning.validateBIP21RequiredParameters(inputType.Field0); err != nil {
			return nil, err
		}
		for _, paymentMethod := range inputType.Field0.PaymentMethods {
			if bolt11Invoice, ok := paymentMethod.(breez_sdk_spark.InputTypeBolt11Invoice); ok {
				return lightning.bolt11PaymentInput(bolt11Invoice, inputType.Field0.Message), nil
			}
		}
		for _, paymentMethod := range inputType.Field0.PaymentMethods {
			if bitcoinAddress, ok := paymentMethod.(breez_sdk_spark.InputTypeBitcoinAddress); ok {
				lightning.log.Debug("Input is BIP21 Bitcoin address")
				amountSat := inputType.Field0.AmountSat
				if amountSat != nil && *amountSat == 0 {
					amountSat = nil
				}
				return &paymentInput{
					Type: paymentInputTypeBitcoinAddress,
					BitcoinAddress: &lightningBitcoinPaymentInput{
						Address:     bitcoinAddress.Field0.Address,
						AmountSat:   amountSat,
						Description: inputType.Field0.Message,
					},
				}, nil
			}
		}

	case breez_sdk_spark.InputTypeBolt11Invoice:
		return lightning.bolt11PaymentInput(inputType, nil), nil

	case breez_sdk_spark.InputTypeLnurlPay:
		lightning.log.Debug("Input is LNURL-Pay request")
		lnurlPay := toLightningLNURLPay(inputStr, inputType.Field0)
		return &paymentInput{
			Type:     paymentInputTypeLNURLPay,
			LNURLPay: &lnurlPay,
		}, nil

	case breez_sdk_spark.InputTypeLightningAddress:
		lightning.log.Debug("Input is Lightning address")
		lnurlPay := toLightningLNURLPay(inputStr, inputType.Field0.PayRequest)
		lnurlPay.Address = &inputType.Field0.Address
		return &paymentInput{
			Type:     paymentInputTypeLNURLPay,
			LNURLPay: &lnurlPay,
		}, nil

	case breez_sdk_spark.InputTypeLnurlWithdraw:
		lightning.log.Debug("Input is unsupported LNURL-Withdraw request")

	case breez_sdk_spark.InputTypeSparkAddress:
		lightning.log.Debug("Input is unsupported Spark address")

	case breez_sdk_spark.InputTypeSparkInvoice:
		lightning.log.Debug("Input is unsupported Spark invoice")

	default:
		lightning.log.Errorf("Input type not supported %T", input)
	}
	return nil, errp.New("Invoice format not supported")
}

func (lightning *Lightning) validateBIP21RequiredParameters(details breez_sdk_spark.Bip21Details) error {
	// Use the resolved URI because the original input can be a BIP353 address rather than a BIP21 URI.
	_, query, _ := strings.Cut(details.Uri, "?")

	for _, parameter := range strings.Split(query, "&") {
		rawKey, value, _ := strings.Cut(parameter, "=")
		key := strings.ToLower(rawKey)
		if !strings.HasPrefix(key, "req-") || key == "req-amount" || key == "req-message" {
			continue
		}

		if key == "req-lightning" {
			// Bip21Details contains the parsed payment methods, but does not retain which method came
			// from this required parameter. Parse its value again to distinguish supported BOLT11
			// invoices from unsupported methods such as BOLT12.
			paymentMethod, err := lightning.sdkService.Parse(value)
			_, supported := paymentMethod.(breez_sdk_spark.InputTypeBolt11Invoice)
			if err == nil && supported {
				continue
			}
		}

		return errp.WithMessage(
			errLightningInvalidPaymentInput,
			fmt.Sprintf("required BIP21 parameter %q not supported", rawKey),
		)
	}
	return nil
}

func (lightning *Lightning) bolt11PaymentInput(
	inputType breez_sdk_spark.InputTypeBolt11Invoice,
	fallbackDescription *string,
) *paymentInput {
	var amountSat *uint64
	if inputType.Field0.AmountMsat != nil {
		value := msatToSat(*inputType.Field0.AmountMsat, roundToCeil)
		amountSat = &value
	}
	description := inputType.Field0.Description
	if description == nil {
		description = fallbackDescription
	}
	lightning.log.Debug("Input is BOLT11 invoice")
	return &paymentInput{
		Type: paymentInputTypeBolt11,
		Bolt11: &lightningBolt11Invoice{
			Invoice:     inputType.Field0.Invoice.Bolt11,
			Description: description,
			AmountSat:   amountSat,
		},
	}
}

func toLightningPaymentType(paymentType breez_sdk_spark.PaymentType) accounts.TxType {
	switch paymentType {
	case breez_sdk_spark.PaymentTypeReceive:
		return accounts.TxTypeReceive
	default:
		return accounts.TxTypeSend
	}
}

func toLightningPaymentStatus(status breez_sdk_spark.PaymentStatus) accounts.TxStatus {
	switch status {
	case breez_sdk_spark.PaymentStatusCompleted:
		return accounts.TxStatusComplete
	case breez_sdk_spark.PaymentStatusFailed:
		return accounts.TxStatusFailed
	default:
		return accounts.TxStatusPending
	}
}

func (lightning *Lightning) toLightningPayment(payment breez_sdk_spark.Payment) lightningPayment {
	paymentType := toLightningPaymentType(payment.PaymentType)
	amount := coin.NewAmountFromInt64(int64(parseLightningUint(payment.Amount)))
	fee := coin.NewAmountFromInt64(int64(parseLightningUint(payment.Fees)))
	deductedAmount := coin.NewAmountFromInt64(0)
	if paymentType == accounts.TxTypeSend {
		deductedAmount = coin.SumAmounts(amount, fee)
	}

	var timestamp *time.Time
	var formattedTime *string
	if payment.Timestamp > 0 {
		t := time.Unix(int64(payment.Timestamp), 0).UTC()
		timestamp = &t
		formatted := t.Format(time.RFC3339)
		formattedTime = &formatted
	}

	result := lightningPayment{
		ID:                   payment.Id,
		Type:                 paymentType,
		Status:               toLightningPaymentStatus(payment.Status),
		Time:                 formattedTime,
		Amount:               amount.FormatWithConversions(lightning.btcCoin, false, lightning.ratesUpdater),
		AmountAtTime:         amount.FormatWithConversionsAtTime(lightning.btcCoin, timestamp, lightning.ratesUpdater),
		DeductedAmountAtTime: deductedAmount.FormatWithConversionsAtTime(lightning.btcCoin, timestamp, lightning.ratesUpdater),
		Fee:                  fee.FormatWithConversions(lightning.btcCoin, true, lightning.ratesUpdater),
	}
	// Claimed Bitcoin deposits appear in ListPayments, sometimes without payment details. Mark them
	// as complete top-ups based on the payment method so the frontend can identify them reliably.
	if payment.Method == breez_sdk_spark.PaymentMethodDeposit && result.Status == accounts.TxStatusComplete {
		result.BitcoinDeposit = &bitcoinDeposit{
			State: bitcoinDepositStateComplete,
		}
	}

	if payment.Details == nil {
		return result
	}

	switch details := (*payment.Details).(type) {
	case breez_sdk_spark.PaymentDetailsLightning:
		if details.Description != nil {
			result.Description = *details.Description
		}
		result.Invoice = details.Invoice
	case breez_sdk_spark.PaymentDetailsSpark:
		if details.InvoiceDetails != nil {
			if details.InvoiceDetails.Description != nil {
				result.Description = *details.InvoiceDetails.Description
			}
			result.Invoice = details.InvoiceDetails.Invoice
		}
	case breez_sdk_spark.PaymentDetailsDeposit:
		if result.BitcoinDeposit != nil {
			result.BitcoinDeposit.TxID = details.TxId
		}
	case breez_sdk_spark.PaymentDetailsWithdraw:
		result.TxID = details.TxId
	}

	return result
}

func toLightningTransaction(payment breez_sdk_spark.Payment) *accounts.TransactionData {
	if toLightningPaymentStatus(payment.Status) != accounts.TxStatusComplete {
		return nil
	}

	var timestamp *time.Time
	if payment.Timestamp != 0 {
		t := time.Unix(int64(payment.Timestamp), 0).UTC()
		timestamp = &t
	}
	paymentType := toLightningPaymentType(payment.PaymentType)
	amount := coin.NewAmountFromInt64(int64(parseLightningUint(payment.Amount)))
	fee := coin.NewAmountFromInt64(int64(parseLightningUint(payment.Fees)))

	tx := &accounts.TransactionData{
		Fee:              &fee,
		Timestamp:        timestamp,
		Height:           1,
		Status:           accounts.TxStatusComplete,
		Type:             paymentType,
		Amount:           amount,
		CreatedTimestamp: timestamp,
	}
	if paymentType == accounts.TxTypeReceive {
		tx.Fee = nil
	}
	return tx
}

func bitcoinDepositClaimError(claimError *breez_sdk_spark.DepositClaimError) string {
	if claimError == nil {
		return ""
	}
	switch err := (*claimError).(type) {
	case breez_sdk_spark.DepositClaimErrorMaxDepositClaimFeeExceeded:
		return fmt.Sprintf(
			"Claim fee too high: required %d sats at %d sat/vbyte",
			err.RequiredFeeSats,
			err.RequiredFeeRateSatPerVbyte,
		)
	case breez_sdk_spark.DepositClaimErrorMissingUtxo:
		return "Deposit output could not be found"
	case breez_sdk_spark.DepositClaimErrorGeneric:
		return err.Message
	default:
		return "Deposit could not be claimed"
	}
}

func bitcoinDepositStateFromSDK(deposit breez_sdk_spark.DepositInfo) bitcoinDepositState {
	if deposit.ClaimError != nil {
		return bitcoinDepositStateUnclaimed
	}
	if deposit.IsMature {
		return bitcoinDepositStateClaiming
	}
	return bitcoinDepositStateConfirming
}

func bitcoinDepositPaymentID(deposit breez_sdk_spark.DepositInfo) string {
	return fmt.Sprintf("bitcoin-deposit:%s:%d", deposit.Txid, deposit.Vout)
}

func (lightning *Lightning) toBitcoinDepositPayment(deposit breez_sdk_spark.DepositInfo) lightningPayment {
	amount := coin.NewAmountFromInt64(int64(deposit.AmountSats))
	depositInfo := &bitcoinDeposit{
		TxID:  deposit.Txid,
		State: bitcoinDepositStateFromSDK(deposit),
	}
	if feeSat, err := requiredClaimFeeSat(deposit.ClaimError); err == nil {
		fee := lightning.formatSats(feeSat, true)
		depositInfo.ClaimFee = &fee
		depositInfo.ClaimFeeSat = &feeSat
	}

	return lightningPayment{
		ID:                   bitcoinDepositPaymentID(deposit),
		Type:                 accounts.TxTypeReceive,
		Status:               accounts.TxStatusPending,
		Amount:               amount.FormatWithConversions(lightning.btcCoin, false, lightning.ratesUpdater),
		AmountAtTime:         amount.FormatWithConversionsAtTime(lightning.btcCoin, nil, lightning.ratesUpdater),
		DeductedAmountAtTime: coin.NewAmountFromInt64(0).FormatWithConversionsAtTime(lightning.btcCoin, nil, lightning.ratesUpdater),
		Fee:                  coin.NewAmountFromInt64(0).FormatWithConversions(lightning.btcCoin, true, lightning.ratesUpdater),
		BitcoinDeposit:       depositInfo,
	}
}

func (lightning *Lightning) unclaimedDepositsAmount(deposits []breez_sdk_spark.DepositInfo) coin.Amount {
	amount := coin.NewAmountFromInt64(0)
	for _, deposit := range deposits {
		if isRefundedDeposit(deposit) {
			continue
		}
		amount = coin.SumAmounts(amount, coin.NewAmountFromInt64(int64(deposit.AmountSats)))
	}
	return amount
}

func parseLightningUint(value interface{ String() string }) uint64 {
	parsed, err := strconv.ParseUint(value.String(), 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func prepareBolt11PaymentRequest(paymentInvoice string, amount *uint64) breez_sdk_spark.PrepareSendPaymentRequest {
	request := breez_sdk_spark.PrepareSendPaymentRequest{
		PaymentRequest: breez_sdk_spark.PaymentRequestInput{Input: paymentInvoice},
	}
	if amount != nil {
		optionalAmount := new(big.Int).SetUint64(*amount)
		request.Amount = &optionalAmount
	}
	return request
}

func prepareLNURLPayRequest(
	payRequest breez_sdk_spark.LnurlPayRequestDetails,
	amount uint64,
) breez_sdk_spark.PrepareLnurlPayRequest {
	return breez_sdk_spark.PrepareLnurlPayRequest{
		Amount:     new(big.Int).SetUint64(amount),
		PayRequest: payRequest,
	}
}

func preparedBolt11PaymentFee(prepareResponse breez_sdk_spark.PrepareSendPaymentResponse) (*paymentFee, error) {
	if paymentMethod, ok := prepareResponse.PaymentMethod.(breez_sdk_spark.SendPaymentMethodBolt11Invoice); ok {
		amountSat := parseLightningUint(prepareResponse.Amount)
		feeSat := paymentMethod.LightningFeeSats
		return &paymentFee{
			AmountSat:     amountSat,
			FeeSat:        feeSat,
			TotalDebitSat: amountSat + feeSat,
		}, nil
	}
	return nil, errp.Newf("Payment method %v not supported", prepareResponse.PaymentMethod)
}

func preparedLNURLPayFee(prepareResponse breez_sdk_spark.PrepareLnurlPayResponse) *paymentFee {
	return &paymentFee{
		AmountSat:     prepareResponse.AmountSats,
		FeeSat:        prepareResponse.FeeSats,
		TotalDebitSat: prepareResponse.AmountSats + prepareResponse.FeeSats,
	}
}

func prepareBitcoinPaymentRequest(
	destinationAddress string,
	amountSat uint64,
	feePolicy breez_sdk_spark.FeePolicy,
) breez_sdk_spark.PrepareSendPaymentRequest {
	amount := new(big.Int).SetUint64(amountSat)
	return breez_sdk_spark.PrepareSendPaymentRequest{
		PaymentRequest: breez_sdk_spark.PaymentRequestInput{Input: destinationAddress},
		Amount:         &amount,
		FeePolicy:      &feePolicy,
	}
}

func preparedBitcoinPaymentFee(
	prepareResponse breez_sdk_spark.PrepareSendPaymentResponse,
) (*paymentFee, error) {
	paymentMethod, ok := prepareResponse.PaymentMethod.(breez_sdk_spark.SendPaymentMethodBitcoinAddress)
	if !ok {
		return nil, errp.Newf("Payment method %v not supported", prepareResponse.PaymentMethod)
	}
	feeQuote := paymentMethod.FeeQuote.SpeedFast
	feeSat := feeQuote.UserFeeSat + feeQuote.L1BroadcastFeeSat
	amountSat := parseLightningUint(prepareResponse.Amount)
	totalDebitSat := amountSat + feeSat
	if prepareResponse.FeePolicy == breez_sdk_spark.FeePolicyFeesIncluded {
		totalDebitSat = amountSat
	}
	return &paymentFee{
		AmountSat:     amountSat,
		FeeSat:        feeSat,
		TotalDebitSat: totalDebitSat,
	}, nil
}

func checkApprovedPaymentFee(fee uint64, approvedFee uint64) error {
	if fee > approvedFee {
		return errPaymentApprovalRequired
	}
	return nil
}

func checkAvailableBalance(amountSat uint64, availableBalance coin.Amount) error {
	if new(big.Int).SetUint64(amountSat).Cmp(availableBalance.BigInt()) > 0 {
		return errLightningInsufficientFunds
	}
	return nil
}

func checkPaymentBalance(fee *paymentFee, availableBalance coin.Amount) error {
	return checkAvailableBalance(fee.TotalDebitSat, availableBalance)
}

func lightningPaymentError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, breez_sdk_spark.ErrSdkErrorInsufficientFunds) {
		return errp.WithMessage(errLightningInsufficientFunds, err.Error())
	}
	errString := strings.ToLower(err.Error())
	if strings.Contains(errString, "preimage request already exists") ||
		(strings.Contains(errString, "duplicate_operation") && strings.Contains(errString, "paymenthash")) {
		return errp.WithMessage(errLightningInvoiceAlreadyUsed, err.Error())
	}
	return err
}

func (lightning *Lightning) parseLNURLPayRequest(inputStr string) (*breez_sdk_spark.LnurlPayRequestDetails, error) {
	input, err := lightning.sdkService.Parse(inputStr)
	if err != nil {
		lightning.log.WithError(err).Error("Parse LNURL-Pay request failed")
		return nil, errLightningInvalidPaymentInput
	}

	switch inputType := input.(type) {
	case breez_sdk_spark.InputTypeLnurlPay:
		return &inputType.Field0, nil
	case breez_sdk_spark.InputTypeLightningAddress:
		return &inputType.Field0.PayRequest, nil
	default:
		return nil, errLightningInvalidPaymentInput
	}
}

// PreparePayment computes the fee quote for the provided payment input.
func (lightning *Lightning) PreparePayment(request preparePaymentRequest) (*paymentFee, error) {
	switch request.Type {
	case paymentInputTypeBitcoinAddress:
		if request.AmountSat == nil {
			return nil, errLightningInvalidAmount
		}
		_, fee, err := lightning.prepareBitcoinPayment(
			request.PaymentInput,
			*request.AmountSat,
			breez_sdk_spark.FeePolicyFeesExcluded,
		)
		if err != nil {
			return fee, err
		}
		idempotencyKey := request.IdempotencyKey
		if idempotencyKey == "" {
			generatedKey, err := uuid.NewRandom()
			if err != nil {
				return nil, errp.Wrap(err, "generate idempotency key")
			}
			idempotencyKey = generatedKey.String()
		}
		fee.IdempotencyKey = idempotencyKey
		return fee, nil
	case paymentInputTypeBolt11:
		return lightning.prepareBolt11Payment(request.PaymentInput, request.AmountSat)
	case paymentInputTypeLNURLPay:
		return lightning.prepareLNURLPay(request.PaymentInput, request.AmountSat)
	default:
		return nil, errp.New("Payment type not supported")
	}
}

func (lightning *Lightning) prepareBolt11Payment(paymentInvoice string, amountSat *uint64) (*paymentFee, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	prepareResponse, err := lightning.sdkService.PrepareSendPayment(prepareBolt11PaymentRequest(paymentInvoice, amountSat))
	if err != nil {
		lightning.log.WithError(err).Error("Prepare lightning payment failed")
		return nil, lightningPaymentError(err)
	}

	fee, err := preparedBolt11PaymentFee(prepareResponse)
	if err != nil {
		return nil, err
	}
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return nil, err
	}
	if err := checkPaymentBalance(fee, availableBalance); err != nil {
		return fee, err
	}
	lightning.log.Debug("Prepared Lightning payment")
	return fee, nil
}

func (lightning *Lightning) prepareLNURLPay(inputStr string, amountSat *uint64) (*paymentFee, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	if amountSat == nil || *amountSat == 0 {
		return nil, errLightningInvalidAmount
	}

	payRequest, err := lightning.parseLNURLPayRequest(inputStr)
	if err != nil {
		return nil, err
	}
	if err := validateLNURLPayAmount(*payRequest, *amountSat); err != nil {
		return nil, err
	}

	prepareResponse, err := lightning.sdkService.PrepareLnurlPay(prepareLNURLPayRequest(*payRequest, *amountSat))
	if err != nil {
		lightning.log.WithError(err).Error("Prepare LNURL-Pay failed")
		return nil, lightningPaymentError(err)
	}

	fee := preparedLNURLPayFee(prepareResponse)
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return nil, err
	}
	if err := checkPaymentBalance(fee, availableBalance); err != nil {
		return fee, err
	}
	lightning.log.Debug("Prepared LNURL-Pay payment")
	return fee, nil
}

// SendPayment executes the provided payment input.
func (lightning *Lightning) SendPayment(request sendPaymentRequest) error {
	switch request.Type {
	case paymentInputTypeBitcoinAddress:
		return lightning.sendBitcoinPayment(request)
	case paymentInputTypeBolt11:
		return lightning.sendBolt11Payment(request)
	case paymentInputTypeLNURLPay:
		return lightning.sendLNURLPay(request)
	default:
		return errp.New("Payment type not supported")
	}
}

func (lightning *Lightning) sendBitcoinPayment(request sendPaymentRequest) error {
	if request.AmountSat == nil || *request.AmountSat == 0 {
		return errLightningInvalidAmount
	}
	if request.IdempotencyKey == "" {
		return errp.WithMessage(errLightningInvalidPaymentInput, "idempotency key missing")
	}

	prepareResponse, fee, err := lightning.prepareBitcoinPayment(
		request.PaymentInput,
		*request.AmountSat,
		breez_sdk_spark.FeePolicyFeesExcluded,
	)
	if err != nil {
		return err
	}
	if err := lightning.validateBitcoinPaymentAmountAgainstDustLimit(
		request.PaymentInput,
		bitcoinPaymentOutputAmountSat(fee, prepareResponse.FeePolicy),
	); err != nil {
		return err
	}
	if err := checkApprovedPaymentFee(fee.FeeSat, request.ApprovedFeeSat); err != nil {
		return err
	}

	var options breez_sdk_spark.SendPaymentOptions = breez_sdk_spark.SendPaymentOptionsBitcoinAddress{
		// RBF would require the Spark Entity to co-sign, which the SDK does not support.
		// Use the fastest fee to minimize the risk of the transaction getting stuck in the mempool.
		ConfirmationSpeed: breez_sdk_spark.OnchainConfirmationSpeedFast,
	}
	_, err = lightning.sdkService.SendPayment(breez_sdk_spark.SendPaymentRequest{
		PrepareResponse: prepareResponse,
		Options:         &options,
		IdempotencyKey:  &request.IdempotencyKey,
	})
	if err != nil {
		lightning.log.WithError(err).Error("Send Bitcoin payment failed")
		return lightningPaymentError(err)
	}
	return nil
}

func (lightning *Lightning) sendBolt11Payment(request sendPaymentRequest) error {
	if err := lightning.CheckActive(); err != nil {
		return err
	}
	lightning.log.Info("Sending Lightning payment")

	prepareResponse, err := lightning.sdkService.PrepareSendPayment(prepareBolt11PaymentRequest(request.PaymentInput, request.AmountSat))
	if err != nil {
		lightning.log.WithError(err).Error("Prepare send lightning payment failed")
		return lightningPaymentError(err)
	}

	fee, err := preparedBolt11PaymentFee(prepareResponse)
	if err != nil {
		return err
	}
	if err := checkApprovedPaymentFee(fee.FeeSat, request.ApprovedFeeSat); err != nil {
		return err
	}
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return err
	}
	if err := checkPaymentBalance(fee, availableBalance); err != nil {
		return err
	}

	var options breez_sdk_spark.SendPaymentOptions = breez_sdk_spark.SendPaymentOptionsBolt11Invoice{
		PreferSpark: false,
	}

	payRequest := breez_sdk_spark.SendPaymentRequest{
		PrepareResponse: prepareResponse,
		Options:         &options,
	}
	_, err = lightning.sdkService.SendPayment(payRequest)

	if err != nil {
		lightning.log.WithError(err).Error("Send lightning payment failed")
		return lightningPaymentError(err)
	}
	return nil
}

func (lightning *Lightning) sendLNURLPay(request sendPaymentRequest) error {
	if err := lightning.CheckActive(); err != nil {
		return err
	}
	if request.AmountSat == nil || *request.AmountSat == 0 {
		return errLightningInvalidAmount
	}

	lightning.log.Info("Sending LNURL-Pay payment")

	payRequest, err := lightning.parseLNURLPayRequest(request.PaymentInput)
	if err != nil {
		return err
	}
	if err := validateLNURLPayAmount(*payRequest, *request.AmountSat); err != nil {
		return err
	}

	prepareResponse, err := lightning.sdkService.PrepareLnurlPay(prepareLNURLPayRequest(*payRequest, *request.AmountSat))
	if err != nil {
		lightning.log.WithError(err).Error("Prepare LNURL-Pay failed")
		return lightningPaymentError(err)
	}

	fee := preparedLNURLPayFee(prepareResponse)
	if err := checkApprovedPaymentFee(fee.FeeSat, request.ApprovedFeeSat); err != nil {
		return err
	}
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return err
	}
	if err := checkPaymentBalance(fee, availableBalance); err != nil {
		return err
	}

	_, err = lightning.sdkService.LnurlPay(breez_sdk_spark.LnurlPayRequest{
		PrepareResponse: prepareResponse,
	})
	if err != nil {
		lightning.log.WithError(err).Error("Send LNURL-Pay failed")
		return lightningPaymentError(err)
	}
	return nil
}

type bitcoinAddressToPkScripter interface {
	AddressToPkScript(string) ([]byte, error)
}

func (lightning *Lightning) validateBitcoinPaymentAmountAgainstDustLimit(
	destinationAddress string,
	amountSat uint64,
) error {
	btcCoin, ok := lightning.btcCoin.(bitcoinAddressToPkScripter)
	if !ok {
		return errp.New("Bitcoin coin does not support address-to-script conversion")
	}
	pkScript, err := btcCoin.AddressToPkScript(destinationAddress)
	if err != nil {
		return errp.WithMessage(errLightningInvalidPaymentInput, err.Error())
	}

	minAmountSat := uint64(mempool.GetDustThreshold(wire.NewTxOut(0, pkScript)))
	if amountSat < minAmountSat {
		return &lightningAmountBelowMinimumError{minAmountSat: minAmountSat}
	}
	return nil
}

func bitcoinPaymentOutputAmountSat(fee *paymentFee, feePolicy breez_sdk_spark.FeePolicy) uint64 {
	amountSat := fee.AmountSat
	if feePolicy == breez_sdk_spark.FeePolicyFeesIncluded {
		if fee.FeeSat >= amountSat {
			return 0
		}
		return amountSat - fee.FeeSat
	}
	return amountSat
}

func (lightning *Lightning) prepareBitcoinPayment(
	destinationAddress string,
	amountSat uint64,
	feePolicy breez_sdk_spark.FeePolicy,
) (breez_sdk_spark.PrepareSendPaymentResponse, *paymentFee, error) {
	if err := lightning.CheckActive(); err != nil {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, err
	}
	if amountSat == 0 {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, errLightningInvalidAmount
	}
	// The SDK rejects dust outputs during preparation with a generic error. Validate first so
	// callers receive the actionable minimum amount instead. With included fees, the exact output
	// amount depends on the preparation result, so the SDK can still return a generic error first.
	if err := lightning.validateBitcoinPaymentAmountAgainstDustLimit(destinationAddress, amountSat); err != nil {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, err
	}
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, err
	}
	if err := checkAvailableBalance(amountSat, availableBalance); err != nil {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, err
	}

	prepareResponse, err := lightning.sdkService.PrepareSendPayment(
		prepareBitcoinPaymentRequest(destinationAddress, amountSat, feePolicy),
	)
	if err != nil {
		lightning.log.WithError(err).Error("Prepare Bitcoin payment failed")
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, lightningPaymentError(err)
	}

	fee, err := preparedBitcoinPaymentFee(prepareResponse)
	if err != nil {
		return breez_sdk_spark.PrepareSendPaymentResponse{}, nil, err
	}
	if err := checkPaymentBalance(fee, availableBalance); err != nil {
		return prepareResponse, fee, err
	}
	return prepareResponse, fee, nil
}

func (lightning *Lightning) onChainDestinationAddress(
	destinationAccountCode accountsTypes.Code,
) (string, error) {
	account, err := lightning.getAccount(destinationAccountCode)
	if err != nil {
		return "", err
	}
	if !coin.IsBitcoinOnly(account.Config().Config.CoinCode) {
		return "", errp.Newf("account %q is not a Bitcoin account", destinationAccountCode)
	}
	addressLists, err := account.GetUnusedReceiveAddresses()
	if err != nil {
		return "", err
	}

	var addressList *accounts.AddressList
	if receiveScriptType := account.Config().Config.ReceiveScriptType; receiveScriptType != nil {
		addressList = accounts.FindAddressListByScriptType(addressLists, *receiveScriptType)
	}
	if addressList == nil {
		addressList = accounts.FindAddressListByScriptType(addressLists, signing.ScriptTypeP2WPKH)
	}
	if addressList == nil && len(addressLists) > 0 {
		addressList = &addressLists[0]
	}
	if addressList == nil || len(addressList.Addresses) == 0 {
		return "", errp.New("no receive address available")
	}
	return addressList.Addresses[0].EncodeForHumans(), nil
}

func (lightning *Lightning) formatSats(amountSat uint64, isFee bool) coin.FormattedAmountWithConversions {
	amount := coin.NewAmount(new(big.Int).SetUint64(amountSat))
	return amount.FormatWithConversions(lightning.btcCoin, isFee, lightning.ratesUpdater)
}

func isRefundedDeposit(deposit breez_sdk_spark.DepositInfo) bool {
	return deposit.RefundTxId != nil
}

// PrepareCloseWithdraw prepares an on-chain payment that spends the full Lightning balance.
func (lightning *Lightning) PrepareCloseWithdraw(
	destinationAccountCode accountsTypes.Code,
) (*closeWithdrawQuote, error) {
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return nil, err
	}
	if availableBalance.BigInt().Sign() <= 0 {
		return nil, errLightningInvalidAmount
	}
	destinationAddress, err := lightning.onChainDestinationAddress(destinationAccountCode)
	if err != nil {
		return nil, err
	}
	amountSat := availableBalance.BigInt().Uint64()
	_, fee, err := lightning.prepareBitcoinPayment(
		destinationAddress,
		amountSat,
		breez_sdk_spark.FeePolicyFeesIncluded,
	)
	if err != nil {
		return nil, err
	}

	feeAmount := coin.NewAmountFromInt64(int64(fee.FeeSat))
	return &closeWithdrawQuote{
		Balance:    availableBalance.FormatWithConversions(lightning.btcCoin, false, lightning.ratesUpdater),
		BalanceSat: amountSat,
		Fee:        feeAmount.FormatWithConversions(lightning.btcCoin, true, lightning.ratesUpdater),
		FeeSat:     fee.FeeSat,
	}, nil
}

// CloseWithdraw spends the full Lightning balance on-chain and then deactivates the wallet.
func (lightning *Lightning) CloseWithdraw(
	destinationAccountCode accountsTypes.Code,
	approvedBalanceSat uint64,
	approvedFeeSat uint64,
) (*closeWithdrawResult, error) {
	availableBalance, err := lightning.availableBalance()
	if err != nil {
		return nil, err
	}
	amountSat := availableBalance.BigInt().Uint64()
	if amountSat != approvedBalanceSat {
		return nil, errPaymentApprovalRequired
	}
	if availableBalance.BigInt().Sign() <= 0 {
		return nil, errLightningInvalidAmount
	}
	destinationAddress, err := lightning.onChainDestinationAddress(destinationAccountCode)
	if err != nil {
		return nil, err
	}
	prepareResponse, fee, err := lightning.prepareBitcoinPayment(
		destinationAddress,
		amountSat,
		breez_sdk_spark.FeePolicyFeesIncluded,
	)
	if err != nil {
		return nil, err
	}
	if err := lightning.validateBitcoinPaymentAmountAgainstDustLimit(
		destinationAddress,
		bitcoinPaymentOutputAmountSat(fee, prepareResponse.FeePolicy),
	); err != nil {
		return nil, err
	}
	if err := checkApprovedPaymentFee(fee.FeeSat, approvedFeeSat); err != nil {
		return nil, err
	}

	var options breez_sdk_spark.SendPaymentOptions = breez_sdk_spark.SendPaymentOptionsBitcoinAddress{
		ConfirmationSpeed: breez_sdk_spark.OnchainConfirmationSpeedFast,
	}
	response, err := lightning.sdkService.SendPayment(breez_sdk_spark.SendPaymentRequest{
		PrepareResponse: prepareResponse,
		Options:         &options,
	})
	if err != nil {
		lightning.log.WithError(err).Error("Send Bitcoin payment failed")
		return nil, lightningPaymentError(err)
	}

	result := &closeWithdrawResult{}
	if response.Payment.Details != nil {
		if details, ok := (*response.Payment.Details).(breez_sdk_spark.PaymentDetailsWithdraw); ok {
			result.TxID = details.TxId
		}
	}
	if err := lightning.Deactivate(); err != nil {
		lightning.log.WithError(err).Error("Bitcoin withdrawal succeeded but Lightning wallet deactivation failed")
		return result, nil
	}
	result.WalletClosed = true
	return result, nil
}

// BoardingAddress returns a bitcoin address that can be used to fund lightning.
func (lightning *Lightning) BoardingAddress() (string, error) {
	if err := lightning.CheckActive(); err != nil {
		return "", err
	}
	request := breez_sdk_spark.ReceivePaymentRequest{
		PaymentMethod: breez_sdk_spark.ReceivePaymentMethodBitcoinAddress{},
	}

	response, err := lightning.sdkService.ReceivePayment(request)
	if err != nil {
		return "", err
	}

	paymentRequest := response.PaymentRequest
	lightning.log.Debug("Created Bitcoin funding address")

	return paymentRequest, nil
}

// ReceivePayment creates a BOLT11 invoice and returns an app-facing response.
func (lightning *Lightning) ReceivePayment(amountSat uint64, description string) (*receivePaymentResponse, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	if len(description) < 1 {
		description = "Send to BitBoxApp"
	}

	request := breez_sdk_spark.ReceivePaymentRequest{
		PaymentMethod: breez_sdk_spark.ReceivePaymentMethodBolt11Invoice{
			Description: description,
			AmountSats:  &amountSat,
		},
	}

	response, err := lightning.sdkService.ReceivePayment(request)
	if err != nil {
		return nil, err
	}

	lightning.log.Debug("Created Lightning invoice")
	return &receivePaymentResponse{Invoice: response.PaymentRequest}, nil
}

func (lightning *Lightning) listPayments() ([]breez_sdk_spark.Payment, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	assetFilter := breez_sdk_spark.AssetFilter(breez_sdk_spark.AssetFilterBitcoin{})
	response, err := lightning.sdkService.ListPayments(breez_sdk_spark.ListPaymentsRequest{
		AssetFilter: &assetFilter,
	})
	if err != nil {
		return nil, errp.Wrap(err, "breez: list payments")
	}
	return response.Payments, nil
}

// ListPayments fetches lightning payments and converts them to the app-facing contract.
func (lightning *Lightning) ListPayments() ([]lightningPayment, error) {
	rawPayments, err := lightning.listPayments()
	if err != nil {
		return nil, err
	}
	deposits, err := lightning.sdkService.ListUnclaimedDeposits(breez_sdk_spark.ListUnclaimedDepositsRequest{})
	if err != nil {
		return nil, errp.Wrap(err, "breez: list unclaimed deposits")
	}

	lightning.log.Debug("Listed Lightning payments")

	payments := make([]lightningPayment, 0, len(deposits.Deposits)+len(rawPayments))
	for _, deposit := range deposits.Deposits {
		if isRefundedDeposit(deposit) {
			continue
		}
		payments = append(payments, lightning.toBitcoinDepositPayment(deposit))
	}
	if len(payments) > 0 {
		feeRate, err := lightning.recommendedRefundFeeRate()
		if err != nil {
			lightning.log.WithError(err).Warn("Failed to get Bitcoin deposit refund fee rate")
		} else {
			for i := range payments {
				payments[i].BitcoinDeposit.RefundFeeRateSatPerVbyte = &feeRate
			}
		}
	}
	for _, payment := range rawPayments {
		payments = append(payments, lightning.toLightningPayment(payment))
	}
	return payments, nil
}

// Transactions fetches lightning payments and converts them to generic transaction data for charting.
func (lightning *Lightning) Transactions() (accounts.OrderedTransactions, error) {
	rawPayments, err := lightning.listPayments()
	if err != nil {
		return nil, err
	}

	txs := make([]*accounts.TransactionData, 0, len(rawPayments))
	for _, payment := range rawPayments {
		tx := toLightningTransaction(payment)
		if tx != nil {
			txs = append(txs, tx)
		}
	}
	return accounts.NewOrderedTransactions(txs), nil
}
