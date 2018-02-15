package main

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
)

func main() {
	handlers := backendHandlers.NewHandlers(backend.NewBackend(), 8082)
	err := http.ListenAndServe("0.0.0.0:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
