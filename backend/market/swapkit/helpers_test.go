// SPDX-License-Identifier: Apache-2.0

package swapkit

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestFormatAmount(t *testing.T) {
	t.Run("btc default mode keeps btc units", func(t *testing.T) {
		btcCoin := btc.NewCoin(
			coinpkg.CodeBTC,
			"Bitcoin",
			"BTC",
			coinpkg.BtcUnitDefault,
			&chaincfg.MainNetParams,
			t.TempDir(),
			nil,
			"",
			socksproxy.NewSocksProxy(false, ""),
		)

		formattedAmount, err := FormatAmount(btcCoin, "1.23456789")
		require.NoError(t, err)
		require.Equal(t, "1.23456789", formattedAmount)
	})

	t.Run("btc sat mode is normalized to btc units", func(t *testing.T) {
		btcCoin := btc.NewCoin(
			coinpkg.CodeBTC,
			"Bitcoin",
			"BTC",
			coinpkg.BtcUnitSats,
			&chaincfg.MainNetParams,
			t.TempDir(),
			nil,
			"",
			socksproxy.NewSocksProxy(false, ""),
		)

		formattedAmount, err := FormatAmount(btcCoin, "123456789")
		require.NoError(t, err)
		require.Equal(t, "1.23456789", formattedAmount)
	})

	t.Run("erc20 amounts are normalized without display formatting", func(t *testing.T) {
		usdtCoin := eth.NewCoin(
			nil,
			coinpkg.Code("eth-erc20-usdt"),
			"Tether USD",
			"USDT",
			"ETH",
			params.MainnetChainConfig,
			"",
			nil,
			erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6),
		)

		formattedAmount, err := FormatAmount(usdtCoin, "1.10")
		require.NoError(t, err)
		require.Equal(t, "1.1", formattedAmount)
	})
}

func TestNewQuoteFromCoinCodeUsesInjectedHTTPClient(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, http.MethodPost, req.Method)
			require.Equal(t, "https://swapkit.shiftcrypto.io/v3/quote", req.URL.String())
			require.Equal(t, "application/json", req.Header.Get("Content-Type"))

			bodyBytes, err := io.ReadAll(req.Body)
			require.NoError(t, err)

			var body QuoteRequest
			require.NoError(t, json.Unmarshal(bodyBytes, &body))
			require.Equal(t, "BTC.BTC", body.SellAsset)
			require.Equal(t, "ETH.ETH", body.BuyAsset)
			require.Equal(t, "1.23456789", body.SellAmount)
			require.Equal(t, []string{"NEAR"}, body.Providers)

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"routes":[{"providers":["NEAR"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"}]}`,
				)),
				Header: make(http.Header),
			}, nil
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		"btc",
		"eth",
		"1.23456789",
	)
	require.Nil(t, apiError)
	require.Len(t, response.Routes, 1)
	require.Equal(t, "1.23", response.Routes[0].ExpectedBuyAmount)
}

func TestNewSwapUsesInjectedHTTPClient(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, http.MethodPost, req.Method)
			require.Equal(t, "https://swapkit.shiftcrypto.io/v3/swap", req.URL.String())
			require.Equal(t, "application/json", req.Header.Get("Content-Type"))

			bodyBytes, err := io.ReadAll(req.Body)
			require.NoError(t, err)

			var body SwapRequest
			require.NoError(t, json.Unmarshal(bodyBytes, &body))
			require.Equal(t, "route-id", body.RouteID)
			require.Equal(t, "source-address", body.SourceAddress)
			require.Equal(t, "destination-address", body.DestinationAddress)
			require.True(t, body.DisableBalanceCheck)
			require.True(t, body.DisableEstimate)
			require.True(t, body.DisableBuildTx)

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"routeId":"route-id","sourceAddress":"source-address","destinationAddress":"destination-address","expectedBuyAmount":"9.87","swapId":"swap-id"}`,
				)),
				Header: make(http.Header),
			}, nil
		}),
	}

	response, apiError := NewSwap(
		context.Background(),
		httpClient,
		"btc",
		"eth",
		"1.23456789",
		"route-id",
		"source-address",
		"destination-address",
	)
	require.Nil(t, apiError)
	require.Equal(t, "swap-id", response.SwapID)
	require.Equal(t, "9.87", response.ExpectedBuyAmount)
}

func TestClientPostAppliesRequestTimeout(t *testing.T) {
	client := &Client{
		baseURL: "https://swapkit.shiftcrypto.io/v3",
		httpClient: &http.Client{
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				deadline, ok := req.Context().Deadline()
				require.True(t, ok)
				require.WithinDuration(t, time.Now().Add(20*time.Second), deadline, time.Second)

				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"routes":[]}`)),
					Header:     make(http.Header),
				}, nil
			}),
		},
	}

	var out QuoteResponse
	require.NoError(t, client.post(context.Background(), "/quote", &QuoteRequest{}, &out))
}
