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
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/system"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

// testEnvironment implements backend.Environment
type testEnvironment struct {
}

// NotifyUser implements backend.Environment
func (testEnvironment) NotifyUser(text string) {
}

// DeviceInfos implements backend.Environment
func (testEnvironment) DeviceInfos() []usb.DeviceInfo {
	return usb.DeviceInfos()
}

// SystemOpen implements backend.Environment
func (testEnvironment) SystemOpen(url string) error {
	return system.Open(url)
}

// List all routes with `go test backend/handlers/handlers_test.go -v`.
func TestListRoutes(t *testing.T) {
	connectionData := handlers.NewConnectionData(8082, "")
	backend, err := backend.NewBackend(arguments.NewArguments(
		test.TstTempDir("bitbox-wallet-listroutes-"), false, false, false, false, false),
		testEnvironment{},
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
		fmt.Println()
		return nil
	})
	if err != nil {
		fmt.Println(err)
	}
}

func requestTester(request *http.Request, t *testing.T) *httptest.ResponseRecorder {
	connectionData := handlers.NewConnectionData(8082, "")
	backendInstance, err := backend.NewBackend(arguments.NewArguments(
		test.TstTempDir("test-tempdir-"), false, false, false, false, false),
		testEnvironment{},
	)
	require.NoError(t, err)
	handlers := handlers.NewHandlers(backendInstance, connectionData)

	rr := httptest.NewRecorder()
	handlers.Router.ServeHTTP(rr, request)
	return rr
}

func checkResponse(t *testing.T, response *httptest.ResponseRecorder, expectedResponse string) {
	require.Equal(t, response.Code, http.StatusOK)
	require.Equal(t, response.Body.String(), expectedResponse)
}

func TestConfigDefaultHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/config/default", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	require.Equal(t, rr.Code, http.StatusOK)
	req, err = http.NewRequest("POST", "/api/config", bytes.NewBuffer(rr.Body.Bytes()))
	require.NoError(t, err)
	rr = requestTester(req, t)
	require.Equal(t, rr.Code, http.StatusOK)
}

func TestNotifyHandler(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/notify-user", bytes.NewBuffer([]byte("{\"text\":\"test\"}")))
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "null\n")
}

func TestOpenHandler(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/open", bytes.NewBuffer([]byte("\"malformed\"")))
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "{\"error\":\"Blocked /open with url: malformed\"}\n")
}

func TestQRHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/qr", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "{\"error\":\"no data to encode\"}\n")
}

func TestTestingHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/testing", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "false\n")
}

func TestUpdateHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/update", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "null\n")
}

func TestVersionHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/version", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)

	require.Equal(t, rr.Code, http.StatusOK)
	if !regexp.MustCompile(`([0-9]+\.[0-9]+\.[0-9]+)`).Match(rr.Body.Bytes()) {
		t.Errorf("Get Version response body differes. Expected version string with *.*.* : Got %q", rr.Body.String())
	}
}

func TestAccountsHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/accounts", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "[]\n")
}

func TestAccountsStatusHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/accounts-status", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "\"uninitialized\"\n")
}

func TestAccountsSummaryHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/export-account-summary", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)

	require.Equal(t, rr.Code, http.StatusMethodNotAllowed)
}

func TestRatesHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/rates", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	require.Equal(t, rr.Code, http.StatusOK)
}

func TestDevicesRegisteredHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/devices/registered", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "{}\n")
}

func TestBitBoxBasesRegisteredHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/bitboxbases/registered", nil)
	require.NoError(t, err)
	rr := requestTester(req, t)
	checkResponse(t, rr, "null\n")
}
