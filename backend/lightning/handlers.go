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
	"net/http"

	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

type Handlers struct {
	observable.Implementation

	account    accounts.Interface
	log        *logrus.Entry
	sdkService *breez_sdk.BlockingBreezServices
	synced     bool
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(router *mux.Router, middleware backend.HandlersMiddleware, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log, synced: false}

	handleFunc := middleware.GetApiRouter(router)
	handleFunc("/status", handlers.getStatus).Methods("GET")

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

type statusResponse struct {
	Pubkey        string `json:"pubkey"`
	BlockHeight   uint32 `json:"blockHeight"`
	Synced        bool   `json:"synced"`
	LocalBalance  uint64 `json:"localBalance"`
	RemoteBalance uint64 `json:"remoteBalance"`
}

func (handlers *Handlers) getStatus(_ *http.Request) (interface{}, error) {
	if handlers.account == nil || handlers.sdkService == nil {
		return statusResponse{Synced: false}, nil
	}

	nodeState, err := handlers.sdkService.NodeInfo()

	if err != nil {
		return statusResponse{Synced: false}, errp.New("Error requesting node status.")
	}

	return statusResponse{
		Pubkey:        nodeState.Id,
		BlockHeight:   nodeState.BlockHeight,
		Synced:        handlers.synced,
		LocalBalance:  ToSats(nodeState.MaxPayableMsat),
		RemoteBalance: ToSats(nodeState.InboundLiquidityMsats),
	}, nil
}
