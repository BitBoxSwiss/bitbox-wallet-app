// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchWidgetData(t *testing.T) {
	now := time.Unix(1700000000, 0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		switch r.URL.Path {
		case "/coins/bitcoin/market_chart/range":
			assert.Equal(t, "chf", r.URL.Query().Get("vs_currency"))
			assert.Equal(t, strconv.FormatInt(now.Add(-24*time.Hour).Unix(), 10), r.URL.Query().Get("from"))
			assert.Equal(t, strconv.FormatInt(now.Unix(), 10), r.URL.Query().Get("to"))
			fmt.Fprint(w, `{"prices":[[1,100],[2,0],[3,-1],[4],[5,110]]}`)
		case "/simple/price":
			assert.Equal(t, "bitcoin", r.URL.Query().Get("ids"))
			assert.Equal(t, "chf", r.URL.Query().Get("vs_currencies"))
			fmt.Fprint(w, `{"bitcoin":{"chf":125}}`)
		default:
			t.Errorf("unexpected endpoint: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	data, err := fetchWidgetData(t.Context(), server.Client(), server.URL, "tbtc", "CHF", now)
	require.NoError(t, err)
	assert.Equal(t, WidgetData{CoinCode: "btc", Currency: "CHF", Price: 125, Change24h: 25,
		ChartPrices: []float64{100, 110, 125}}, data)
}

func TestFetchWidgetDataFailures(t *testing.T) {
	for _, test := range []struct {
		name      string
		chart     string
		quote     string
		chartCode int
		delay     bool
		wantError bool
	}{
		{name: "missing current price", chart: `{"prices":[[1,100],[2,90]]}`, quote: `{}`},
		{name: "invalid current price", chart: `{"prices":[[1,100],[2,90]]}`, quote: `{"bitcoin":{"usd":0}}`},
		{name: "current price timeout", chart: `{"prices":[[1,100],[2,90]]}`, delay: true},
		{name: "short chart", chart: `{"prices":[[1,100]]}`, wantError: true},
		{name: "invalid JSON", chart: `not-json`, wantError: true},
		{name: "server error", chartCode: http.StatusServiceUnavailable, wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/simple/price" {
					if test.delay {
						<-r.Context().Done()
						return
					}
					fmt.Fprint(w, test.quote)
					return
				}
				if test.chartCode != 0 {
					w.WriteHeader(test.chartCode)
				}
				fmt.Fprint(w, test.chart)
			}))
			defer server.Close()
			data, err := fetchWidgetData(t.Context(), server.Client(), server.URL, "btc", "USD", time.Now())
			if test.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, float64(90), data.Price)
			assert.Equal(t, float64(-10), data.Change24h)
			assert.Equal(t, []float64{100, 90}, data.ChartPrices)
		})
	}
}
