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

package handlers_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/gorilla/mux"
)

// backendEnv is a backend environment implementation for testing.
//
// TODO: Move this to the test pkg. Unfortunately, there's imports cycle:
//
//	$ go vet ./backend/...
//	import cycle not allowed in test
//	package github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/db/transactionsdb (test)
//	        imports github.com/digitalbitbox/bitbox-wallet-app/util/test
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/db/transactionsdb
//	import cycle not allowed in test
//	package github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox (test)
//	        imports github.com/digitalbitbox/bitbox-wallet-app/util/test
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb
//	        imports github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox
type backendEnv struct {
	Locale string // returned by NativeLocale
}

func (e *backendEnv) NotifyUser(string)             {}
func (e *backendEnv) SystemOpen(string) error       { return nil }
func (e *backendEnv) DeviceInfos() []usb.DeviceInfo { return nil }
func (e *backendEnv) UsingMobileData() bool         { return false }
func (e *backendEnv) NativeLocale() string          { return e.Locale }
func (e *backendEnv) GetSaveFilename(string) string { return "" }
func (e *backendEnv) SetDarkTheme(bool)             {}

func TestGetNativeLocale(t *testing.T) {
	const ptLocale = "pt"

	args := arguments.NewArguments(
		test.TstTempDir("getnativelocale"),
		true,  // testing
		false, // regtest
		true,  // devservers
		nil,   // gap limits
	)
	env := &backendEnv{Locale: ptLocale}
	back, err := backend.NewBackend(args, env)
	if err != nil {
		t.Fatal(err)
	}
	defer back.Close()

	h := handlers.NewHandlers(back, handlers.NewConnectionData(0, ""))
	r := httptest.NewRequest(http.MethodGet, "/api/native-locale", nil)
	w := httptest.NewRecorder()
	h.Router.ServeHTTP(w, r)
	res := w.Result()
	if res.StatusCode != http.StatusOK {
		t.Errorf("res.StatusCode = %d; want %d", res.StatusCode, http.StatusOK)
	}
	var locale string
	test.DecodeHandlerResponse(t, &locale, res.Body)
	if locale != ptLocale {
		t.Errorf("locale = %q; want %q", locale, ptLocale)
	}
}

// List all routes with `go test backend/handlers/handlers_test.go -v`.
func TestListRoutes(t *testing.T) {
	const skip = true
	if skip {
		t.Skip("manual listing of handlers")
	}
	connectionData := handlers.NewConnectionData(8082, "")
	backend, err := backend.NewBackend(arguments.NewArguments(
		test.TstTempDir("bitbox-wallet-listroutes-"),
		false,
		false,
		false,
		nil),
		nil,
	)
	if err != nil {
		fmt.Println(err)
	}
	handlers := handlers.NewHandlers(backend, connectionData)
	err = handlers.Router.Walk(func(route *mux.Route, router *mux.Router, ancestors []*mux.Route) error {
		pathTemplate, err := route.GetPathTemplate()
		if err != nil {
			return err
		}
		methods, err := route.GetMethods()
		if err != nil {
			return err
		}
		if len(methods) == 0 {
			fmt.Println()
		}
		fmt.Print(pathTemplate)
		if len(methods) > 0 {
			fmt.Print(" (" + strings.Join(methods, ",") + ")")
		}
		/* The following methods are only available in a newer version of mux: */
		// queriesTemplates, err := route.GetQueriesTemplates()
		// if err == nil {
		// 	   fmt.Println("Queries templates:", strings.Join(queriesTemplates, ","))
		// }
		// queriesRegexps, err := route.GetQueriesRegexp()
		// if err == nil {
		// 	   fmt.Println("Queries regexps:", strings.Join(queriesRegexps, ","))
		// }
		fmt.Println()
		return nil
	})
	if err != nil {
		fmt.Println(err)
	}
}
