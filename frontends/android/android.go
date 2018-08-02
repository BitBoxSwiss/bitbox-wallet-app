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
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
)

// Serve serves the godbb API for use in a mobile client.
func Serve() {
	log := logging.Get().WithGroup("android")
	token, err := random.HexString(16)
	if err != nil {
		log.WithError(err).Fatal("Failed to generate random string")
	}
	connectionData := backendHandlers.NewConnectionData(8082, token)
	backend := backend.NewBackend(arguments.NewArguments(".", false, false, false, false))
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	err = http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
