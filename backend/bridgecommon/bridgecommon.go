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

// Package bridgecommon provides common util functions to bridge the backend to a native
// environment.
package bridgecommon

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bluetooth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/handlers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/random"
)

// NativeCommunication provides function to pass responses and push notifications to the native
// environment.
type NativeCommunication interface {
	Respond(queryID int, response string)
	PushNotify(msg string)
}

var (
	// mu guards all global* vars.
	mu                  sync.RWMutex
	globalBackend       *backend.Backend
	globalHandlers      *handlers.Handlers
	globalCommunication NativeCommunication

	globalToken string

	globalShutdown func()
)

type response struct {
	Body bytes.Buffer
}

func (r *response) Header() http.Header {
	// Not needed.
	return http.Header{}
}

func (r *response) Write(buf []byte) (int, error) {
	r.Body.Write(buf)
	return len(buf), nil
}

func (r *response) WriteHeader(int) {
	// Not needed.
}

// BackendCall bridges GET/POST calls (serverless, directly calling the backend handlers).
func BackendCall(queryID int, jsonQuery string) {
	mu.RLock()
	defer mu.RUnlock()

	if globalHandlers == nil {
		return
	}
	query := map[string]string{}
	jsonp.MustUnmarshal([]byte(jsonQuery), &query)
	if query["method"] != "POST" && query["method"] != "GET" {
		panic(errp.Newf("method must be POST or GET, got: %s", query["method"]))
	}
	go func(handlers *handlers.Handlers, communication NativeCommunication) {
		defer func() {
			// recover from all panics and log error before panicking again
			if r := recover(); r != nil {
				logging.Get().WithGroup("server").WithField("panic", true).Errorf("%v\n%s", r, string(debug.Stack()))
			}
		}()

		resp := &response{}
		request, err := http.NewRequest(query["method"], "/api/"+query["endpoint"], strings.NewReader(query["body"]))
		if err != nil {
			panic(errp.WithStack(err))
		}
		request.Header.Set("Authorization", "Basic "+globalToken)
		handlers.Router.ServeHTTP(resp, request)
		responseBytes := resp.Body.Bytes()
		communication.Respond(queryID, string(responseBytes))
	}(globalHandlers, globalCommunication)
}

// HandleURI handles an external URI click for registered protocols, e.g. 'aopp:?...' URIs. The
// schemes are registered and handled on each platform (e.g. .desktop entry on Linux, Info.plist on
// macOS, etc.). All platforms then call this function to handle the URI in the backend.
func HandleURI(uri string) {
	mu.RLock()
	defer mu.RUnlock()
	if globalBackend == nil {
		return
	}
	globalBackend.HandleURI(uri)
}

// TriggerAuth triggers an authentication request notification.
func TriggerAuth() {
	mu.Lock()
	defer mu.Unlock()
	if globalBackend == nil {
		return
	}
	globalBackend.TriggerAuth()
}

// CancelAuth triggers an authentication canceled notification.
func CancelAuth() {
	mu.Lock()
	defer mu.Unlock()
	if globalBackend == nil {
		return
	}
	globalBackend.CancelAuth()
}

// AuthResult triggers an authentication result notification
// on the base of the input value.
func AuthResult(ok bool) {
	mu.Lock()
	defer mu.Unlock()
	if globalBackend == nil {
		return
	}
	globalBackend.AuthResult(ok)
}

// UsingMobileDataChanged should be called when the network connnection changed.
func UsingMobileDataChanged() {
	mu.RLock()
	defer mu.RUnlock()

	if globalBackend == nil {
		return
	}
	globalBackend.Notify(observable.Event{
		Subject: "using-mobile-data",
		Action:  action.Reload,
	})
}

// ManualReconnect exposes the ManualReconnect backend method.
func ManualReconnect() {
	mu.RLock()
	defer mu.RUnlock()

	if globalBackend == nil {
		return
	}
	globalBackend.ManualReconnect()

}

// BackendEnvironment implements backend.Environment.
type BackendEnvironment struct {
	NotifyUserFunc      func(string)
	DeviceInfosFunc     func() []usb.DeviceInfo
	SystemOpenFunc      func(string) error
	UsingMobileDataFunc func() bool
	// NativeLocaleFunc is used by the backend to query native app layer for user
	// preferred UI language.
	NativeLocaleFunc         func() string
	GetSaveFilenameFunc      func(string) string
	SetDarkThemeFunc         func(bool)
	DetectDarkThemeFunc      func() bool
	AuthFunc                 func()
	OnAuthSettingChangedFunc func(bool)
	BluetoothConnectFunc     func(string)
}

// NotifyUser implements backend.Environment.
func (env *BackendEnvironment) NotifyUser(text string) {
	if env.NotifyUserFunc != nil {
		env.NotifyUserFunc(text)
	}
}

// DeviceInfos implements backend.Environment.
func (env *BackendEnvironment) DeviceInfos() []usb.DeviceInfo {
	if env.DeviceInfosFunc != nil {
		return env.DeviceInfosFunc()
	}
	return nil
}

