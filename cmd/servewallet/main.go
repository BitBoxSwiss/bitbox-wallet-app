package main

import (
	"flag"
	"fmt"
	"net/http"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/arguments"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
)

const (
	port    = 8082
	address = "0.0.0.0"
)

func main() {
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet coins")
	multisig := flag.Bool("multisig", false, "use the app in multisig mode")
	devmode := flag.Bool("devmode", true, "switch to dev mode")
	flag.Parse()

	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
	log := logging.Get().WithGroup("servewallet")
	defer func(log *logrus.Entry) {
		// recover from all panics and log error before panicking again
		if r := recover(); r != nil {
			log.WithField("error", r).Error(r)
			panic(r)
		}
	}(log)
	log.Info("--------------- Started application --------------")
	// since we are in dev-mode, we can drop the authorization token
	connectionData := backendHandlers.NewConnectionData(-1, "")
	backend := backend.NewBackend(
		arguments.NewArguments(".", !*mainnet, *regtest, *multisig, *devmode))
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	log.WithFields(logrus.Fields{"address": address, "port": port}).Info("Listening for HTTP")
	fmt.Printf("Listening on: http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf("%s:%d", address, port), handlers.Router); err != nil {
		log.WithFields(logrus.Fields{"address": address, "port": port, "error": err.Error()}).Error("Failed to listen for HTTP")
	}
}
