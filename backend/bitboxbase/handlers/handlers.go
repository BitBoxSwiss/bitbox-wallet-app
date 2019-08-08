// Copyright 2019 Shift Devices AG
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

package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

//Base models the api of the base middleware
type Base interface {
	MiddlewareInfo() (rpcmessages.SampleInfoResponse, error)
	ConnectElectrum() error
	Status() bitboxbasestatus.Status
	ChannelHash() (string, bool)
	Deregister() (bool, error)
	SyncOption(string) (bool, error)
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	base Base
	log  *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("bitboxbase", "base")}

	handleFunc("/middlewareinfo", handlers.getMiddlewareInfoHandler).Methods("GET")
	handleFunc("/connect-electrum", handlers.postConnectElectrumHandler).Methods("POST")
	handleFunc("/channel-hash", handlers.getChannelHashHandler).Methods("GET")
	handleFunc("/status", handlers.getStatusHandler).Methods("GET")
	handleFunc("/disconnect", handlers.postDisconnectBaseHandler).Methods("POST")
	handleFunc("/syncoption", handlers.postSyncOptionHandler).Methods("POST")

	return handlers
}

// Init installs a bitboxbase as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(base Base) {
	handlers.log.Debug("Init")
	handlers.base = base
}

// Uninit removes the bitboxbase. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.base = nil
}

func (handlers *Handlers) postDisconnectBaseHandler(r *http.Request) (interface{}, error) {
	handlers.log.Println("Disconnecting base...")
	success, err := handlers.base.Deregister()

	return map[string]interface{}{"success": success}, err
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Println("Sending Status: ", handlers.base.Status())
	return map[string]interface{}{"status": handlers.base.Status()}, nil
}

func (handlers *Handlers) getChannelHashHandler(r *http.Request) (interface{}, error) {
	hash, bitboxBaseVerified := handlers.base.ChannelHash()
	return map[string]interface{}{
		"hash":               hash,
		"bitboxBaseVerified": bitboxBaseVerified,
	}, nil

}

func (handlers *Handlers) getMiddlewareInfoHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("Block Info")
	middlewareInfo, err := handlers.base.MiddlewareInfo()
	if err != nil {
		handlers.log.Println(err.Error())
		return nil, err
	}
	return map[string]interface{}{
		"success":        true,
		"middlewareInfo": middlewareInfo,
	}, nil
}

func (handlers *Handlers) postConnectElectrumHandler(r *http.Request) (interface{}, error) {
	err := handlers.base.ConnectElectrum()
	if err != nil {
		return map[string]interface{}{"success": false}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSyncOptionHandler(r *http.Request) (interface{}, error) {
	payload := struct {
		Option string `json:"option"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return nil, err
	}

	success, err := handlers.base.SyncOption(payload.Option)
	return map[string]interface{}{"success": success}, err
}
