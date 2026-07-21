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
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

const (
	errPaymentApprovalRequired      errp.ErrorCode = "paymentApprovalRequired"
	errLightningInvalidAmount       errp.ErrorCode = "lightningInvalidAmount"
	errLightningInvalidPaymentInput errp.ErrorCode = "lightningInvalidPaymentInput"
	errLightningInsufficientFunds   errp.ErrorCode = "lightningInsufficientFunds"
	errLightningInvoiceAlreadyUsed  errp.ErrorCode = "lightningInvoiceAlreadyUsed"
)

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

type paymentInput struct {
	Type     string                  `json:"type"`
	Bolt11   *lightningBolt11Invoice `json:"invoice,omitempty"`
	LNURLPay *lightningLNURLPay      `json:"lnurlPay,omitempty"`
}

type bitcoinDepositState string

const (
	bitcoinDepositStateConfirming bitcoinDepositState = "confirming"
	bitcoinDepositStateClaiming   bitcoinDepositState = "claiming"
	bitcoinDepositStateComplete   bitcoinDepositState = "complete"
	bitcoinDepositStateUnclaimed  bitcoinDepositState = "unclaimed"
)

type bitcoinDeposit struct {
	TxID       string              `json:"txid"`
	Vout       uint32              `json:"vout"`
	State      bitcoinDepositState `json:"state"`
	ClaimError string              `json:"claimError,omitempty"`
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
	BitcoinDeposit       *bitcoinDeposit                     `json:"bitcoinDeposit,omitempty"`
}

type receivePaymentResponse struct {
	Invoice string `json:"invoice"`
}

type preparePaymentRequest struct {
	Type         string  `json:"type"`
	PaymentInput string  `json:"paymentInput"`
	AmountSat    *uint64 `json:"amountSat,omitempty"`
}

type sendPaymentRequest struct {
	Type           string  `json:"type"`
	PaymentInput   string  `json:"paymentInput"`
	AmountSat      *uint64 `json:"amountSat"`
	ApprovedFeeSat uint64  `json:"approvedFeeSat"`
}

type paymentFee struct {
	AmountSat     uint64 `json:"amountSat"`
	FeeSat        uint64 `json:"feeSat"`
	TotalDebitSat uint64 `json:"totalDebitSat"`
}

const (
	paymentInputTypeBolt11   = "bolt11"
	paymentInputTypeLNURLPay = "lnurlPay"
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
		lightning.log.Printf("Input is Bitcoin address %s", inputType.Field0.Address)

	case breez_sdk_spark.InputTypeBolt11Invoice:
		amount := "unknown"
		var amountSat *uint64
		if inputType.Field0.AmountMsat != nil {
			amount = strconv.FormatUint(*inputType.Field0.AmountMsat, 10)
			value := msatToSat(*inputType.Field0.AmountMsat, roundToCeil)
			amountSat = &value
		}
		lightning.log.Printf("Input is BOLT11 invoice for %s msats", amount)
		return &paymentInput{
			Type: paymentInputTypeBolt11,
			Bolt11: &lightningBolt11Invoice{
				Invoice:     inputType.Field0.Invoice.Bolt11,
				Description: inputType.Field0.Description,
				AmountSat:   amountSat,
			},
		}, nil

	case breez_sdk_spark.InputTypeLnurlPay:
		lightning.log.Printf("Input is LNURL-Pay/Lightning address accepting min/max %d/%d msats",
			inputType.Field0.MinSendable, inputType.Field0.MaxSendable)
		lnurlPay := toLightningLNURLPay(inputStr, inputType.Field0)
		return &paymentInput{
			Type:     paymentInputTypeLNURLPay,
			LNURLPay: &lnurlPay,
		}, nil

	case breez_sdk_spark.InputTypeLightningAddress:
		lightning.log.Printf("Input is Lightning address %s accepting min/max %d/%d msats",
			inputType.Field0.Address, inputType.Field0.PayRequest.MinSendable, inputType.Field0.PayRequest.MaxSendable)
		lnurlPay := toLightningLNURLPay(inputStr, inputType.Field0.PayRequest)
		lnurlPay.Address = &inputType.Field0.Address
		return &paymentInput{
			Type:     paymentInputTypeLNURLPay,
			LNURLPay: &lnurlPay,
		}, nil

	case breez_sdk_spark.InputTypeLnurlWithdraw:
		lightning.log.Printf("Input is LNURL-Withdraw for min/max %d/%d msats",
			inputType.Field0.MinWithdrawable, inputType.Field0.MaxWithdrawable)

	case breez_sdk_spark.InputTypeSparkAddress:
		lightning.log.Printf("Input is Spark address %s", inputType.Field0.Address)

	case breez_sdk_spark.InputTypeSparkInvoice:
		invoice := inputType.Field0
		lightning.log.Println("Input is Spark invoice:")
		if invoice.TokenIdentifier != nil {
			lightning.log.Printf("  Amount: %d base units of token with id %s", invoice.Amount, *invoice.TokenIdentifier)
		} else {
			lightning.log.Printf("  Amount: %d sats", invoice.Amount)
		}

		if invoice.Description != nil {
			lightning.log.Printf("  Description: %s", *invoice.Description)
		}

		if invoice.ExpiryTime != nil {
			lightning.log.Printf("  Expiry time: %d", *invoice.ExpiryTime)
		}

		if invoice.SenderPublicKey != nil {
			lightning.log.Printf("  Sender public key: %s", *invoice.SenderPublicKey)
		}

	default:
		lightning.log.Errorf("Input type not supported %T", input)
	}
	return nil, errp.New("Invoice format not supported")
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
		Amount:               lightning.FormatAmountWithConversions(amount, false),
		AmountAtTime:         lightning.formatAmountAtTime(amount, timestamp),
		DeductedAmountAtTime: lightning.formatAmountAtTime(deductedAmount, timestamp),
		Fee:                  lightning.FormatAmountWithConversions(fee, true),
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

