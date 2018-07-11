package android

import (
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/arguments"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/random"
)

// Serve serves the godbb API for use in a mobile client.
func Serve() {
	log := logging.Get().WithGroup("android")
	token, err := random.HexString(16)
	if err != nil {
		log.WithError(err).Fatal("Failed to generate random string")
	}
	connectionData := backendHandlers.NewConnectionData(8082, token)
	backend := backend.NewBackend(arguments.NewArguments(".", false, false, false, false))
	handlers := backendHandlers.NewHandlers(backend, connectionData)
	err = http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
