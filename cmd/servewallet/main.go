package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"

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
	// Log to stderr during development.
	logging.Log.Out = os.Stderr

	log := logging.Log.WithGroup("servewallet")
	defer func(log *logrus.Entry) {
		// recover from all panics and log error before panicing again
		if r := recover(); r != nil {
			log.WithField("error", r).Error(r)
			panic(r)
		}
	}(log)
	log.Info("--------------- Started application --------------")
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet")
	flag.Parse()

	backendInterface, err := func() (backend.Interface, error) {
		if *mainnet {
			if *regtest {
				log.Fatal("can't use -regtest with -mainnet")
			}
			return backend.NewBackend()
		}
		return backend.NewBackendForTesting(*regtest)
	}()
	if err != nil {
		log.Fatal(err)
	}

	// since we are in dev-mode, we can drop the authorization token
	connectionData := backendHandlers.NewConnectionData(port, "")
	handlers := backendHandlers.NewHandlers(backendInterface, connectionData)
	log.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)
	err = http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router)
	if err != nil {
		log.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Error("Failed to listen for HTTP")
	}
}
