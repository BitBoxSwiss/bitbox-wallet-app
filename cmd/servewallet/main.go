package main

import (
	"flag"
	"fmt"
	"net/http"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
)

const (
	port    = 8082
	address = "0.0.0.0"
)

func main() {
	logEntry := logging.Log.WithGroup("servewallet")
	defer func(logEntry *logrus.Entry) {
		// recover from all panics and log error before panicing again
		if r := recover(); r != nil {
			logEntry.WithField("error", r).Error(r)
			panic(r)
		}
	}(logEntry)
	logEntry.Info("--------------- Started application --------------")
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	flag.Parse()

	var backendInterface backend.Interface
	if *mainnet {
		backendInterface = backend.NewBackend()
	} else {
		backendInterface = backend.NewBackendForTesting()
	}

	// since we are in dev-mode, we can drop the authorization token
	connectionData := backendHandlers.NewConnectionData(port, "")
	handlers := backendHandlers.NewHandlers(backendInterface, connectionData)
	logEntry.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)
	err := http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router)
	if err != nil {
		logEntry.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Error("Failed to listen for HTTP")
	}
}
