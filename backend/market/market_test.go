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

	return &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, pocketAPILiveURL+"/availabilities", req.URL.String())
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(string(body))),
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
			name:        "pocket availability failure returns region error for pocket only coin",
			coinCode:    coin.CodeTBTC,
			regionCode:  "US",
			httpClient:  failingPocketClient(),
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
