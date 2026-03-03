// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/json"
	"net/http"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

type responseDto struct {
	Success      bool        `json:"success"`
	Data         interface{} `json:"data"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	ErrorCode    string      `json:"errorCode,omitempty"`
}

// PostLightningActivateNode handles the POST request to activate the lightning node.
func (lightning *Lightning) PostLightningActivateNode(r *http.Request) interface{} {
	if err := lightning.Activate(); err != nil {
		lightning.log.Error(err)
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true}
}

// PostLightningDeactivateNode handles the POST request to deactivate the lightning node.
func (lightning *Lightning) PostLightningDeactivateNode(r *http.Request) interface{} {
	if err := lightning.Deactivate(); err != nil {
		lightning.log.Error(err)
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true}
}

// GetNodeInfo handles the GET request to retrieve the node info.
func (lightning *Lightning) GetNodeInfo(_ *http.Request) interface{} {
	// if lightning.sdkService == nil {
	return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	// }

	// nodeState, err := lightning.sdkService.NodeInfo()
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// return responseDto{Success: true, Data: toNodeStateDto(nodeState)}
}

// GetBalance handles the GET request to retrieve the node balance and its fiat conversions.
func (lightning *Lightning) GetBalance(_ *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}
	balance, err := lightning.Balance()
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	btcCoin := lightning.btcCoin

	formattedAvailableAmount := coin.FormattedAmount{
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
			Incoming:     coin.FormattedAmount{},
		}}
}

// GetListPayments handles the GET request to list payments.
func (lightning *Lightning) GetListPayments(r *http.Request) interface{} {
	type listPaymentsResponseLightningDetails struct {
		Description *string `json:"Description,omitempty"`
		Preimage    *string `json:"Preimage,omitempty"`
		Invoice     string  `json:"Invoice,omitempty"`
		PaymentHash string  `json:"PaymentHash,omitempty"`
	}

	type listPaymentsResponseSparkInvoiceDetails struct {
		Description *string `json:"Description,omitempty"`
		Invoice     string  `json:"Invoice,omitempty"`
	}

	type listPaymentsResponseSparkHtlcDetails struct {
		PaymentHash string  `json:"PaymentHash,omitempty"`
		Preimage    *string `json:"Preimage,omitempty"`
	}

	type listPaymentsResponseSparkDetails struct {
		InvoiceDetails *listPaymentsResponseSparkInvoiceDetails `json:"InvoiceDetails,omitempty"`
		HtlcDetails    *listPaymentsResponseSparkHtlcDetails    `json:"HtlcDetails,omitempty"`
	}

	type listPaymentsResponsePayment struct {
		Id          string      `json:"Id"`
		PaymentType uint32      `json:"PaymentType"`
		Status      uint32      `json:"Status"`
		Amount      string      `json:"Amount"`
		Fees        string      `json:"Fees"`
		Timestamp   uint64      `json:"Timestamp"`
		Method      uint32      `json:"Method"`
		Details     interface{} `json:"Details,omitempty"`
	}

	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	request, err := toSparkListPaymentsRequest(r.URL.Query())
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	payments, err := lightning.ListPayments(request)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	responsePayments := make([]listPaymentsResponsePayment, 0, len(payments))
	for _, payment := range payments {
		var details interface{}
		if payment.Details != nil {
			switch typed := (*payment.Details).(type) {
			case breez_sdk_spark.PaymentDetailsLightning:
				details = listPaymentsResponseLightningDetails{
					Description: typed.Description,
					Preimage:    typed.Preimage,
					Invoice:     typed.Invoice,
					PaymentHash: typed.PaymentHash,
				}
			case breez_sdk_spark.PaymentDetailsSpark:
				var invoiceDetails *listPaymentsResponseSparkInvoiceDetails
				if typed.InvoiceDetails != nil {
					invoiceDetails = &listPaymentsResponseSparkInvoiceDetails{
						Description: typed.InvoiceDetails.Description,
						Invoice:     typed.InvoiceDetails.Invoice,
					}
				}
				var htlcDetails *listPaymentsResponseSparkHtlcDetails
				if typed.HtlcDetails != nil {
					htlcDetails = &listPaymentsResponseSparkHtlcDetails{
						PaymentHash: typed.HtlcDetails.PaymentHash,
						Preimage:    typed.HtlcDetails.Preimage,
					}
				}
				if invoiceDetails != nil || htlcDetails != nil {
					details = listPaymentsResponseSparkDetails{
						InvoiceDetails: invoiceDetails,
						HtlcDetails:    htlcDetails,
					}
				}
			}
		}

		responsePayments = append(responsePayments, listPaymentsResponsePayment{
			Id:          payment.Id,
			PaymentType: uint32(payment.PaymentType),
			Status:      uint32(payment.Status),
			Amount:      toBigIntString(payment.Amount),
			Fees:        toBigIntString(payment.Fees),
			Timestamp:   payment.Timestamp,
			Method:      uint32(payment.Method),
			Details:     details,
		})
	}

	return responseDto{Success: true, Data: responsePayments}
}

// GetOpenChannelFee handles the GET request fetch the open channel fees.
func (lightning *Lightning) GetOpenChannelFee(r *http.Request) interface{} {
	// if lightning.sdkService == nil {
	return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	// }

	// getParams, err := toOpenChannelFeeRequestDto(r.URL.Query())
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// openChannelFeeResponse, err := lightning.sdkService.OpenChannelFee(toOpenChannelFeeRequest(getParams))
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }
	// return responseDto{Success: true, Data: toOpenChannelFeeResponseDto(openChannelFeeResponse)}
}

// GetBoardingAddress handles the GET request to retrieve a bitcoin boarding address.
func (lightning *Lightning) GetBoardingAddress(r *http.Request) interface{} {
	type boardingAddress struct {
		Address string `json:"address"`
		Fee     uint64 `json:"fee"`
	}

	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}
	address, fee, err := lightning.BoardingAddress()
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{
		Success: true,
		Data: boardingAddress{
			Address: address,
			Fee:     fee.Uint64(),
		},
	}
}

// GetParseInput handles the GET request to parse a text input.
func (lightning *Lightning) GetParseInput(r *http.Request) interface{} {
	type parseInputBolt11Invoice struct {
		Bolt11      string  `json:"bolt11"`
		Description *string `json:"description,omitempty"`
		AmountMsat  *uint64 `json:"amountMsat,omitempty"`
	}

	type parseInputBolt11Response struct {
		Type    string                  `json:"type"`
		Invoice parseInputBolt11Invoice `json:"invoice"`
	}

	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}
	input, err := lightning.ParseInput(r.URL.Query().Get("s"))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	switch typed := input.(type) {
	case breez_sdk_spark.InputTypeBolt11Invoice:
		return responseDto{
			Success: true,
			Data: parseInputBolt11Response{
				Type: "bolt11",
				Invoice: parseInputBolt11Invoice{
					Bolt11:      typed.Field0.Invoice.Bolt11,
					Description: typed.Field0.Description,
					AmountMsat:  typed.Field0.AmountMsat,
				},
			},
		}
	}

	return responseDto{Success: false, ErrorMessage: "Unsupported input type"}
}

type receivePaymentResponse struct {
	Invoice string `json:"invoice"`
	// Fee to pay to receive the payment
	// Denominated in sats or token base units
	Fee uint64 `json:"fee"`
}

// PostReceivePayment handles the POST request to receive a payment.
func (lightning *Lightning) PostReceivePayment(r *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	var jsonBody receivePaymentRequestDto
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	receiveResponse, err := lightning.ReceivePayment(jsonBody.AmountMsat/1000, jsonBody.Description)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: receivePaymentResponse{Invoice: receiveResponse.PaymentRequest, Fee: receiveResponse.Fee.Uint64()}}
}

// PostSendPayment handles the POST request to send a payment.
func (lightning *Lightning) PostSendPayment(r *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	var jsonBody sendPaymentRequestDto
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	var amount *uint64
	if jsonBody.AmountMsat != nil {
		amount = jsonBody.AmountMsat
	}

	if err := lightning.SendPayment(jsonBody.Bolt11, amount); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true}
}

// GetDiagnosticData handles the GET request to retrieve the SDK diagnostic data.
func (lightning *Lightning) GetDiagnosticData(_ *http.Request) interface{} {
	// if lightning.sdkService == nil {
	return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	// }

	// diagnosticData, err := lightning.sdkService.GenerateDiagnosticData()
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// return responseDto{Success: true, Data: toDiagnosticDataDto(diagnosticData)}
}

// PostReportPaymentFailure handles the POST request to report a payment failure.
func (lightning *Lightning) PostReportPaymentFailure(r *http.Request) interface{} {
	// if lightning.sdkService == nil {
	return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	// }

	// var jsonBody reportPaymentFailureRequestDto
	// if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// err := lightning.sdkService.ReportIssue(toReportIssueRequest(jsonBody))
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// return responseDto{Success: true}
}

// GetServiceHealthCheck handles the GET request to retrieve the SDK service health check.
func (lightning *Lightning) GetServiceHealthCheck(_ *http.Request) interface{} {
	// breezApiKey, err := lightning.getBreezApiKey()
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// response, err := breez_sdk.ServiceHealthCheck(*breezApiKey)
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// dto, err := toServiceHealthCheckResponseDto(response)
	// if err != nil {
	// 	return responseDto{Success: false, ErrorMessage: err.Error()}
	// }

	// return responseDto{Success: true, Data: dto}
	return responseDto{Success: false, ErrorMessage: "health check not available"}
}
