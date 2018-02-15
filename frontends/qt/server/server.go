package server

import "C"

import (
	"fmt"
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/util/freeport"
)

// Serve lets C code start the backend.
func Serve() int {
	port, err := freeport.FreePort()
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Port:", port)
	handlers := backend.NewHandlers(backend.NewBackend(), port)
	go func() {
		err := http.ListenAndServe(fmt.Sprintf("localhost:%d", port), handlers.Router)
		if err != nil {
			log.Fatal(err)
		}
	}()
	return port
}
