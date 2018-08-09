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

/*
#ifndef BACKEND_H
#define BACKEND_H
#include <string.h>
#include <stdint.h>

typedef void (*pushNotificationsCallback) (const char*);
static void pushNotify(pushNotificationsCallback f, const char* msg) {
    f(msg);
}

typedef void (*responseCallback) (int, const char*);
static void respond(responseCallback f, int queryID, const char* msg) {
    f(queryID, msg);
}

typedef struct ConnectionData {
    char* token;
} ConnectionData;
#endif
*/
// #cgo CFLAGS: -O2 -D_FORTIFY_SOURCE=2 -fstack-check -fstack-protector-all -fPIC -fPIE
import "C"

import (
	"bytes"
	"flag"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
)

var theBackend *backend.Backend
var handlers *backendHandlers.Handlers
var responseCallback C.responseCallback
var token string

// Copied and adapted from package http server.go.
//
// tcpKeepAliveListener sets TCP keep-alive timeouts on accepted
// connections. It's used by ListenAndServe and ListenAndServeTLS so
// dead TCP connections (e.g. closing laptop mid-download) eventually
// go away.
type tcpKeepAliveListener struct {
	*net.TCPListener
}

// accept enables TCP keep alive and sets the period to 3 minutes.
func (ln tcpKeepAliveListener) Accept() (net.Conn, error) {
	tc, err := ln.AcceptTCP()
	if err != nil {
		return nil, err
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(3 * time.Minute)
	return tc, nil
}

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

//export backendCall
func backendCall(queryID C.int, s *C.char) {
	if handlers == nil {
		return
	}
	query := map[string]string{}
	jsonp.MustUnmarshal([]byte(C.GoString(s)), &query)
	if query["method"] != "POST" && query["method"] != "GET" {
		panic(errp.Newf("method must be POST or GET, got: %s", query["method"]))
	}
	go func() {
		defer func() {
			// recover from all panics and log error before panicking again
			if r := recover(); r != nil {
				logging.Get().WithGroup("server").WithField("panic", true).Error("%v\n%s", r, string(debug.Stack()))
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
		C.respond(responseCallback, queryID, C.CString(string(responseBytes)))
	}()
}

// getAppFolder returns the production application folder.
func getAppFolder() string {
	var appFolder string
	switch runtime.GOOS {
	case "windows":
		appFolder = os.Getenv("APPDATA")
	case "darwin":
		// Usually /home/<User>/Library/Application Support
		appFolder = os.Getenv("HOME") + "/Library/Application Support"
	case "linux":
		if os.Getenv("XDG_CONFIG_HOME") != "" {
			// Usually /home/<User>/.config/
			appFolder = os.Getenv("XDG_CONFIG_HOME")
		} else {
			appFolder = filepath.Join(os.Getenv("HOME"), ".config")
		}
	}
	appFolder = path.Join(appFolder, "bitbox")
	logging.Get().WithGroup("arguments").Info("appFolder: ", appFolder)
	return appFolder
}

//export serve
func serve(pushNotificationsCallback C.pushNotificationsCallback, theResponseCallback C.responseCallback) C.struct_ConnectionData {
	responseCallback = theResponseCallback

	// workaround: this flag is parsed by qtwebengine, but flag.Parse() quits the app on
	// unrecognized flags
	_ = flag.Int("remote-debugging-port", 0, "")
	testnet := flag.Bool("testnet", false, "activate testnets")
	flag.Parse()
	log := logging.Get().WithGroup("server")
	log.Info("--------------- Started application --------------")
	log.WithField("goos", runtime.GOOS).WithField("goarch", runtime.GOARCH).Info("environment")
	var err error
	token, err = random.HexString(16)
	if err != nil {
		log.WithError(err).Fatal("Failed to generate random string")
	}
	cWrappedConnectionData := C.struct_ConnectionData{
		token: C.CString(token),
	}
	// the port is unused in the Qt app, as we bridge directly without a server.
	const port = -1
	connectionData := backendHandlers.NewConnectionData(port, token)
	theBackend := backend.NewBackend(arguments.NewArguments(
		getAppFolder(), *testnet, false, false, false))
	events := theBackend.Events()
	go func() {
		for {
			C.pushNotify(pushNotificationsCallback, C.CString(string(jsonp.MustMarshal(<-events))))
		}
	}()
	handlers = backendHandlers.NewHandlers(theBackend, connectionData)
	return cWrappedConnectionData
}

// Don't remove - needed for the C compilation.
func main() {
}
