package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
)

func main() {
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	flag.Parse()

	var backendInterface backend.Interface
	if *mainnet {
		backendInterface = backend.NewBackend()
	} else {
		backendInterface = backend.NewBackendForTesting()
	}

	handlers := backendHandlers.NewHandlers(backendInterface, 8082)
	err := http.ListenAndServe("0.0.0.0:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
