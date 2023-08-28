package backend

import (
	"net/http"

	"github.com/gorilla/mux"
)

// HandlersMiddleware is a router interface to allow other handlers to use this middlware
type ApiRouterHandler = func(string, func(*http.Request) (interface{}, error)) *mux.Route
type ApiRouterNoErrorHandler = func(string, func(*http.Request) interface{}) *mux.Route

type HandlersMiddleware interface {
	GetApiRouter(subrouter *mux.Router) ApiRouterHandler
	GetApiRouterNoError(subrouter *mux.Router) ApiRouterNoErrorHandler
}
