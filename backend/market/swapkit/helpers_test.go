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

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	coinMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

const (
	providersPath = "/providers"
	quotePath     = "/v3/quote"
)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newQuoteCoin(code coinpkg.Code, unit string) coinpkg.Coin {
	return &coinMocks.CoinMock{
		CodeFunc: func() coinpkg.Code {
			return code
		},
		UnitFunc: func(bool) string {
			return unit
		},
	}
}

func TestValidateSwapSellAmount(t *testing.T) {
	newAccount := func(available int64) accounts.Interface {
		return &accountMocks.InterfaceMock{
			BalanceFunc: func() (*accounts.Balance, error) {
				return accounts.NewBalance(coinpkg.NewAmountFromInt64(available), coinpkg.NewAmountFromInt64(0)), nil
			},
			CoinFunc: func() coinpkg.Coin {
				return &coinMocks.CoinMock{}
			},
		}
	}

	t.Run("returns insufficient funds error", func(t *testing.T) {
		err := ValidateSwapSellAmount(newAccount(1), coinpkg.NewAmountFromInt64(2))
		require.Error(t, err)
		require.Equal(t, accountErrors.ErrInsufficientFunds, errp.Cause(err))
	})

	t.Run("accepts sell amount within balance", func(t *testing.T) {
		err := ValidateSwapSellAmount(newAccount(2), coinpkg.NewAmountFromInt64(2))
		require.NoError(t, err)
	})
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
			require.Nil(t, body.Providers)

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"routes":[{"providers":["provider-a"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"}]}`,
				)),
				Header: make(http.Header),
			}, nil
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeBTC, "BTC"),
		newQuoteCoin(coinpkg.CodeETH, "ETH"),
		"1.23456789",
	)
	require.Nil(t, apiError)
	require.Len(t, response.Routes, 1)
	require.Equal(t, "1.23", response.Routes[0].ExpectedBuyAmount)
	require.Equal(t, []string{"provider-a"}, response.Routes[0].Providers)
}

func TestNewQuoteFromCoinCodeDoesNotFetchProvidersWhenRoutesFound(t *testing.T) {
	var requestPaths []string
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			requestPaths = append(requestPaths, req.URL.Path)

			switch req.URL.Path {
			case quotePath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(
						`{"routes":[{"providers":["provider-a"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"}]}`,
					)),
					Header: make(http.Header),
				}, nil
			case providersPath:
				require.FailNow(t, "providers should only be fetched when no routes are found")
				return nil, nil
			default:
				require.FailNow(t, "unexpected path", req.URL.Path)
				return nil, nil
			}
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeBTC, "BTC"),
		newQuoteCoin(coinpkg.CodeETH, "ETH"),
		"1.23456789",
	)
	require.Nil(t, apiError)
	require.NotNil(t, response)
	require.Equal(t, []string{quotePath}, requestPaths)
}

func TestNewQuoteFromCoinCodeMapsEmptyRoutesToNoRoutesFound(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case quotePath:
				bodyBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)

				var body QuoteRequest
				require.NoError(t, json.Unmarshal(bodyBytes, &body))
				require.Equal(t, "LTC.LTC", body.SellAsset)
				require.Equal(t, "BTC.BTC", body.BuyAsset)

				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"routes":[]}`)),
					Header:     make(http.Header),
				}, nil
			case providersPath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(
						`[{"name":"THORCHAIN","enabledChainIds":["bitcoin","litecoin"],"supportedActions":["swap"],"supportedChainIds":["bitcoin","litecoin"]}]`,
					)),
					Header: make(http.Header),
				}, nil
			default:
				require.FailNow(t, "unexpected path", req.URL.Path)
				return nil, nil
			}
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeLTC, "LTC"),
		newQuoteCoin(coinpkg.CodeBTC, "BTC"),
		"1.23456789",
	)
	require.Nil(t, response)
	require.NotNil(t, apiError)
	require.Equal(t, ErrNoRoutesFound, apiError.ErrorCode)
	require.Equal(t, noRoutesFoundMessage, apiError.Message)
	require.Equal(t, &APIErrorData{
		SellCoin: "LTC",
		BuyCoin:  "BTC",
	}, apiError.Data)
}

func TestNewQuoteFromCoinCodeMapsNoRouteAPIErrorToNoRoutesFound(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case quotePath:
				bodyBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)

				var body QuoteRequest
				require.NoError(t, json.Unmarshal(bodyBytes, &body))
				require.Equal(t, "ETH.ETH", body.SellAsset)
				require.Equal(t, "BTC.BTC", body.BuyAsset)

				return &http.Response{
					StatusCode: http.StatusBadRequest,
					Body: io.NopCloser(strings.NewReader(
						`{"error":"No route found","message":"No routes found for ETH.ETH to BTC.BTC"}`,
					)),
					Header: make(http.Header),
				}, nil
			case providersPath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(
						`[{"name":"THORCHAIN","enabledChainIds":["1","bitcoin"],"supportedActions":["swap"],"supportedChainIds":["1","bitcoin"]}]`,
					)),
					Header: make(http.Header),
				}, nil
			default:
				require.FailNow(t, "unexpected path", req.URL.Path)
				return nil, nil
			}
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeSEPETH, "SEPETH"),
		newQuoteCoin(coinpkg.CodeBTC, "BTC"),
		"1.23456789",
	)
	require.Nil(t, response)
	require.NotNil(t, apiError)
	require.Equal(t, ErrNoRoutesFound, apiError.ErrorCode)
	require.Equal(t, noRoutesFoundMessage, apiError.Message)
	require.Equal(t, &APIErrorData{
		SellCoin: "SEPETH",
		BuyCoin:  "BTC",
	}, apiError.Data)
}

func TestNewQuoteFromCoinCodeMapsUnavailableProvidersToProvidersUnavailable(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case quotePath:
				bodyBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)

				var body QuoteRequest
				require.NoError(t, json.Unmarshal(bodyBytes, &body))
				require.Equal(t, "ETH.ETH", body.SellAsset)
				require.Equal(t, "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", body.BuyAsset)

				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"routes":[]}`)),
					Header:     make(http.Header),
				}, nil
			case providersPath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(
						`[{"name":"UNISWAP_V2","enabledChainIds":["42161"],"supportedActions":["swap"],"supportedChainIds":["1","42161"]},{"name":"ONEINCH","enabledChainIds":["42161"],"supportedActions":["swap"],"supportedChainIds":["1","42161"]}]`,
					)),
					Header: make(http.Header),
				}, nil
			default:
				require.FailNow(t, "unexpected path", req.URL.Path)
				return nil, nil
			}
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeETH, "ETH"),
		newQuoteCoin(coinpkg.Code("eth-erc20-usdc"), "USDC"),
		"1.23456789",
	)
	require.Nil(t, response)
	require.NotNil(t, apiError)
	require.Equal(t, ErrProvidersUnavailable, apiError.ErrorCode)
	require.Equal(t, providersUnavailableMessage, apiError.Message)
	require.Equal(t, &APIErrorData{
		SellCoin: "ETH",
		BuyCoin:  "USDC",
	}, apiError.Data)
}

