// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

type chainClientRoundTripFunc func(*http.Request) (*http.Response, error)

func (f chainClientRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestEtherscanChainClientProvider(t *testing.T) {
	var requestedChainID string
	httpClient := &http.Client{
		Transport: chainClientRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			requestedChainID = request.URL.Query().Get("chainId")
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"jsonrpc":"2.0","id":1,"result":"0x1"}`,
				)),
				Header: make(http.Header),
			}, nil
		}),
	}
	provider := NewEtherscanChainClientProvider(httpClient, rate.NewLimiter(rate.Inf, 1))

	gasPrice, err := provider(42161).SuggestGasPrice(context.Background())

	require.NoError(t, err)
	require.Equal(t, big.NewInt(1), gasPrice)
	require.Equal(t, "42161", requestedChainID)
}
