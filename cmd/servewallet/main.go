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
	"os"
	"os/exec"
	"runtime"
	"strings"

	backendPkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02/simulator"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	backendHandlers "github.com/BitBoxSwiss/bitbox-wallet-app/backend/handlers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/system"
	"github.com/sirupsen/logrus"
)

const (
	port    = 8082
	address = "0.0.0.0"
	darwin  = "darwin"
)

var backend *backendPkg.Backend

// webdevEnvironment implements backend.Environment.
type webdevEnvironment struct {
}

// NotifyUser implements backend.Environment.
func (webdevEnvironment) NotifyUser(text string) {
	log := logging.Get().WithGroup("servewallet")
	log.Infof("NotifyUser: %s", text)
	// We use system notifications on unix/macOS, the primary dev environments.
	switch runtime.GOOS {
	case "darwin":
		// #nosec G204
		err := exec.Command("osascript", "-e",
			fmt.Sprintf(`display notification "%s" with title \"BitBoxApp DEV\"`, text))
		if err != nil {
			log.Error(err)
		}
	case "linux":
		// #nosec G204b
		err := exec.Command("notify-send", "BitBoxApp DEV", text).Run()
		if err != nil {
			log.Error(err)
		}
	}
}

// DeviceInfos implements backend.Environment.
func (webdevEnvironment) DeviceInfos() []usb.DeviceInfo {
	testDeviceInfo := simulator.TestDeviceInfo()
	if testDeviceInfo != nil {
		// We are in "test device" mode.
		return []usb.DeviceInfo{*testDeviceInfo}
	}
	return usb.DeviceInfos()
}

// SystemOpen implements backend.Environment.
func (webdevEnvironment) SystemOpen(url string) error {
	return system.Open(url)
}

// UsingMobileData implements backend.Environment.
func (webdevEnvironment) UsingMobileData() bool {
	return false
}

// Auth implements backend.Environment.
func (webdevEnvironment) Auth() {
	log := logging.Get().WithGroup("servewallet")
	log.Info("Webdev Auth")
	if backend != nil {
		backend.AuthResult(backendPkg.AuthResultOk)
		log.Info("Webdev Auth OK")
	}
}

// OnAuthSettingChanged implements backend.Environment.
func (webdevEnvironment) OnAuthSettingChanged(enabled bool) {
}

// BluetoothConnect implements backend.Environment.
func (webdevEnvironment) BluetoothConnect(identifier string) {
}

// NativeLocale naively implements backend.Environment.
// This version is unlikely to work on Windows.
func (webdevEnvironment) NativeLocale() string {
	log := logging.Get().WithGroup("servewallet")
	v := os.Getenv("LC_ALL")
	if v == "" {
		if lang, ok := os.LookupEnv("LANG"); ok {
			v = lang
		} else if runtime.GOOS == darwin {
			out, err := exec.Command("defaults", "read", "-g", "AppleLocale").Output()
			if err != nil {
				log.Warnf("failed to read AppleLocale via defaults: %v", err)
			} else {
				v = strings.Split(strings.TrimSpace(string(out)), "@")[0]
			}
		}
	}

	// Strip charset from the LANG. It is unsupported by JS Date formatting
	// used in the frontend and breaks UI in unexpected ways.
	// We are always UTF-8 anyway.
	return strings.Split(v, ".")[0]
}

// GetSaveFilename implements backend.Environment.
func (webdevEnvironment) GetSaveFilename(suggestedFilename string) string {
	return suggestedFilename
}

// SetDarkTheme implements backend.Environment.
func (webdevEnvironment) SetDarkTheme(isDark bool) {
	// nothing to do here.
}

// DetectDarkTheme implements backend.Environment.
func (webdevEnvironment) DetectDarkTheme() bool {
	// dark theme detection is not implemented in webdev. If needed pls check the
	// implementation in frontends/qt/server/server.go
	return false
}

func main() {
	config.SetAppDir("appfolder.dev")

	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet coins")
	devservers := flag.Bool("devservers", true, "switch to dev servers")
	gapLimitsReceive := flag.Uint("gapLimitReceive", 0, "gap limit for receive addresses")
	gapLimitsChange := flag.Uint("gapLimitChange", 0, "gap limit for change addresses")
	simulatorPort := flag.Int("simulatorPort", 15423, "port for the BitBox02 simulator")
	useSimulator := flag.Bool("simulator", false, "use the BitBox02 simulator")
	flag.Parse()

	var gapLimits *btctypes.GapLimits
	if *gapLimitsReceive != 0 || *gapLimitsChange != 0 {
		gapLimits = &btctypes.GapLimits{
			Receive: uint16(*gapLimitsReceive),
			Change:  uint16(*gapLimitsChange),
		}
	}

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
	log.WithField("goos", runtime.GOOS).
		WithField("goarch", runtime.GOARCH).
		WithField("version", versioninfo.Version).
		Info("environment")

	// since we are in dev-mode, we can drop the authorization token
	connectionData := backendHandlers.NewConnectionData(-1, "")
	newBackend, err := backendPkg.NewBackend(
		arguments.NewArguments(
			config.AppDir(),
			!*mainnet,
			*regtest,
			*devservers,
			gapLimits,
		),
		webdevEnvironment{})
	if err != nil {
		log.WithField("error", err).Panic(err)
	}
	backend = newBackend
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	log.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)

	if *useSimulator {
		simulator.Init(*simulatorPort)
	}

	if err := http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router); err != nil {
		log.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Fatal("Failed to listen for HTTP")
	}
}
