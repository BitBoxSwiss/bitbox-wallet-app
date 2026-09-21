// SPDX-License-Identifier: Apache-2.0

package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/handlers"
	"github.com/stretchr/testify/require"
)

func TestAmountResponses(t *testing.T) {
	back, err := backend.NewBackend(arguments.NewArguments(t.TempDir(), true, false, true, nil), &backendEnv{})
	require.NoError(t, err)
	defer back.Close()
	back.RatesUpdater().LatestPrice()["BTC"] = map[string]float64{"USD": 25000}
	h := handlers.NewHandlers(back, handlers.NewConnectionData(0, ""))

	for _, tc := range []struct {
		query, want string
	}{
		{"btc/parse-external-amount?amount=0.00000001", `{"success":true,"amount":"0.00000001"}`},
		{"btc/parse-external-amount?amount=invalid", `{"success":false,"amount":""}`},
		{"convert-from-fiat?from=USD&to=btc&amount=25", `{"success":true,"amount":"0.00100000"}`},
		{"convert-from-fiat?from=USD&to=btc&amount=invalid", `{"success":false,"errMsg":"invalid amount"}`},
		{"convert-from-fiat?from=USD&to=invalid&amount=invalid", `{"success":false,"errMsg":"internal error"}`},
		{"convert-from-fiat?from=missing&to=btc&amount=1", `{"success":true,"amount":"0.00000000"}`},
		{"convert-to-plain-fiat?from=btc&to=USD&amount=0.001", `{"success":true,"fiatAmount":"25.00"}`},
		{"convert-to-plain-fiat?from=btc&to=USD&amount=invalid", `{"success":false}`},
		{"convert-to-plain-fiat?from=invalid&to=USD&amount=1", `{"success":false}`},
		{"convert-to-plain-fiat?from=btc&to=missing&amount=1", `{"success":true,"fiatAmount":"0.00"}`},
	} {
		t.Run(tc.query, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			h.Router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/coins/"+tc.query, nil))
			require.Equal(t, http.StatusOK, recorder.Code)
			require.JSONEq(t, tc.want, recorder.Body.String())
		})
	}
}
