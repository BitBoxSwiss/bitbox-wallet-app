// SPDX-License-Identifier: Apache-2.0

package socksproxy

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	// Empty endpoint means default endpoint.
	require.NoError(t, NewSocksProxy(true, "").Validate())

	require.NoError(t, NewSocksProxy(true, "127.0.0.1:9050").Validate())
	require.Error(t, NewSocksProxy(true, "127.0.0.1:XXXX").Validate())
	require.Error(t, NewSocksProxy(true, "127.0.0.1:9050 ").Validate())
}

func TestGetHTTPClientUserAgent(t *testing.T) {
	const ua = "BitBoxApp/1.2.3 (linux)"

	socksProxy := NewSocksProxy(false, "").WithUserAgent(ua)
	client := socksProxy.httpClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, ua, req.Header.Get("User-Agent"))
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("{}")),
			Header:     http.Header{},
		}, nil
	}))

	_, err := client.Get("https://bitboxapp.shiftcrypto.io/banners.json")
	require.NoError(t, err)
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
