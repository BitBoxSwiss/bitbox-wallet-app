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
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	btctypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
)

// NativeCommunication provides function to pass responses and push notifications to the native
// environment.
type NativeCommunication interface {
	Respond(queryID int, response string)
	PushNotify(msg string)
}

var (
	handlers      *backendHandlers.Handlers
	communication NativeCommunication
	token         string

	shutdown func()
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
	if handlers == nil {
		return
	}
	query := map[string]string{}
	jsonp.MustUnmarshal([]byte(jsonQuery), &query)
	if query["method"] != "POST" && query["method"] != "GET" {
		panic(errp.Newf("method must be POST or GET, got: %s", query["method"]))
	}
	go func() {
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
		request.Header.Set("Authorization", "Basic "+token)
		handlers.Router.ServeHTTP(resp, request)
		responseBytes := resp.Body.Bytes()
		communication.Respond(queryID, string(responseBytes))
	}()
}

// BackendEnvironment implements backend.Environment.
type BackendEnvironment struct {
	NotifyUserFunc  func(string)
	DeviceInfosFunc func() []usb.DeviceInfo
	SystemOpenFunc  func(string) error
}

// NotifyUser implements backend.Environment
func (env *BackendEnvironment) NotifyUser(text string) {
	if env.NotifyUserFunc != nil {
		env.NotifyUserFunc(text)
	}
}

// DeviceInfos implements backend.Environment
func (env *BackendEnvironment) DeviceInfos() []usb.DeviceInfo {
	if env.DeviceInfosFunc != nil {
		return env.DeviceInfosFunc()
	}
	return nil
}

// SystemOpen implements backend.Environment
func (env *BackendEnvironment) SystemOpen(url string) error {
	if env.SystemOpenFunc != nil {
		return env.SystemOpenFunc(url)
	}
	return nil
}

// Serve serves the BitBox API for use in a native client.
func Serve(
	testnet bool,
	gapLimits *btctypes.GapLimits,
	theCommunication NativeCommunication,
	backendEnvironment backend.Environment) {
	if shutdown != nil {
		panic("already running; must call Shutdown()")
	}
	communication = theCommunication
	log := logging.Get().WithGroup("server")
	log.Info("--------------- Started application --------------")
	log.WithField("goos", runtime.GOOS).
		WithField("goarch", runtime.GOARCH).
		WithField("version", backend.Version).
		Info("environment")

	backend, err := backend.NewBackend(
		arguments.NewArguments(
			config.AppDir(),
			testnet,
			false,
			false,
			false,
			false,
			gapLimits,
		),
		backendEnvironment)
	if err != nil {
		log.WithError(err).Fatal("Failed to create backend")
	}

	quitChan := make(chan struct{})
	shutdown = func() {
		close(quitChan)
		if err := backend.Close(); err != nil {
			log.WithError(err).Error("backend.Close failed")
		}
		shutdown = nil
	}

	token = hex.EncodeToString(random.BytesOrPanic(16))

	events := backend.Events()
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
					communication.PushNotify(string(jsonp.MustMarshal(event)))
				}
			}
		}
	}()

	// the port is unused, as we bridge directly without a server.
	handlers = backendHandlers.NewHandlers(backend,
		backendHandlers.NewConnectionData(-1, token))

}

// Shutdown is cleaning up after Serve. It is called when the application is closed or goes to
// sleep.
func Shutdown() {
	log := logging.Get().WithGroup("server")
	if shutdown != nil {
		shutdown()
		log.Info("Shutdown called")
	} else {
		log.Info("Shutdown called, but backend not running")
	}
}
