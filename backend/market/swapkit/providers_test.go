// SPDX-License-Identifier: Apache-2.0

package swapkit

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/stretchr/testify/require"
)

func TestNewQuoteFromCoinCodeProviderAvailability(t *testing.T) {
	for _, quoteCase := range []struct {
		name   string
		status int
		body   string
	}{
		{"empty routes", http.StatusOK, `{"routes":[]}`},
		{"no routes error", http.StatusBadRequest, `{"error":"No route found","message":"No routes found"}`},
	} {
		t.Run(quoteCase.name, func(t *testing.T) {
			for _, testCase := range []struct {
				name      string
				body      string
				status    int
				err       error
				wantError errp.ErrorCode
			}{
				{name: "sell enabled but buy disabled", body: `[{"enabledChainIds":["bitcoin"]}]`, wantError: ErrNoRoutesFound},
				{name: "sell disabled but buy enabled", body: `[{"enabledChainIds":["1"]}]`, wantError: ErrProvidersUnavailable},
				{name: "all chains disabled", body: `[{"enabledChainIds":[]}]`, wantError: ErrProvidersUnavailable},
				{name: "all providers disabled", body: `[{"enabledChainIds":["1"]},{"enabledChainIds":[]}]`, wantError: ErrProvidersUnavailable},
				{name: "one provider enabled", body: `[{"enabledChainIds":[]},{"enabledChainIds":["bitcoin"]}]`, wantError: ErrNoRoutesFound},
				{name: "one provider unknown", body: `[{"enabledChainIds":[]},{}]`, wantError: ErrNoRoutesFound},
				{name: "no providers", body: `[]`, wantError: ErrNoRoutesFound},
				{name: "null providers", body: `null`, wantError: ErrNoRoutesFound},
				{name: "missing enabled list", body: `[{}]`, wantError: ErrNoRoutesFound},
				{name: "null enabled list", body: `[{"enabledChainIds":null}]`, wantError: ErrNoRoutesFound},
				{name: "malformed JSON", body: `[`, wantError: ErrNoRoutesFound},
				{name: "wrong response type", body: `{}`, wantError: ErrNoRoutesFound},
				{name: "wrong enabled list type", body: `[{"enabledChainIds":false}]`, wantError: ErrNoRoutesFound},
				{name: "HTTP failure", body: `unavailable`, status: http.StatusServiceUnavailable, wantError: ErrNoRoutesFound},
				{name: "network failure", err: io.ErrUnexpectedEOF, wantError: ErrNoRoutesFound},
				{name: "timeout", err: context.DeadlineExceeded, wantError: ErrNoRoutesFound},
			} {
				t.Run(testCase.name, func(t *testing.T) {
					var requestPaths []string
					httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
						requestPaths = append(requestPaths, req.URL.Path)
						if req.URL.Path == "/v3/quote" {
							return &http.Response{
								StatusCode: quoteCase.status,
								Body:       io.NopCloser(strings.NewReader(quoteCase.body)),
							}, nil
						}
						require.Equal(t, "https://swapkit.shiftcrypto.io/providers", req.URL.String())
						require.Equal(t, http.MethodGet, req.Method)
						require.Nil(t, req.Body)
						deadline, ok := req.Context().Deadline()
						require.True(t, ok)
						require.WithinDuration(t, time.Now().Add(providersLookupTimeout), deadline, time.Second)
						if testCase.err != nil {
							return nil, testCase.err
						}
						status := testCase.status
						if status == 0 {
							status = http.StatusOK
						}
						return &http.Response{
							StatusCode: status,
							Body:       io.NopCloser(strings.NewReader(testCase.body)),
						}, nil
					})}

					response, apiError := NewQuoteFromCoinCode(context.Background(), httpClient,
						newQuoteCoin(coinpkg.CodeBTC, "BTC"), newQuoteCoin(coinpkg.CodeETH, "ETH"), "1")
					require.Nil(t, response)
					require.NotNil(t, apiError)
					require.Equal(t, testCase.wantError, apiError.ErrorCode)
					require.Equal(t, &APIErrorData{SellCoin: "BTC", BuyCoin: "ETH"}, apiError.Data)
					if testCase.wantError == ErrProvidersUnavailable {
						require.Equal(t, "Providers unavailable", apiError.Message)
					} else {
						require.Equal(t, noRoutesFoundMessage, apiError.Message)
					}
					require.Equal(t, []string{"/v3/quote", "/providers"}, requestPaths)
				})
			}
		})
	}
}

