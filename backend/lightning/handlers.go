// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
)

type responseDto struct {
	Success      bool                   `json:"success"`
	Data         interface{}            `json:"data"`
	ErrorData    map[string]interface{} `json:"errorData,omitempty"`
	ErrorMessage string                 `json:"errorMessage,omitempty"`
	ErrorCode    string                 `json:"errorCode,omitempty"`
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleNoError func(string, func(*http.Request) interface{}) *mux.Route,
	lightning *Lightning,
) {
	handleNoError("/account", lightning.GetAccount).Methods("GET")
	handleNoError("/address", lightning.GetLightningAddress).Methods("GET")
	handleNoError("/address/domain", lightning.GetAddressDomain).Methods("GET")
	handleNoError("/address/availability", lightning.GetAddressAvailability).Methods("GET")
	handleNoError("/address/generate", lightning.PostGenerateAddress).Methods("POST")
	handleNoError("/address/register", lightning.PostRegisterAddress).Methods("POST")
	handleNoError("/ready", lightning.GetReady).Methods("GET")
	handleNoError("/activate", lightning.PostActivate).Methods("POST")
	handleNoError("/deactivate", lightning.PostDeactivate).Methods("POST")
	handleNoError("/balance", lightning.GetBalance).Methods("GET")
	handleNoError("/block-explorer-tx-prefix", lightning.GetBlockExplorerTxPrefix).Methods("GET")
	handleNoError("/spark-status", lightning.GetSparkStatus).Methods("GET")
	handleNoError("/list-payments", lightning.GetListPayments).Methods("GET")
	handleNoError("/parse-payment-input", lightning.GetParsePaymentInput).Methods("GET")
	handleNoError("/prepare-payment", lightning.PostPreparePayment).Methods("POST")
	handleNoError("/claim-top-up", lightning.PostClaimTopUp).Methods("POST")
	handleNoError("/refund-top-up", lightning.PostRefundTopUp).Methods("POST")
	handleNoError("/top-up/prepare", lightning.PostPrepareTopUp).Methods("POST")
	handleNoError("/close-withdraw-funds/prepare", lightning.PostPrepareCloseWithdraw).Methods("POST")
	handleNoError("/close-withdraw-funds", lightning.PostCloseWithdraw).Methods("POST")
	handleNoError("/receive-payment", lightning.GetReceivePayment).Methods("GET")
	handleNoError("/send-payment", lightning.PostSendPayment).Methods("POST")
}

// PostPrepareTopUp handles the POST request to validate and prepare a Lightning top-up.
func (lightning *Lightning) PostPrepareTopUp(r *http.Request) interface{} {
	type result struct {
		Success      bool          `json:"success"`
		ErrorCode    string        `json:"errorCode,omitempty"`
		FundingLimit *fundingLimit `json:"fundingLimit,omitempty"`
		MinAmountSat uint64        `json:"minAmountSat,omitempty"`
		*topUpProposal
	}

	var request prepareTopUpRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return errorResponse(err)
	}

	proposal, err := lightning.PrepareTopUp(request)
	if err == nil {
		return responseDto{Success: true, Data: result{Success: true, topUpProposal: proposal}}
	}

	var limitErr *topUpFundingLimitError
	if errors.As(err, &limitErr) {
		return responseDto{Success: true, Data: result{
			Success:      false,
			ErrorCode:    string(errLightningBalanceLimitExceeded),
			FundingLimit: &limitErr.fundingLimit,
		}}
	}
	var amountBelowMinimum *lightningAmountBelowMinimumError
	if errors.As(err, &amountBelowMinimum) {
		return responseDto{Success: true, Data: result{
			Success:      false,
			ErrorCode:    string(errLightningAmountBelowMinimum),
			MinAmountSat: amountBelowMinimum.minAmountSat,
		}}
	}
	var validationErr accountErrors.TxValidationError
	if errors.As(err, &validationErr) {
		return responseDto{Success: true, Data: result{Success: false, ErrorCode: validationErr.Error()}}
	}
	return errorResponse(err)
}

func errorResponse(err error) responseDto {
	if errCode, ok := errp.Cause(err).(errp.ErrorCode); ok {
		response := responseDto{Success: false, ErrorCode: string(errCode)}
		var amountBelowMinimum *lightningAmountBelowMinimumError
		if errors.As(err, &amountBelowMinimum) {
			response.ErrorData = map[string]interface{}{
				"minAmountSat": amountBelowMinimum.minAmountSat,
			}
		}
		return response
	}
	return responseDto{Success: false, ErrorMessage: err.Error()}
}

