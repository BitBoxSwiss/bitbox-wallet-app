package dbbmobile

import (
	"log"
	"net/http"

	"github.com/shiftdevices/godbb/knot"
	"github.com/shiftdevices/godbb/knot/handlers"
)

func Serve() {
	handlers := handlers.NewHandlers(knot.NewKnot(), 8082)
	err := http.ListenAndServe("localhost:8082", handlers.Router)
	if err != nil {
		log.Fatal(err)
	}
}
