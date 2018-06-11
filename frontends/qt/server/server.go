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

typedef struct ConnectionData {
    char* token;
} ConnectionData;
#endif
*/
import "C"

import (
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
	"github.com/shiftdevices/godbb/util/random"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/logging"
)

var theBackend *backend.Backend
var handlers *backendHandlers.Handlers
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

//export backendCall
func backendCall(s *C.char) *C.char {
	if handlers == nil {
		return C.CString("null")
	}
	query := map[string]string{}
	jsonp.MustUnmarshal([]byte(C.GoString(s)), &query)
	if query["method"] != "POST" && query["method"] != "GET" {
		panic(errp.Newf("method must be POST or GET, got: %s", query["method"]))
	}
	rec := httptest.NewRecorder()
	request, err := http.NewRequest(query["method"], "/api/"+query["endpoint"], strings.NewReader(query["body"]))
	if err != nil {
		panic(errp.WithStack(err))
	}
	request.Header.Set("Authorization", "Basic "+token)
	handlers.Router.ServeHTTP(rec, request)
	response := rec.Result()
	responseBytes, err := ioutil.ReadAll(response.Body)
	if err != nil {
		panic(errp.WithStack(err))
	}
	return C.CString(string(responseBytes))
}

//export serve
func serve(pushNotificationsCallback C.pushNotificationsCallback) C.struct_ConnectionData {
	log := logging.Log.WithGroup("server")
	log.Info("--------------- Started application --------------")
	var err error
	token, err = random.HexString(16)
	if err != nil {
		log.WithField("error", err).Fatal("Failed to generate random string")
	}
	cWrappedConnectionData := C.struct_ConnectionData{
		token: C.CString(token),
	}
	// the port is unused in the Qt app, as we bridge directly without a server.
	const port = -1
	connectionData := backendHandlers.NewConnectionData(port, token)
	productionArguments := backend.ProductionArguments()
	theBackend := backend.NewBackend(productionArguments)
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
