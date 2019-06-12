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

package android

import (
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
)

// androidEnvironment implements backend.Environment
type androidEnvironment struct {
}

// NotifyUser implements backend.Environment
func (androidEnvironment) NotifyUser(text string) {
	// TODO: use android notification center.
}

// DeviceInfos implements backend.Environment
func (androidEnvironment) DeviceInfos() []usb.DeviceInfo {
	return []usb.DeviceInfo{}
}

// Serve serves the BitBox Wallet API for use in a mobile client.
func Serve() {
	log := logging.Get().WithGroup("android")
	token, err := random.HexString(16)
	if err != nil {
		log.WithError(err).Fatal("Failed to generate random string")
	}
	connectionData := backendHandlers.NewConnectionData(8082, token)
	backend, err := backend.NewBackend(
		arguments.NewArguments(".", false, false, false, false),
		androidEnvironment{},
	)
	if err != nil {
		log.Fatal(err)
	}

	handlers := backendHandlers.NewHandlers(backend, connectionData)
	err = http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
