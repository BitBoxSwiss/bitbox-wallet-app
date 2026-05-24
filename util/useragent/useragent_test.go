// SPDX-License-Identifier: Apache-2.0

package useragent

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestString(t *testing.T) {
	require.Equal(t, "BitBoxApp/1.2.3 (linux)", String("1.2.3", "linux"))
}

func TestIsOwnedHost(t *testing.T) {
	tests := []struct {
		name string
		host string
		want bool
	}{
		{name: "shiftcrypto io", host: "swapkit.shiftcrypto.io", want: true},
		{name: "shiftcrypto dev", host: "bitboxapp.shiftcrypto.dev", want: true},
		{name: "bitbox swiss", host: "shop.bitbox.swiss", want: true},
		{name: "digitalbitbox", host: "digitalbitbox.com", want: true},
		{name: "case insensitive", host: "FEES1.SHIFTCRYPTO.IO", want: true},
		{name: "trailing dot", host: "fees1.shiftcrypto.io.", want: true},
		{name: "not suffix confusion", host: "evilshiftcrypto.io", want: false},
		{name: "moonpay", host: "api.moonpay.com", want: false},
		{name: "etherscan", host: "api.etherscan.io", want: false},
		{name: "coingecko", host: "api.coingecko.com", want: false},
		{name: "bitsurance", host: "get.bitsurance.eu", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, IsOwnedHost(test.host))
		})
	}
}

func TestTransportSetsUserAgentOnlyForOwnedHosts(t *testing.T) {
	const userAgent = "BitBoxApp/1.2.3 (linux)"
	seenUserAgents := map[string]string{}
	client := &http.Client{
		Transport: NewTransport(roundTripFunc(func(req *http.Request) (*http.Response, error) {
			seenUserAgents[req.URL.Hostname()] = req.Header.Get("User-Agent")
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("{}")),
				Header:     http.Header{},
			}, nil
		}), userAgent),
	}

	_, err := client.Get("https://swapkit.shiftcrypto.io/v3/quote")
	require.NoError(t, err)
	_, err = client.Get("https://api.moonpay.com/v1/regions")
	require.NoError(t, err)

	require.Equal(t, userAgent, seenUserAgents["swapkit.shiftcrypto.io"])
	require.Empty(t, seenUserAgents["api.moonpay.com"])
}

func TestTransportPreservesExistingUserAgent(t *testing.T) {
	client := &http.Client{
		Transport: NewTransport(roundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, "custom-agent", req.Header.Get("User-Agent"))
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("{}")),
				Header:     http.Header{},
			}, nil
		}), "BitBoxApp/1.2.3 (linux)"),
	}

	req, err := http.NewRequest(http.MethodGet, "https://fees1.shiftcrypto.io/api/v1/fees/recommended", nil)
	require.NoError(t, err)
	req.Header.Set("User-Agent", "custom-agent")

	_, err = client.Do(req)
	require.NoError(t, err)
}

func TestTransportUsesDefaultTransportWhenBaseIsNil(t *testing.T) {
	require.NotPanics(t, func() {
		require.NotNil(t, NewTransport(nil, "BitBoxApp/1.2.3 (linux)"))
	})
}
