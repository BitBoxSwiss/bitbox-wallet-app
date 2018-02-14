package android

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
)

// Serve serves the godbb API for use in a mobile client.
func Serve() {
	handlers := backend.NewHandlers(backend.NewBackend(), 8082)
	err := http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
