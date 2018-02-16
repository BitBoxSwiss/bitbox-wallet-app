package android

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
)

// Serve serves the godbb API for use in a mobile client.
func Serve() {
	handlers := backendHandlers.NewHandlers(backend.NewBackend(), 8082)
	err := http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
