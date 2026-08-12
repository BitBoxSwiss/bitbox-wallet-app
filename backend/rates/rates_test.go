// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateLastNormalizesBitcoinUnitRates(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method, "request method")
		assert.Equal(t, "/simple/price", r.URL.Path, "URL path")
		assert.Contains(t, r.URL.Query().Get("ids"), "bitcoin", "ids query arg")
		assert.Contains(t, r.URL.Query().Get("vs_currencies"), "btc", "vs_currencies query arg")

		fmt.Fprintln(w, `{
			"bitcoin": {
				"usd": 123.45,
				"btc": 0.99904149
			},
			"wrapped-bitcoin": {
				"usd": 123.40,
				"btc": 0.998
			}
		}`)
	}))
	defer ts.Close()

	updater := NewRateUpdater(http.DefaultClient, t.TempDir())
	defer updater.Stop()
	updater.SetCoingeckoURL(ts.URL)

	updater.updateLast(t.Context())

	last := updater.LatestPrice()
	require.NotNil(t, last)
	require.Contains(t, last, BTC.String())
	require.Contains(t, last, SAT.String())
	require.Contains(t, last, "WBTC")

	assert.Equal(t, 1.0, last[BTC.String()][BTC.String()])
	assert.Equal(t, float64(unitSatoshi), last[BTC.String()][SAT.String()])
	assert.Equal(t, 1.0/unitSatoshi, last[SAT.String()][BTC.String()])
	assert.Equal(t, 1.0, last[SAT.String()][SAT.String()])
	assert.Equal(t, 1.0, last["TBTC"][BTC.String()])
	assert.Equal(t, 1.0, last["RBTC"][BTC.String()])

	assert.InDelta(t, 0.998, last["WBTC"][BTC.String()], 1e-12)
}
