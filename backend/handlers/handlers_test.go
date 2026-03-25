// SPDX-License-Identifier: Apache-2.0

package handlers_test

import (
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/handlers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// backendEnv is a backend environment implementation for testing.
//
// TODO: Move this to the test pkg. Unfortunately, there's imports cycle:
//
//	$ go vet ./backend/...
//	import cycle not allowed in test
//	package github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb (test)
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/util/test
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb
//	import cycle not allowed in test
//	package github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox (test)
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/util/test
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb
//	        imports github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox
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
func (e *backendEnv) DetectDarkTheme() bool         { return false }
func (e *backendEnv) Auth()                         {}
func (e *backendEnv) OnAuthSettingChanged(bool)     {}
func (e *backendEnv) BluetoothConnect(string)       {}

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

func TestGetAccountsByKeystore(t *testing.T) {
	args := arguments.NewArguments(
		test.TstTempDir("getaccountsbykeystore"),
		true,  // testing
		false, // regtest
		true,  // devservers
		nil,   // gap limits
	)
	back, err := backend.NewBackend(args, &backendEnv{})
	require.NoError(t, err)
	defer back.Close()

	back.RegisterTestKeystore("1111")
	keystore1 := back.Keystore()
	require.NotNil(t, keystore1)
	rootFingerprint1, err := keystore1.RootFingerprint()
	require.NoError(t, err)
	require.NoError(t, back.SetWatchonly(rootFingerprint1, true))
	back.DeregisterKeystore()

	back.RegisterTestKeystore("2222")
	keystore2 := back.Keystore()
	require.NotNil(t, keystore2)
	rootFingerprint2, err := keystore2.RootFingerprint()
	require.NoError(t, err)

	require.NoError(t, back.Config().ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		keystoreConfig1, err := accountsConfig.LookupKeystore(rootFingerprint1)
		if err != nil {
			return err
		}
		keystoreConfig1.Name = "Beta"

		keystoreConfig2, err := accountsConfig.LookupKeystore(rootFingerprint2)
		if err != nil {
			return err
		}
		keystoreConfig2.Name = "Alpha"
		return nil
	}))
	back.ReinitializeAccounts()

	h := handlers.NewHandlers(back, handlers.NewConnectionData(0, ""))

	type groupedAccount struct {
		CoinCode string `json:"coinCode"`
		Keystore struct {
			Name            string `json:"name"`
			RootFingerprint string `json:"rootFingerprint"`
		} `json:"keystore"`
	}
	type groupedAccountsResponse struct {
		Keystore struct {
			Connected       bool   `json:"connected"`
			Name            string `json:"name"`
			RootFingerprint string `json:"rootFingerprint"`
		} `json:"keystore"`
		Accounts []groupedAccount `json:"accounts"`
	}

	r := httptest.NewRequest(http.MethodGet, "/api/accounts-by-keystore", nil)
	w := httptest.NewRecorder()
	h.Router.ServeHTTP(w, r)
	res := w.Result()
	require.Equal(t, http.StatusOK, res.StatusCode)

	var groupedAccounts []groupedAccountsResponse
	test.DecodeHandlerResponse(t, &groupedAccounts, res.Body)

	require.Len(t, groupedAccounts, 2)
	assert.Equal(t, "Alpha", groupedAccounts[0].Keystore.Name)
	assert.Equal(t, hex.EncodeToString(rootFingerprint2), groupedAccounts[0].Keystore.RootFingerprint)
	assert.True(t, groupedAccounts[0].Keystore.Connected)
	require.Len(t, groupedAccounts[0].Accounts, 3)
	assert.Equal(t, []string{"tbtc", "tltc", "sepeth"}, []string{
		groupedAccounts[0].Accounts[0].CoinCode,
		groupedAccounts[0].Accounts[1].CoinCode,
		groupedAccounts[0].Accounts[2].CoinCode,
	})
	assert.Equal(t, groupedAccounts[0].Keystore.RootFingerprint, groupedAccounts[0].Accounts[0].Keystore.RootFingerprint)

	assert.Equal(t, "Beta", groupedAccounts[1].Keystore.Name)
	assert.Equal(t, hex.EncodeToString(rootFingerprint1), groupedAccounts[1].Keystore.RootFingerprint)
	assert.False(t, groupedAccounts[1].Keystore.Connected)
	require.Len(t, groupedAccounts[1].Accounts, 3)
	assert.Equal(t, []string{"tbtc", "tltc", "sepeth"}, []string{
		groupedAccounts[1].Accounts[0].CoinCode,
		groupedAccounts[1].Accounts[1].CoinCode,
		groupedAccounts[1].Accounts[2].CoinCode,
	})
	assert.Equal(t, groupedAccounts[1].Keystore.RootFingerprint, groupedAccounts[1].Accounts[0].Keystore.RootFingerprint)
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
