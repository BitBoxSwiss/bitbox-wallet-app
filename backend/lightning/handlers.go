// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
)

type responseDto struct {
	Success      bool        `json:"success"`
	Data         interface{} `json:"data"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	ErrorCode    string      `json:"errorCode,omitempty"`
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
	handleNoError("/spark-status", lightning.GetSparkStatus).Methods("GET")
	handleNoError("/list-payments", lightning.GetListPayments).Methods("GET")
	handleNoError("/parse-payment-input", lightning.GetParsePaymentInput).Methods("GET")
	handleNoError("/prepare-payment", lightning.PostPreparePayment).Methods("POST")
	handleNoError("/boarding-address", lightning.GetBoardingAddress).Methods("GET")
	handleNoError("/receive-payment", lightning.GetReceivePayment).Methods("GET")
	handleNoError("/send-payment", lightning.PostSendPayment).Methods("POST")
}

func errorResponse(err error) responseDto {
	if errCode, ok := errp.Cause(err).(errp.ErrorCode); ok {
		return responseDto{Success: false, ErrorCode: string(errCode)}
	}
	return responseDto{Success: false, ErrorMessage: err.Error()}
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

// GetBalance handles the GET request to retrieve the balance and its fiat conversions.
func (lightning *Lightning) GetBalance(_ *http.Request) interface{} {
	balance, err := lightning.Balance()
	if err != nil {
		return errorResponse(err)
	}

	btcCoin := lightning.btcCoin

	formattedAvailableAmount := coin.FormattedAmountWithConversions{
		Amount:      btcCoin.FormatAmount(balance.Available(), false),
		Unit:        btcCoin.GetFormatUnit(false),
		Conversions: coin.Conversions(balance.Available(), btcCoin, false, lightning.ratesUpdater),
	}

	return responseDto{
		Success: true,
		Data: accounts.FormattedAccountBalance{
			HasAvailable: balance.Available().BigInt().Sign() > 0,
			Available:    formattedAvailableAmount,
			HasIncoming:  false,
			Incoming:     coin.FormattedAmountWithConversions{},
		},
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

// GetBoardingAddress handles the GET request to retrieve a bitcoin boarding address.
func (lightning *Lightning) GetBoardingAddress(_ *http.Request) interface{} {
	address, err := lightning.BoardingAddress()
	if err != nil {
		return errorResponse(err)
	}
	return responseDto{Success: true, Data: address}
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
		return errorResponse(err)
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