// SystemOpen implements backend.Environment.
func (env *BackendEnvironment) SystemOpen(url string) error {
	if env.SystemOpenFunc != nil {
		return env.SystemOpenFunc(url)
	}
	return nil
}

// UsingMobileData implements backend.Environment.
func (env *BackendEnvironment) UsingMobileData() bool {
	if env.UsingMobileDataFunc != nil {
		return env.UsingMobileDataFunc()
	}
	return false
}

// NativeLocale implements backend.Environment.
func (env *BackendEnvironment) NativeLocale() string {
	if env.NativeLocaleFunc != nil {
		return env.NativeLocaleFunc()
	}
	return ""
}

// GetSaveFilename implements backend.Environment.
func (env *BackendEnvironment) GetSaveFilename(suggestedFilename string) string {
	if env.GetSaveFilenameFunc != nil {
		return env.GetSaveFilenameFunc(suggestedFilename)
	}
	return ""
}

// SetDarkTheme implements backend.Environment.
func (env *BackendEnvironment) SetDarkTheme(isDark bool) {
	if env.SetDarkThemeFunc != nil {
		env.SetDarkThemeFunc(isDark)
	}
}

// DetectDarkTheme implements backend.Environment.
func (env *BackendEnvironment) DetectDarkTheme() bool {
	if env.DetectDarkThemeFunc != nil {
		return env.DetectDarkThemeFunc()
	}
	return false
}

// Auth implements backend.Environment.
func (env *BackendEnvironment) Auth() {
	if env.AuthFunc != nil {
		env.AuthFunc()
	}
}

// OnAuthSettingChanged implements backend.Environment.
func (env *BackendEnvironment) OnAuthSettingChanged(enabled bool) {
	if env.OnAuthSettingChangedFunc != nil {
		env.OnAuthSettingChangedFunc(enabled)
	}
}

// BluetoothConnect implements backend.Environment.
func (env *BackendEnvironment) BluetoothConnect(identifier string) {
	if env.BluetoothConnectFunc != nil {
		env.BluetoothConnectFunc(identifier)
	}
}

// Serve serves the BitBox API for use in a native client.
func Serve(
	testnet bool,
	gapLimits *btctypes.GapLimits,
	communication NativeCommunication,
	backendEnvironment backend.Environment) {
	mu.Lock()
	defer mu.Unlock()

	if globalShutdown != nil {
		panic("already running; must call Shutdown()")
	}

	globalCommunication = communication
	log := logging.Get().WithGroup("server")
	log.Info("--------------- Started application --------------")
	log.WithField("goos", runtime.GOOS).
		WithField("goarch", runtime.GOARCH).
		WithField("version", backend.Version).
		Info("environment")

	var err error
	globalBackend, err = backend.NewBackend(
		arguments.NewArguments(
			config.AppDir(),
			testnet,
			false,
			false,
			gapLimits,
		),
		backendEnvironment)
	if err != nil {
		log.WithError(err).Fatal("Failed to create backend")
	}

	quitChan := make(chan struct{})
	globalShutdown = func() {
		close(quitChan)
		if err := globalBackend.Close(); err != nil {
			log.WithError(err).Error("backend.Close failed")
		}
		globalHandlers = nil
		globalBackend = nil
		globalShutdown = nil
	}

	globalToken = hex.EncodeToString(random.BytesOrPanic(16))

	// the port is unused, as we bridge directly without a server.
	globalHandlers = handlers.NewHandlers(globalBackend,
		handlers.NewConnectionData(-1, globalToken))

	events := globalHandlers.Events()
	go func() {
		for {
			select {
			case <-quitChan:
				return
			default:
				select {
				case <-quitChan:
					return
				case event := <-events:
					func() {
						mu.RLock()
						defer mu.RUnlock()
						globalCommunication.PushNotify(string(jsonp.MustMarshal(event)))
					}()
				}
			}
		}
	}()

}

// Shutdown is cleaning up after Serve. It is called when the application is closed or goes to
// sleep.
func Shutdown() {
	mu.Lock()
	defer mu.Unlock()

	log := logging.Get().WithGroup("server")
	if globalShutdown != nil {
		globalShutdown()
		log.Info("Shutdown called")
	} else {
		log.Info("Shutdown called, but backend not running")
	}
}

// UsbUpdate wraps backend.UsbUpdate.
func UsbUpdate() {
	mu.RLock()
	defer mu.RUnlock()
	if globalBackend == nil {
		return
	}
	globalBackend.UsbUpdate()
}

// BluetoothSetState wraps backend.Bluetooth().SetState.
// The json byte are parsed according to `bluetooth.State`.
func BluetoothSetState(jsonState string) error {
	mu.RLock()
	defer mu.RUnlock()
	if globalBackend == nil {
		return nil
	}
	var state bluetooth.State
	if err := json.Unmarshal([]byte(jsonState), &state); err != nil {
		return err
	}
	globalBackend.Bluetooth().SetState(&state)
	return nil
}