func preparePaymentErrorResponse(err error, fee *paymentFee) responseDto {
	response := errorResponse(err)
	if fee != nil && response.ErrorCode == string(errLightningInsufficientFunds) {
		response.ErrorData = map[string]interface{}{
			"amountSat":     fee.AmountSat,
			"feeSat":        fee.FeeSat,
			"totalDebitSat": fee.TotalDebitSat,
		}
	}
	return response
}

// GetAccount handles the GET request to retrieve the configured lightning account.
func (lightning *Lightning) GetAccount(_ *http.Request) interface{} {
	account := lightning.Account()
	type response struct {
		RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
		Code            types.Code     `json:"code"`
		Number          uint16         `json:"num"`
	}
	if account == nil {
		return nil
	}
	return &response{
		RootFingerprint: account.RootFingerprint,
		Code:            account.Code,
		Number:          account.Number,
	}
}

// GetBlockExplorerTxPrefix handles the GET request to retrieve the Bitcoin transaction explorer prefix.
func (lightning *Lightning) GetBlockExplorerTxPrefix(_ *http.Request) interface{} {
	_, btcCoin := lightning.runtimeDependencies()
	return responseDto{
		Success: true,
		Data:    btcCoin.BlockExplorerTransactionURLPrefix(),
	}
}

// GetLightningAddress handles the GET request to retrieve the registered lightning address.
func (lightning *Lightning) GetLightningAddress(_ *http.Request) interface{} {
	address, err := lightning.LightningAddress()
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: address}
}

// GetAddressDomain handles the GET request to retrieve the configured lightning address domain.
func (lightning *Lightning) GetAddressDomain(_ *http.Request) interface{} {
	return responseDto{Success: true, Data: lightning.AddressDomain()}
}

// GetAddressAvailability handles the GET request to check lightning address username availability.
func (lightning *Lightning) GetAddressAvailability(r *http.Request) interface{} {
	availability, err := lightning.AddressAvailability(r.URL.Query().Get("username"))
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: availability}
}

// PostGenerateAddress handles the POST request to generate an available lightning address username.
func (lightning *Lightning) PostGenerateAddress(_ *http.Request) interface{} {
	address, err := lightning.GenerateAddress()
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: address}
}

// PostRegisterAddress handles the POST request to register a lightning address username.
func (lightning *Lightning) PostRegisterAddress(r *http.Request) interface{} {
	var jsonBody struct {
		Username string `json:"username"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	address, err := lightning.RegisterAddress(jsonBody.Username)
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: address}
}

// GetReady handles the GET request to retrieve whether the lightning SDK is ready.
func (lightning *Lightning) GetReady(_ *http.Request) interface{} {
	return responseDto{Success: true, Data: lightning.Ready()}
}

// PostActivate handles the POST request to activate lightning.
func (lightning *Lightning) PostActivate(_ *http.Request) interface{} {
	if err := lightning.Activate(); err != nil {
		lightning.log.Error(err)
		return errorResponse(err)
	}

	return responseDto{Success: true}
}

// PostDeactivate handles the POST request to deactivate lightning.
func (lightning *Lightning) PostDeactivate(_ *http.Request) interface{} {
	if err := lightning.Deactivate(); err != nil {
		lightning.log.Error(err)
		return errorResponse(err)
	}

	return responseDto{Success: true}
}

type formattedLightningBalance struct {
	accounts.FormattedAccountBalance
	FundingLimit fundingLimit `json:"fundingLimit"`
}

// formattedBalance returns the lightning balance with its fiat conversions.
func (lightning *Lightning) formattedBalance() (*formattedLightningBalance, error) {
	balance, limit, err := lightning.balanceWithFundingLimit()
	if err != nil {
		return nil, err
	}

	ratesUpdater, btcCoin := lightning.runtimeDependencies()

	formattedAvailableAmount := coin.FormattedAmountWithConversions{
		Amount:                 btcCoin.FormatAmount(balance.Available(), false),
		Unit:                   btcCoin.GetFormatUnit(false),
		Conversions:            coin.Conversions(balance.Available(), btcCoin, false, ratesUpdater),
		UnformattedConversions: coin.UnformattedConversions(balance.Available(), btcCoin, false, ratesUpdater),
	}
	formattedIncomingAmount := coin.FormattedAmountWithConversions{
		Amount:                 btcCoin.FormatAmount(balance.Incoming(), false),
		Unit:                   btcCoin.GetFormatUnit(false),
		Conversions:            coin.Conversions(balance.Incoming(), btcCoin, false, ratesUpdater),
		UnformattedConversions: coin.UnformattedConversions(balance.Incoming(), btcCoin, false, ratesUpdater),
	}

	return &formattedLightningBalance{
		FormattedAccountBalance: accounts.FormattedAccountBalance{
			HasAvailable: balance.Available().BigInt().Sign() > 0,
			Available:    formattedAvailableAmount,
			HasIncoming:  balance.Incoming().BigInt().Sign() > 0,
			Incoming:     formattedIncomingAmount,
		},
		FundingLimit: limit,
	}, nil
}

// GetBalance handles the GET request to retrieve the balance and its fiat conversions.
func (lightning *Lightning) GetBalance(_ *http.Request) interface{} {
	balance, err := lightning.formattedBalance()
	if err != nil {
		return errorResponse(err)
	}

	return responseDto{
		Success: true,
		Data:    balance,
	}
}

// GetSparkStatus handles the GET request to retrieve the Spark network status.
func (lightning *Lightning) GetSparkStatus(_ *http.Request) interface{} {
	status, err := lightning.SparkStatus()
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: status}
}

// GetListPayments handles the GET request to list payments.
func (lightning *Lightning) GetListPayments(_ *http.Request) interface{} {
	payments, err := lightning.ListPayments()
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: payments}
}

// PostClaimTopUp handles the POST request to manually claim a Bitcoin top-up.
func (lightning *Lightning) PostClaimTopUp(r *http.Request) interface{} {
	var jsonBody struct {
		PaymentID      string `json:"paymentId"`
		ApprovedFeeSat uint64 `json:"approvedFeeSat"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	result, err := lightning.ClaimTopUp(jsonBody.PaymentID, jsonBody.ApprovedFeeSat)
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: result}
}

