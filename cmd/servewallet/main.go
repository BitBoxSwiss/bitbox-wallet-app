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
	"os/exec"
	"runtime"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
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
	log := logging.Get().WithGroup("servewallet")
	log.Infof("NotifyUser: %s", text)
	// We use system notifications on unix/macOS, the primary dev environments.
	switch runtime.GOOS {
	case "darwin":
		// #nosec G204
		err := exec.Command("osascript", "-e",
			fmt.Sprintf(`display notification "%s" with title \"BitBox Wallet DEV\"`, text))
		if err != nil {
			log.Error(err)
		}
	case "linux":
		// #nosec G204b
		err := exec.Command("notify-send", "BitBox Wallet DEV", text).Run()
		if err != nil {
			log.Error(err)
		}
	}
}

func (webdevEnvironment) DeviceInfos() []usb.DeviceInfo {
	return usb.DeviceInfos()
}

func main() {
	config.SetAppDir("appfolder.dev")

	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet coins")
	multisig := flag.Bool("multisig", false, "use the app in multisig mode")
	devmode := flag.Bool("devmode", true, "switch to dev mode")
	devservers := flag.Bool("devservers", true, "switch to dev servers")
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
	backend, err := backend.NewBackend(
		arguments.NewArguments(config.AppDir(), !*mainnet, *regtest, *multisig, *devmode, *devservers),
		webdevEnvironment{})
	if err != nil {
		log.Fatal(err)
	}
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	log.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router); err != nil {
		log.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Fatal("Failed to listen for HTTP")
	}
}
