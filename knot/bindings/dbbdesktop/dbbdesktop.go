package main

import "C"

import (
	"fmt"
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/knot"
	"github.com/shiftdevices/godbb/knot/handlers"
	"github.com/shiftdevices/godbb/util/freeport"
)

//export serve
func serve() int {
	port, err := freeport.FreePort()
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Port:", port)
	handlers := handlers.NewHandlers(knot.NewKnot(), port)
	go func() {
		err := http.ListenAndServe(fmt.Sprintf("localhost:%d", port), handlers.Router)
		if err != nil {
			log.Fatal(err)
		}
	}()
	return port
}

func main() {
}
