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
	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

type Backend interface {
	observable.Interface
}

type Handlers struct {
	observable.Implementation

	account    accounts.Interface
	log        *logrus.Entry
	sdkService *breez_sdk.BlockingBreezServices
	synced     bool
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(backend Backend, router *mux.Router, middleware backend.HandlersMiddleware, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log, synced: false}
	handlers.Observe(backend.Notify)

	apiRouter := middleware.GetApiRouterNoError(router)
	apiRouter("/node-info", handlers.getNodeInfo).Methods("GET")
	apiRouter("/open-channel-fee", handlers.postOpenChannelFee).Methods("POST")
	apiRouter("/parse-input", handlers.postParseInput).Methods("POST")
	apiRouter("/receive-payment", handlers.postReceivePayment).Methods("POST")
	apiRouter("/send-payment", handlers.postSendPayment).Methods("POST")

	return handlers
}

// This needs to be called before any requests are made.
func (handlers *Handlers) Init(account accounts.Interface) {
	handlers.account = account

	//if account.Config().Config.LightningEnabled {
	// Connect the SDK
	switch account.Coin().Code() {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeRBTC:
		config := account.Config().Config
		handlers.log.Printf("Init using account %s", config.Code)

		if !config.Inactive && !config.HiddenBecauseUnused {
			handlers.connect()
		}
	}
	//}
}

// Uninit removes the account. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.account = nil
	// Disconnect the SDK.
	handlers.disconnect()
}

func (handlers *Handlers) getNodeInfo(_ *http.Request) interface{} {
	if handlers.account == nil || handlers.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	nodeState, err := handlers.sdkService.NodeInfo()
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toNodeStateDto(nodeState)}
}

func (handlers *Handlers) postOpenChannelFee(r *http.Request) interface{} {
	if handlers.account == nil || handlers.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	var jsonBody openChannelFeeRequestDto

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	openChannelFeeResponse, err := handlers.sdkService.OpenChannelFee(toOpenChannelFeeRequest(jsonBody))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toOpenChannelFeeResponseDto(openChannelFeeResponse)}
}

func (handlers *Handlers) postParseInput(r *http.Request) interface{} {
	var jsonBody struct {
		S string `json:"s"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	input, err := breez_sdk.ParseInput(jsonBody.S)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	paymentDto, err := toInputTypeDto(input)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: paymentDto}
}

func (handlers *Handlers) postReceivePayment(r *http.Request) interface{} {
	if handlers.account == nil || handlers.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	var jsonBody receivePaymentRequestDto

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	receivePaymentResponse, err := handlers.sdkService.ReceivePayment(toReceivePaymentRequest(jsonBody))
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: toReceivePaymentResponseDto(receivePaymentResponse)}
}

func (handlers *Handlers) postSendPayment(r *http.Request) interface{} {
	if handlers.account == nil || handlers.sdkService == nil {
		return responseDto{Success: false, ErrorMessage: "BreezServices not initialized"}
	}

	var jsonBody struct {
		Bolt11     string  `json:"bolt11"`
		AmountSats *uint64 `json:"amountSats"`
	}

	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	payment, err := handlers.sdkService.SendPayment(jsonBody.Bolt11, jsonBody.AmountSats)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	paymentDto, err := toPaymentDto(payment)
	if err != nil {
		return responseDto{Success: false, ErrorMessage: err.Error()}
	}

	return responseDto{Success: true, Data: paymentDto}
}
