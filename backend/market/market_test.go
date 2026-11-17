// SPDX-License-Identifier: Apache-2.0

package market

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func pocketRegionsClient(t *testing.T, regions ...string) *http.Client {
	t.Helper()

	pocketRegions := make([]PocketRegion, 0, len(regions))
	for _, region := range regions {
		pocketRegions = append(pocketRegions, PocketRegion{
			Code:    region,
			Country: region,
		})
	}
	body, err := json.Marshal(pocketRegions)
	require.NoError(t, err)

	return pocketResponseClient(t, http.StatusOK, string(body))
}

func pocketResponseClient(t *testing.T, statusCode int, body string) *http.Client {
	t.Helper()

	return &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, pocketAPILiveURL+"/availabilities", req.URL.String())
			return &http.Response{
				StatusCode: statusCode,
				Body:       io.NopCloser(strings.NewReader(body)),
			}, nil
		}),
	}
}

func failingPocketClient() *http.Client {
	return &http.Client{
		Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("pocket unavailable")
		}),
	}
}

func vendorNames(dealsLists []*DealsList) []string {
	names := make([]string, 0, len(dealsLists))
	for _, dealsList := range dealsLists {
		names = append(names, dealsList.VendorName)
	}
	return names
}

// Unsupported coins and successful availability responses excluding the region must still reject OTC offers.
func TestSpecialActionDealsOTCErrors(t *testing.T) {
	tests := []struct {
		name        string
		coinCode    coin.Code
		regionCode  string
		httpClient  *http.Client
		expectedErr error
	}{
		{
			name:        "coin unsupported by both vendors",
			coinCode:    coin.Code("doge"),
			regionCode:  "CH",
			expectedErr: ErrCoinNotSupported,
		},
		{
			name:        "region unsupported by both vendors for supported coin",
			coinCode:    coin.CodeBTC,
			regionCode:  "US",
			httpClient:  pocketRegionsClient(t, "CH"),
			expectedErr: ErrRegionNotSupported,
		},
		{
			name:        "btc direct supports coin but not region, pocket supports region but not coin",
			coinCode:    coin.CodeLTC,
			regionCode:  "US",
			httpClient:  pocketRegionsClient(t, "US"),
			expectedErr: ErrRegionNotSupported,
		},
		{
			name:        "pocket supports coin but not region, btc direct supports region but not coin",
			coinCode:    coin.CodeTBTC,
			regionCode:  "CH",
			httpClient:  pocketRegionsClient(t, "US"),
			expectedErr: ErrRegionNotSupported,
		},
		{
			name:        "pocket availability failure does not enable unsupported coin",
			coinCode:    coin.CodeLTC,
			regionCode:  "US",
			httpClient:  failingPocketClient(),
			expectedErr: ErrRegionNotSupported,
		},
		{
			name:        "successful empty availability response excludes pocket",
			coinCode:    coin.CodeBTC,
			regionCode:  "US",
			httpClient:  pocketRegionsClient(t),
			expectedErr: ErrRegionNotSupported,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deals, handled, err := specialActionDeals(tt.coinCode, tt.regionCode, OtcAction, tt.httpClient)
			require.True(t, handled)
			require.Nil(t, deals)
			require.Equal(t, tt.expectedErr, err)
		})
	}
}

// Pocket OTC stays available for supported coins when its availability lookup fails or no region is selected.
func TestSpecialActionDealsOTCDeals(t *testing.T) {
	tests := []struct {
		name          string
		coinCode      coin.Code
		regionCode    string
		httpClient    *http.Client
		expectedNames []string
	}{
		{
			name:          "btc direct only",
			coinCode:      coin.CodeLTC,
			regionCode:    "CH",
			expectedNames: []string{BTCDirectOTCName},
		},
		{
			name:          "pocket only",
			coinCode:      coin.CodeTBTC,
			regionCode:    "US",
			httpClient:    pocketRegionsClient(t, "US"),
			expectedNames: []string{PocketOTCName},
		},
		{
			name:          "both vendors",
			coinCode:      coin.CodeBTC,
			regionCode:    "CH",
			httpClient:    pocketRegionsClient(t, "CH"),
			expectedNames: []string{BTCDirectOTCName, PocketOTCName},
		},
		{
			name:          "availability failure allows pocket only coin in any region",
			coinCode:      coin.CodeTBTC,
			regionCode:    "US",
			httpClient:    failingPocketClient(),
			expectedNames: []string{PocketOTCName},
		},
		{
			name:          "availability failure keeps both vendors available",
			coinCode:      coin.CodeBTC,
			regionCode:    "CH",
			httpClient:    failingPocketClient(),
			expectedNames: []string{BTCDirectOTCName, PocketOTCName},
		},
		{
			name:          "HTTP 429 allows pocket in any region",
			coinCode:      coin.CodeBTC,
			regionCode:    "US",
			httpClient:    pocketResponseClient(t, http.StatusTooManyRequests, "<html>Vercel Security Checkpoint</html>"),
			expectedNames: []string{PocketOTCName},
		},
		{
			name:          "invalid availability JSON allows pocket in any region",
			coinCode:      coin.CodeBTC,
			regionCode:    "US",
			httpClient:    pocketResponseClient(t, http.StatusOK, "invalid JSON"),
			expectedNames: []string{PocketOTCName},
		},
		{
			name:          "unspecified region allows both vendors without an availability request",
			coinCode:      coin.CodeBTC,
			expectedNames: []string{BTCDirectOTCName, PocketOTCName},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deals, handled, err := specialActionDeals(tt.coinCode, tt.regionCode, OtcAction, tt.httpClient)
			require.True(t, handled)
			require.NoError(t, err)
			require.Equal(t, tt.expectedNames, vendorNames(deals))
		})
	}
}
