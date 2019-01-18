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

package main

import (
	"flag"
	"fmt"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	port    = 8082
	address = "0.0.0.0"
)

// webdevEnvironment implements backend.Environment
type webdevEnvironment struct {
}

// NotifyUser implements backend.Environment
func (webdevEnvironment) NotifyUser(text string) {
	logging.Get().WithGroup("servewallet").Infof("NotifyUser: %s", text)
}

func main() {
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet coins")
	multisig := flag.Bool("multisig", false, "use the app in multisig mode")
	devmode := flag.Bool("devmode", true, "switch to dev mode")
	flag.Parse()

	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
	log := logging.Get().WithGroup("servewallet")
	defer func(log *logrus.Entry) {
		// Recover from all panics and log error before panicking again.
		if r := recover(); r != nil {
			// r is of type interface{} and thus we cannot use log.WithError(r).
			log.WithField("error", r).Error(r)
			panic(r)
		}
	}(log)
	log.Info("--------------- Started application --------------")
	// since we are in dev-mode, we can drop the authorization token
	connectionData := backendHandlers.NewConnectionData(-1, "")
	backend := backend.NewBackend(
		arguments.NewArguments(".", !*mainnet, *regtest, *multisig, *devmode),
		webdevEnvironment{},
	)
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	log.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router); err != nil {
		log.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Error("Failed to listen for HTTP")
	}
}
