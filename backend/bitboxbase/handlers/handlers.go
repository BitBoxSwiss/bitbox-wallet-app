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
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

//Base models the api of the base middleware
type Base interface {
	BlockInfo() string
	ConnectElectrum() error
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

	handleFunc("/blockinfo", handlers.getBlockInfoHandler).Methods("GET")
	handleFunc("/connect-electrum", handlers.postConnectElectrumHandler).Methods("POST")

	return handlers
}

// Init installs a bitboxbase as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(base Base) {
	handlers.log.Debug("Init")
	handlers.base = base
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.base = nil
}

func (handlers *Handlers) getBlockInfoHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Block Info")
	return handlers.base.BlockInfo(), nil
}

func (handlers *Handlers) postConnectElectrumHandler(r *http.Request) (interface{}, error) {
	err := handlers.base.ConnectElectrum()
	if err != nil {
		return map[string]interface{}{"success": false}, nil
	}
	return map[string]interface{}{"success": true}, nil
}
