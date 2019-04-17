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
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02Bootloader models the API of the bitbox02 package.
type BitBox02Bootloader interface {
	Status() *bitbox02bootloader.Status
	UpgradeFirmware() error
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	device BitBox02Bootloader
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("device", "bitbox02-bootloader")}

	handleFunc("/status", handlers.getStatusHandler).Methods("GET")
	handleFunc("/upgrade-firmware", handlers.postUpgradeFirmwareHandler).Methods("POST")

	return handlers
}

// Init installs a bitbox02 bootloader as a base for the web api. This needs to be called before any
// requests are made.
func (handlers *Handlers) Init(device BitBox02Bootloader) {
	handlers.log.Debug("Init")
	handlers.device = device
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.device = nil
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) (interface{}, error) {
	return handlers.device.Status(), nil
}

func (handlers *Handlers) postUpgradeFirmwareHandler(_ *http.Request) (interface{}, error) {
	return nil, handlers.device.UpgradeFirmware()
}
