package main

import "C"

import (
	"fmt"
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/freeport"
)

//export serve
func serve() int {
	port, err := freeport.FreePort()
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Port:", port)
	handlers := backendHandlers.NewHandlers(backend.NewBackend(), port)
	go func() {
		err := http.ListenAndServe(fmt.Sprintf("localhost:%d", port), handlers.Router)
		if err != nil {
			log.Fatal(err)
		}
	}()
	return port
}

// Don't remove - needed for the C compilation.
func main() {
}
