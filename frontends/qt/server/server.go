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
    int port;
    char* token;
} ConnectionData;
#endif
*/
import "C"

import (
	"fmt"
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
	"github.com/shiftdevices/godbb/util/freeport"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
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
	port, err := freeport.FreePort(log)
	if err != nil {
		log.WithField("error", err).Fatal("Failed to find free port")
	}
	cWrappedConnectionData := C.struct_ConnectionData{
		token: C.CString(token),
		port:  C.int(port),
	}
	log.WithField("port", port).Debug("Serve backend")

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

	go func() {
		server := &http.Server{
			Addr:    fmt.Sprintf("localhost:%d", port),
			Handler: handlers.ServeFrontendHandler(),
		}
		listener, err := net.Listen("tcp", server.Addr)
		if err != nil {
			log.WithFields(logrus.Fields{"error": err, "address": server.Addr}).Fatal("Failed to listen on address")
		}
		log.WithField("address", server.Addr).Debug("Listening")
		keepAliveListener := tcpKeepAliveListener{listener.(*net.TCPListener)}
		//tlsListener := tls.NewListener(keepAliveListener, server.TLSConfig)
		err = server.Serve(keepAliveListener)
		if err != nil {
			log.WithFields(logrus.Fields{"error": err, "address": server.Addr}).Fatal("Failed to establish TLS endpoint")
		}
	}()
	return cWrappedConnectionData
}

// Don't remove - needed for the C compilation.
func main() {
}
