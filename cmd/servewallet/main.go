package main

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/knot"
	"github.com/shiftdevices/godbb/knot/handlers"
)

func main() {
	handlers := handlers.NewHandlers(knot.NewKnot(), 8082)
	err := http.ListenAndServe("0.0.0.0:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