// PostRefundTopUp handles the POST request to refund a Bitcoin top-up.
func (lightning *Lightning) PostRefundTopUp(r *http.Request) interface{} {
	var jsonBody struct {
		PaymentID                  string     `json:"paymentId"`
		DestinationAccountCode     types.Code `json:"destinationAccountCode"`
		ApprovedFeeRateSatPerVbyte uint64     `json:"approvedFeeRateSatPerVbyte"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	result, err := lightning.RefundTopUp(
		jsonBody.PaymentID,
		jsonBody.DestinationAccountCode,
		jsonBody.ApprovedFeeRateSatPerVbyte,
	)
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: result}
}

// PostPrepareCloseWithdraw handles the POST request to prepare a full-balance on-chain withdrawal.
func (lightning *Lightning) PostPrepareCloseWithdraw(r *http.Request) interface{} {
	var jsonBody struct {
		DestinationAccountCode types.Code `json:"destinationAccountCode"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	quote, err := lightning.PrepareCloseWithdraw(jsonBody.DestinationAccountCode)
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: quote}
}

// PostCloseWithdraw handles the POST request to withdraw all funds and deactivate Lightning.
func (lightning *Lightning) PostCloseWithdraw(r *http.Request) interface{} {
	var jsonBody struct {
		DestinationAccountCode types.Code `json:"destinationAccountCode"`
		ApprovedBalanceSat     uint64     `json:"approvedBalanceSat"`
		ApprovedFeeSat         uint64     `json:"approvedFeeSat"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	result, err := lightning.CloseWithdraw(
		jsonBody.DestinationAccountCode,
		jsonBody.ApprovedBalanceSat,
		jsonBody.ApprovedFeeSat,
	)
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: result}
}

// GetParsePaymentInput handles the GET request to parse a payment input.
func (lightning *Lightning) GetParsePaymentInput(r *http.Request) interface{} {
	input, err := lightning.ParsePaymentInput(r.URL.Query().Get("s"))
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: input}
}

// PostPreparePayment handles the POST request to prepare a payment quote.
func (lightning *Lightning) PostPreparePayment(r *http.Request) interface{} {
	var jsonBody preparePaymentRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	fee, err := lightning.PreparePayment(jsonBody)
	if err != nil {
		return preparePaymentErrorResponse(err, fee)
	}

	return responseDto{Success: true, Data: fee}
}

// GetReceivePayment handles the GET request to create a receive invoice.
func (lightning *Lightning) GetReceivePayment(r *http.Request) interface{} {
	amountSat, err := strconv.ParseUint(r.URL.Query().Get("amountSat"), 10, 64)
	if err != nil {
		return errorResponse(err)
	}

	receiveResponse, err := lightning.ReceivePayment(amountSat, r.URL.Query().Get("description"))
	if err != nil {
		return errorResponse(err)
	}

	return responseDto{Success: true, Data: receiveResponse}
}

// PostSendPayment handles the POST request to send a payment.
func (lightning *Lightning) PostSendPayment(r *http.Request) interface{} {
	var jsonBody sendPaymentRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jsonBody); err != nil {
		return errorResponse(err)
	}

	if err := lightning.SendPayment(jsonBody); err != nil {
		return errorResponse(err)
	}

	return responseDto{Success: true}
}