func TestNewQuoteFromCoinCodeMapsMixedProviderAvailabilityToNoRoutesFound(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case quotePath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"routes":[]}`)),
					Header:     make(http.Header),
				}, nil
			case providersPath:
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(
						`[{"name":"UNISWAP_V2","enabledChainIds":["42161"],"supportedActions":["swap"],"supportedChainIds":["1","42161"]},{"name":"ONEINCH","enabledChainIds":["1"],"supportedActions":["swap"],"supportedChainIds":["1"]}]`,
					)),
					Header: make(http.Header),
				}, nil
			default:
				require.FailNow(t, "unexpected path", req.URL.Path)
				return nil, nil
			}
		}),
	}

	response, apiError := NewQuoteFromCoinCode(
		context.Background(),
		httpClient,
		newQuoteCoin(coinpkg.CodeETH, "ETH"),
		newQuoteCoin(coinpkg.Code("eth-erc20-usdc"), "USDC"),
		"1.23456789",
	)
	require.Nil(t, response)
	require.NotNil(t, apiError)
	require.Equal(t, ErrNoRoutesFound, apiError.ErrorCode)
	require.Equal(t, noRoutesFoundMessage, apiError.Message)
	require.Equal(t, &APIErrorData{
		SellCoin: "ETH",
		BuyCoin:  "USDC",
	}, apiError.Data)
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

func TestNewQuoteFromCoinCodePreservesRoutesWithAnyProviderCount(t *testing.T) {
	testCases := []struct {
		name                  string
		responseBody          string
		expectedProviderLists [][]string
		expectedBuyAmounts    []string
	}{
		{
			name:                  "zero providers",
			responseBody:          `{"routes":[{"providers":[],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"}]}`,
			expectedProviderLists: [][]string{{}},
			expectedBuyAmounts:    []string{"1.23"},
		},
		{
			name:                  "multiple providers",
			responseBody:          `{"routes":[{"providers":["provider-a","provider-b"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"}]}`,
			expectedProviderLists: [][]string{{"provider-a", "provider-b"}},
			expectedBuyAmounts:    []string{"1.23"},
		},
		{
			name:                  "mixed single and multiple providers",
			responseBody:          `{"routes":[{"providers":["provider-a"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"},{"providers":["provider-b","provider-c"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"2.34"}]}`,
			expectedProviderLists: [][]string{{"provider-a"}, {"provider-b", "provider-c"}},
			expectedBuyAmounts:    []string{"1.23", "2.34"},
		},
		{
			name:                  "multiple valid routes are preserved",
			responseBody:          `{"routes":[{"providers":["provider-a"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"1.23"},{"providers":["provider-b"],"sellAsset":"BTC.BTC","buyAsset":"ETH.ETH","expectedBuyAmount":"2.34"}]}`,
			expectedProviderLists: [][]string{{"provider-a"}, {"provider-b"}},
			expectedBuyAmounts:    []string{"1.23", "2.34"},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			httpClient := &http.Client{
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(testCase.responseBody)),
						Header:     make(http.Header),
					}, nil
				}),
			}

			response, apiError := NewQuoteFromCoinCode(
				context.Background(),
				httpClient,
				newQuoteCoin(coinpkg.CodeBTC, "BTC"),
				newQuoteCoin(coinpkg.CodeETH, "ETH"),
				"1.23456789",
			)
			require.Nil(t, apiError)
			require.NotNil(t, response)
			require.Len(t, response.Routes, len(testCase.expectedProviderLists))
			for i, route := range response.Routes {
				require.Equal(t, testCase.expectedProviderLists[i], route.Providers)
				require.Equal(t, testCase.expectedBuyAmounts[i], route.ExpectedBuyAmount)
			}
		})
	}
}

func TestClientPostAppliesRequestTimeout(t *testing.T) {
	client := &Client{
		baseURL: "https://swapkit.shiftcrypto.io",
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
	require.NoError(t, client.post(context.Background(), quotePath, &QuoteRequest{}, &out))
}
