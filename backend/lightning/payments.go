// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"errors"
	"math/big"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

const (
	errPaymentApprovalRequired    errp.ErrorCode = "paymentApprovalRequired"
	errLightningInsufficientFunds errp.ErrorCode = "lightningInsufficientFunds"
)

type lightningInvoice struct {
	Bolt11      string  `json:"bolt11"`
	Description *string `json:"description,omitempty"`
	AmountSat   *uint64 `json:"amountSat,omitempty"`
}

type parsePaymentInputResponse struct {
	Type    string           `json:"type"`
	Invoice lightningInvoice `json:"invoice"`
}

type lightningPayment struct {
	ID              string            `json:"id"`
	Type            accounts.TxType   `json:"type"`
	Status          accounts.TxStatus `json:"status"`
	AmountSat       uint64            `json:"amountSat"`
	FeesSat         uint64            `json:"feesSat"`
	Timestamp       uint64            `json:"timestamp"`
	Description     string            `json:"description,omitempty"`
	PaymentHash     string            `json:"paymentHash,omitempty"`
	PaymentPreimage string            `json:"paymentPreimage,omitempty"`
	Invoice         string            `json:"invoice,omitempty"`
}

type receivePaymentResponse struct {
	Invoice string `json:"invoice"`
}

type preparePaymentRequest struct {
	Bolt11    string  `json:"bolt11"`
	AmountSat *uint64 `json:"amountSat"`
}

type sendPaymentRequest struct {
	Bolt11         string  `json:"bolt11"`
	AmountSat      *uint64 `json:"amountSat"`
	ApprovedFeeSat uint64  `json:"approvedFeeSat"`
}

type paymentFee struct {
	AmountSat     uint64 `json:"amountSat"`
	FeeSat        uint64 `json:"feeSat"`
	TotalDebitSat uint64 `json:"totalDebitSat"`
}

