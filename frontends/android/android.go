package android

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/random"
)

// Serve serves the godbb API for use in a mobile client.
func Serve() {
	logEntry := logging.Log.WithGroup("android")
	token, err := random.HexString(16)
	if err != nil {
		logEntry.WithField("error", err).Fatal("Failed to generate random string")
	}
	connectionData := backendHandlers.NewConnectionData(8082, token)
	handlers := backendHandlers.NewHandlers(backend.NewBackend(), connectionData)
	err = http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