func (lightning *Lightning) toBitcoinDepositPayment(deposit breez_sdk_spark.DepositInfo) lightningPayment {
	amount := coin.NewAmountFromInt64(int64(deposit.AmountSats))
	depositInfo := &bitcoinDeposit{
		TxID:       deposit.Txid,
		Vout:       deposit.Vout,
		State:      bitcoinDepositStateFromSDK(deposit),
		ClaimError: bitcoinDepositClaimError(deposit.ClaimError),
	}

	return lightningPayment{
		ID:                   fmt.Sprintf("bitcoin-deposit:%s:%d", deposit.Txid, deposit.Vout),
		Type:                 accounts.TxTypeReceive,
		Status:               accounts.TxStatusPending,
		Amount:               lightning.FormatAmountWithConversions(amount, false),
		AmountAtTime:         lightning.formatAmountAtTime(amount, nil),
		DeductedAmountAtTime: lightning.formatAmountAtTime(coin.NewAmountFromInt64(0), nil),
		Fee:                  lightning.FormatAmountWithConversions(coin.NewAmountFromInt64(0), true),
		BitcoinDeposit:       depositInfo,
	}
}

func (lightning *Lightning) unclaimedDepositsAmount(deposits []breez_sdk_spark.DepositInfo) coin.Amount {
	amount := coin.NewAmountFromInt64(0)
	for _, deposit := range deposits {
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
		PaymentRequest: paymentInvoice,
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

func checkApprovedPaymentFee(fee uint64, approvedFee uint64) error {
	if fee > approvedFee {
		return errPaymentApprovalRequired
	}
	return nil
}

func checkPaymentBalance(fee *paymentFee, availableBalance coin.Amount) error {
	if new(big.Int).SetUint64(fee.TotalDebitSat).Cmp(availableBalance.BigInt()) > 0 {
		return errLightningInsufficientFunds
	}
	return nil
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
	lightning.log.Printf("Lightning Fee: %v sats", fee.FeeSat)
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
	lightning.log.Printf("LNURL-Pay Fee: %v sats", fee.FeeSat)
	return fee, nil
}

// SendPayment executes the provided payment input.
func (lightning *Lightning) SendPayment(request sendPaymentRequest) error {
	switch request.Type {
	case paymentInputTypeBolt11:
		return lightning.sendBolt11Payment(request)
	case paymentInputTypeLNURLPay:
		return lightning.sendLNURLPay(request)
	default:
		return errp.New("Payment type not supported")
	}
}

func (lightning *Lightning) sendBolt11Payment(request sendPaymentRequest) error {
	if err := lightning.CheckActive(); err != nil {
		return err
	}
	lightning.log.Infof("Sending payment to %+v", request.PaymentInput)
	if request.AmountSat != nil {
		lightning.log.Infof("Optional amount: %+v sat", *request.AmountSat)
	}

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

	lightning.log.Infof("Sending LNURL-Pay payment to %+v", request.PaymentInput)
	lightning.log.Infof("Amount: %+v sat", *request.AmountSat)

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
	lightning.log.Printf("Payment Request: %v", paymentRequest)
	lightning.log.Printf("Fees: %v sats", response.Fee)

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

	paymentRequest := response.PaymentRequest
	lightning.log.Printf("Payment Request: %v", paymentRequest)
	lightning.log.Printf("Fees: %v sats", response.Fee)
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

	lightning.log.Infof("List payments: %+v", rawPayments)

	payments := make([]lightningPayment, 0, len(deposits.Deposits)+len(rawPayments))
	for _, deposit := range deposits.Deposits {
		payments = append(payments, lightning.toBitcoinDepositPayment(deposit))
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