// ParsePaymentInput validates and classifies a lightning input string.
func (lightning *Lightning) ParsePaymentInput(inputStr string) (*parsePaymentInputResponse, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	input, err := lightning.sdkService.Parse(inputStr)
	if err != nil {
		return nil, err
	}

	switch inputType := input.(type) {
	case breez_sdk_spark.InputTypeBitcoinAddress:
		lightning.log.Printf("Input is Bitcoin address %s", inputType.Field0.Address)

	case breez_sdk_spark.InputTypeBolt11Invoice:
		amount := "unknown"
		var amountSat *uint64
		if inputType.Field0.AmountMsat != nil {
			amount = strconv.FormatUint(*inputType.Field0.AmountMsat, 10)
			value := *inputType.Field0.AmountMsat / 1000
			amountSat = &value
		}
		lightning.log.Printf("Input is BOLT11 invoice for %s msats", amount)
		return &parsePaymentInputResponse{
			Type: "bolt11",
			Invoice: lightningInvoice{
				Bolt11:      inputType.Field0.Invoice.Bolt11,
				Description: inputType.Field0.Description,
				AmountSat:   amountSat,
			},
		}, nil

	case breez_sdk_spark.InputTypeLnurlPay:
		lightning.log.Printf("Input is LNURL-Pay/Lightning address accepting min/max %d/%d msats",
			inputType.Field0.MinSendable, inputType.Field0.MaxSendable)

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
		return nil, errp.New("Invoice format not supported")
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

func toLightningPayment(payment breez_sdk_spark.Payment) lightningPayment {
	result := lightningPayment{
		ID:        payment.Id,
		Type:      toLightningPaymentType(payment.PaymentType),
		Status:    toLightningPaymentStatus(payment.Status),
		AmountSat: parseLightningUint(payment.Amount),
		FeesSat:   parseLightningUint(payment.Fees),
		Timestamp: payment.Timestamp,
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
		result.PaymentHash = details.HtlcDetails.PaymentHash
		if details.HtlcDetails.Preimage != nil {
			result.PaymentPreimage = *details.HtlcDetails.Preimage
		}
	case breez_sdk_spark.PaymentDetailsSpark:
		if details.InvoiceDetails != nil {
			if details.InvoiceDetails.Description != nil {
				result.Description = *details.InvoiceDetails.Description
			}
			result.Invoice = details.InvoiceDetails.Invoice
		}
		if details.HtlcDetails != nil {
			result.PaymentHash = details.HtlcDetails.PaymentHash
			if details.HtlcDetails.Preimage != nil {
				result.PaymentPreimage = *details.HtlcDetails.Preimage
			}
		}
	}

	return result
}

func parseLightningUint(value interface{ String() string }) uint64 {
	parsed, err := strconv.ParseUint(value.String(), 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func prepareSendPaymentRequest(paymentInvoice string, amount *uint64) breez_sdk_spark.PrepareSendPaymentRequest {
	request := breez_sdk_spark.PrepareSendPaymentRequest{
		PaymentRequest: paymentInvoice,
	}
	if amount != nil {
		optionalAmount := new(big.Int).SetUint64(*amount)
		request.Amount = &optionalAmount
	}
	return request
}

func preparedPaymentFee(prepareResponse breez_sdk_spark.PrepareSendPaymentResponse) (*paymentFee, error) {
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

func checkApprovedPaymentFee(fee uint64, approvedFee uint64) error {
	if fee > approvedFee {
		return errPaymentApprovalRequired
	}
	return nil
}

func checkPaymentBalance(fee *paymentFee, balance *accounts.Balance) error {
	if new(big.Int).SetUint64(fee.TotalDebitSat).Cmp(balance.Available().BigInt()) > 0 {
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
	// Spark currently wraps insufficient funds as SdkErrorSparkError with this text.
	if strings.Contains(strings.ToLower(err.Error()), "insufficient funds") {
		return errp.WithMessage(errLightningInsufficientFunds, err.Error())
	}
	return err
}

// PreparePayment computes the fee quote for the provided payment request.
func (lightning *Lightning) PreparePayment(paymentInvoice string, amountSat *uint64) (*paymentFee, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	prepareResponse, err := lightning.sdkService.PrepareSendPayment(prepareSendPaymentRequest(paymentInvoice, amountSat))
	if err != nil {
		return nil, lightningPaymentError(err)
	}

	fee, err := preparedPaymentFee(prepareResponse)
	if err != nil {
		return nil, err
	}
	balance, err := lightning.Balance()
	if err != nil {
		return nil, err
	}
	if err := checkPaymentBalance(fee, balance); err != nil {
		return nil, err
	}
	lightning.log.Printf("Lightning Fee: %v sats", fee.FeeSat)
	return fee, nil
}

// SendPayment executes a payment for the provided payment request.
func (lightning *Lightning) SendPayment(paymentInvoice string, amount *uint64, approvedFee uint64) error {
	if err := lightning.CheckActive(); err != nil {
		return err
	}
	lightning.log.Infof("Sending payment to %+v", paymentInvoice)
	if amount != nil {
		lightning.log.Infof("Optional amount: %+v sat", *amount)
	}

	prepareResponse, err := lightning.sdkService.PrepareSendPayment(prepareSendPaymentRequest(paymentInvoice, amount))
	if err != nil {
		return lightningPaymentError(err)
	}

	fee, err := preparedPaymentFee(prepareResponse)
	if err != nil {
		return err
	}
	balance, err := lightning.Balance()
	if err != nil {
		return err
	}
	if err := checkPaymentBalance(fee, balance); err != nil {
		return err
	}
	if err := checkApprovedPaymentFee(fee.FeeSat, approvedFee); err != nil {
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

// ListPayments fetches lightning payments and converts them to the app-facing contract.
func (lightning *Lightning) ListPayments() ([]lightningPayment, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	response, err := lightning.sdkService.ListPayments(breez_sdk_spark.ListPaymentsRequest{})
	if err != nil {
		return nil, err
	}

	lightning.log.Infof("List payments: %+v", response.Payments)

	payments := make([]lightningPayment, 0, len(response.Payments))
	for _, payment := range response.Payments {
		payments = append(payments, toLightningPayment(payment))
	}
	return payments, nil
}
