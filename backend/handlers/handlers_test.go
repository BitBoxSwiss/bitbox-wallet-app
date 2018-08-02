// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package handlers_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
)

// List all routes with `go test backend/handlers/handlers_test.go -v`.
func TestListRoutes(t *testing.T) {
	connectionData := handlers.NewConnectionData(8082, "")
	backend := backend.NewBackend(arguments.NewArguments(
		test.TstTempDir("godbb-listroutes-"), false, false, false, false))
	handlers := handlers.NewHandlers(backend, connectionData)
	err := handlers.Router.Walk(func(route *mux.Route, router *mux.Router, ancestors []*mux.Route) error {
		pathTemplate, err := route.GetPathTemplate()
		if err != nil {
			return err
		}
		methods, err := route.GetMethods()
		if err != nil {
			return err
		}
		if len(methods) == 0 {
			fmt.Println()
		}
		fmt.Print(pathTemplate)
		if len(methods) > 0 {
			fmt.Print(" (" + strings.Join(methods, ",") + ")")
		}
		/* The following methods are only available in a newer version of mux: */
		// queriesTemplates, err := route.GetQueriesTemplates()
		// if err == nil {
		// 	   fmt.Println("Queries templates:", strings.Join(queriesTemplates, ","))
		// }
		// queriesRegexps, err := route.GetQueriesRegexp()
		// if err == nil {
		// 	   fmt.Println("Queries regexps:", strings.Join(queriesRegexps, ","))
		// }
		fmt.Println()
		return nil
	})
	if err != nil {
		fmt.Println(err)
	}
}