func TestNoRoutesQuoteErrorProviderTimeout(t *testing.T) {
	for _, parentTimeout := range []time.Duration{2 * providersLookupTimeout, 20 * time.Millisecond} {
		t.Run(parentTimeout.String(), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), parentTimeout)
			defer cancel()
			parentDeadline, _ := ctx.Deadline()
			client := NewClient(&http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				deadline, ok := req.Context().Deadline()
				require.True(t, ok)
				if parentTimeout < providersLookupTimeout {
					require.Equal(t, parentDeadline, deadline)
				} else {
					require.WithinDuration(t, time.Now().Add(providersLookupTimeout), deadline, time.Second)
				}
				<-req.Context().Done()
				require.ErrorIs(t, req.Context().Err(), context.DeadlineExceeded)
				return nil, req.Context().Err()
			})})

			data := &APIErrorData{SellCoin: "BTC", BuyCoin: "ETH"}
			apiError := noRoutesQuoteError(ctx, client, "BTC.BTC", data)
			require.Equal(t, ErrNoRoutesFound, apiError.ErrorCode)
			require.Equal(t, noRoutesFoundMessage, apiError.Message)
			require.Equal(t, data, apiError.Data)
		})
	}
}

func TestNewQuoteFromCoinCodeProviderChainIDs(t *testing.T) {
	for _, testCase := range []struct {
		coinCode coinpkg.Code
		chainID  string
	}{
		{coinpkg.CodeBTC, "bitcoin"},
		{coinpkg.CodeTBTC, "bitcoin"},
		{coinpkg.CodeRBTC, "bitcoin"},
		{coinpkg.CodeLTC, "litecoin"},
		{coinpkg.CodeETH, "1"},
		{coinpkg.CodeSEPETH, "1"},
		{coinpkg.Code("eth-erc20-usdc"), "1"},
	} {
		t.Run(string(testCase.coinCode), func(t *testing.T) {
			for _, enabled := range []bool{true, false} {
				providerCalls := 0
				httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					body := `{"routes":[]}`
					if req.URL.Path == "/providers" {
						providerCalls++
						body = `[{"enabledChainIds":[]}]`
						if enabled {
							body = `[{"enabledChainIds":["` + testCase.chainID + `"]}]`
						}
					}
					return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
				})}
				response, apiError := NewQuoteFromCoinCode(context.Background(), httpClient,
					newQuoteCoin(testCase.coinCode, "SELL"), newQuoteCoin(coinpkg.CodeETH, "ETH"), "1")
				require.Nil(t, response)
				require.NotNil(t, apiError)
				wantError := ErrProvidersUnavailable
				if enabled {
					wantError = ErrNoRoutesFound
				}
				require.Equal(t, wantError, apiError.ErrorCode)
				require.Equal(t, 1, providerCalls)
			}
		})
	}
}

func TestNewQuoteFromCoinCodeOtherErrorsSkipProviders(t *testing.T) {
	for _, body := range []string{
		`{"error":"invalidRequest","message":"Invalid amount"}`,
		`Internal server error`,
	} {
		t.Run(body, func(t *testing.T) {
			requests := 0
			httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				requests++
				require.Equal(t, "/v3/quote", req.URL.Path)
				return &http.Response{StatusCode: http.StatusBadRequest, Body: io.NopCloser(strings.NewReader(body))}, nil
			})}
			response, apiError := NewQuoteFromCoinCode(context.Background(), httpClient,
				newQuoteCoin(coinpkg.CodeBTC, "BTC"), newQuoteCoin(coinpkg.CodeETH, "ETH"), "1")
			require.Nil(t, response)
			require.NotNil(t, apiError)
			require.NotEqual(t, ErrProvidersUnavailable, apiError.ErrorCode)
			require.Equal(t, 1, requests)
		})
	}
}

func TestNoRoutesQuoteErrorUnknownChain(t *testing.T) {
	client := NewClient(&http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("unknown chains should not fetch providers")
		return nil, nil
	})})
	data := &APIErrorData{SellCoin: "UNKNOWN", BuyCoin: "BTC"}
	apiError := noRoutesQuoteError(context.Background(), client, "UNKNOWN.COIN", data)
	require.Equal(t, ErrNoRoutesFound, apiError.ErrorCode)
	require.Equal(t, data, apiError.Data)
}
