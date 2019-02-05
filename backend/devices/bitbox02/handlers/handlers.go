// Copyright 2018 Shift Devices AG
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
	"encoding/hex"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02 models the API of the bitbox02 package.
type BitBox02 interface {
	Random() ([]byte, error)
	ChannelHash() (string, bool)
	GetInfo() (string, error)
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	device BitBox02
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log}

	handleFunc("/random-number", handlers.postGetRandomNumberHandler).Methods("POST")
	handleFunc("/channel-hash", handlers.getChannelHash).Methods("GET")
	handleFunc("/get-info", handlers.getDeviceInfo).Methods("POST")

	return handlers
}

// Init installs a bitbox02 as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(device BitBox02) {
	handlers.log.Debug("Init")
	handlers.device = device
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.device = nil
}

func (handlers *Handlers) postGetRandomNumberHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Random Number")
	randomNumber, err := handlers.device.Random()
	if err != nil {
		return nil, err
	}
	return hex.EncodeToString(randomNumber), nil
}

func (handlers *Handlers) getDeviceInfo(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Get Device Info")
	deviceInfo, err := handlers.device.GetInfo()
	if err != nil {
		return "", err
	}
	return deviceInfo, nil
}

func (handlers *Handlers) getChannelHash(_ *http.Request) (interface{}, error) {
	hash, verified := handlers.device.ChannelHash()
	return map[string]interface{}{
		"hash":     hash,
		"verified": verified,
	}, nil
}
