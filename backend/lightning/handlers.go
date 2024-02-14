// Copyright 2018 Shift Devices AG
// Copyright 2023 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package lightning

import (
	"encoding/json"
	"net/http"

	"github.com/breez/breez-sdk-go/breez_sdk"
)

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

// GetNodeInfo handles the GET request retrieve the node info.
func (lightning *Lightning) GetNodeInfo(_ *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	nodeState, err := lightning.sdkService.NodeInfo()
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toNodeStateDto(nodeState)}
}

// GetListPayments handles the GET request to list payments.
func (lightning *Lightning) GetListPayments(r *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	getParams, err := toListPaymentsRequestDto(r.URL.Query())
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	listPaymentsRequest, err := toListPaymentsRequest(getParams)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	paymentsResponse, err := lightning.sdkService.ListPayments(listPaymentsRequest)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	payments, err := toPaymentsDto(paymentsResponse)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}
	return responseDto{Success: true, Data: payments}
}

// GetOpenChannelFee handles the GET request fetch the open channel fees.
func (lightning *Lightning) GetOpenChannelFee(r *http.Request) interface{} {
	if lightning.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	getParams, err := toOpenChannelFeeRequestDto(r.URL.Query())
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	openChannelFeeResponse, err := lightning.sdkService.OpenChannelFee(toOpenChannelFeeRequest(getParams))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toOpenChannelFeeResponseDto(openChannelFeeResponse)}
}

// GetParseInput handles the GET request to parse a text input.
func (lightning *Lightning) GetParseInput(r *http.Request) interface{} {
	input, err := breez_sdk.ParseInput(r.URL.Query().Get("s"))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	paymentDto, err := toInputTypeDto(input)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: paymentDto}
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

	receivePaymentResponse, err := lightning.sdkService.ReceivePayment(toReceivePaymentRequest(jsonBody))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toReceivePaymentResponseDto(receivePaymentResponse)}
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

	sendPaymentResponse, err := lightning.sdkService.SendPayment(toSendPaymentRequest(jsonBody))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	dto, err := toSendPaymentResponseDto(sendPaymentResponse)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: dto}
}
