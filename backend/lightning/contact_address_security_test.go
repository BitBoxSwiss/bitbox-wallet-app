// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/stretchr/testify/require"
)

// TestContactAddressLookupBlocksLocalTargets prevents direct and proxied requests to private, mapped, and Unicode-normalized local addresses.
func TestContactAddressLookupBlocksLocalTargets(t *testing.T) {
	for _, host := range []string{
		"127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254",
		"0.0.0.0", "100.64.0.1", "198.18.0.1", "192.0.2.1", "[::1]", "[::ffff:127.0.0.1]", "[fc00::1]", "127.0.0.１",
	} {
		t.Run(host, func(t *testing.T) {
			for _, useProxy := range []bool{false, true} {
				called := false
				lightning := &Lightning{
					socksProxy: socksproxy.NewSocksProxy(useProxy, ""),
					httpClient: &http.Client{Transport: contactAddressTransport(func(*http.Request) (*http.Response, error) {
						called = true
						return nil, errors.New("unexpected local request")
					})},
				}
				require.NoError(t, lightning.validateContactAddress("nora@"+host))
				require.False(t, called, "proxy enabled: %t", useProxy)
			}
		})
	}
}

// TestSaveContactBlockedLookup preserves silent saving when network policy prevents checking an address.
func TestSaveContactBlockedLookup(t *testing.T) {
	lightning := newTestLightning(t, nil)
	called := false
	lightning.httpClient.Transport = contactAddressTransport(func(*http.Request) (*http.Response, error) {
		called = true
		return nil, errors.New("unexpected local request")
	})
	contact, err := lightning.SaveContact(Contact{Address: "nora@127.0.0.1"})
	require.NoError(t, err)
	require.False(t, called)
	list, err := lightning.Contacts().List("")
	require.NoError(t, err)
	require.Equal(t, []Contact{*contact}, list.Contacts)
}

// TestContactAddressLookupRedirectPolicy saves contacts after any redirect response without contacting its destination or interpreting its error body.
func TestContactAddressLookupRedirectPolicy(t *testing.T) {
	for _, test := range []struct {
		name   string
		target string
		proxy  bool
		status int
	}{
		{name: "public destination", target: "https://recipient.example/pay", status: http.StatusFound},
		{name: "private destination", target: "https://127.0.0.1/pay", status: http.StatusTemporaryRedirect},
		{name: "proxied onion destination", target: "http://recipient.onion/pay", proxy: true, status: http.StatusPermanentRedirect},
		{name: "no destination", status: http.StatusNotModified},
	} {
		t.Run(test.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			lightning.socksProxy = socksproxy.NewSocksProxy(test.proxy, "127.0.0.1:9050")
			requests := 0
			lightning.httpClient.Transport = contactAddressTransport(func(request *http.Request) (*http.Response, error) {
				requests++
				require.Equal(t, "https://example.com/.well-known/lnurlp/nora", request.URL.String())
				return &http.Response{
					StatusCode: test.status,
					Header:     http.Header{"Location": []string{test.target}},
					Body:       io.NopCloser(strings.NewReader(`{"status":"ERROR"}`)),
				}, nil
			})
			contact, err := lightning.SaveContact(Contact{Address: "nora@example.com"})
			require.NoError(t, err)
			require.Equal(t, 1, requests)
			list, err := lightning.Contacts().List("")
			require.NoError(t, err)
			require.Equal(t, []Contact{*contact}, list.Contacts)
		})
	}
}

// TestContactAddressLookupOnionRequiresProxy prevents direct onion lookups while preserving configured SOCKS routing.
func TestContactAddressLookupOnionRequiresProxy(t *testing.T) {
	for _, useProxy := range []bool{false, true} {
		called := false
		lightning := &Lightning{
			socksProxy: socksproxy.NewSocksProxy(useProxy, "127.0.0.1:9050"),
			httpClient: &http.Client{Transport: contactAddressTransport(func(request *http.Request) (*http.Response, error) {
				called = true
				require.Equal(t, "http://example.onion/.well-known/lnurlp/nora", request.URL.String())
				return &http.Response{StatusCode: http.StatusNotFound, Body: io.NopCloser(strings.NewReader(""))}, nil
			})},
		}
		err := lightning.validateContactAddress("nora@example.onion")
		if useProxy {
			require.ErrorIs(t, err, ErrContactAddressNotFound)
		} else {
			require.NoError(t, err)
		}
		require.Equal(t, useProxy, called)
	}
}

// TestContactAddressLookupLeavesSharedClientUntouched keeps redirect behavior and transport changes local to the lookup.
func TestContactAddressLookupLeavesSharedClientUntouched(t *testing.T) {
	redirects, requests := 0, 0
	transport := contactAddressTransport(func(*http.Request) (*http.Response, error) {
		requests++
		return &http.Response{
			StatusCode: http.StatusFound,
			Header:     http.Header{"Location": []string{"https://recipient.example/pay"}},
			Body:       io.NopCloser(strings.NewReader("")),
		}, nil
	})
	client := &http.Client{Transport: transport, Timeout: time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
		redirects++
		return http.ErrUseLastResponse
	}}
	lightning := &Lightning{httpClient: client}
	require.NoError(t, lightning.validateContactAddress("nora@example.com"))
	require.Zero(t, redirects)
	request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "https://example.com/pay", nil)
	require.NoError(t, err)
	response, err := client.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, 1, redirects)
	require.Equal(t, 2, requests)
	require.Equal(t, time.Second, client.Timeout)
}

// TestContactAddressLookupDeclinesInheritedProxy avoids both bypassing an inherited proxy and mutating its shared transport.
func TestContactAddressLookupDeclinesInheritedProxy(t *testing.T) {
	proxyURL, err := url.Parse("http://proxy.example:8080")
	require.NoError(t, err)
	for _, test := range []struct {
		name  string
		proxy *url.URL
		err   error
	}{
		{name: "proxy configured", proxy: proxyURL},
		{name: "proxy selection failed", err: errors.New("proxy unavailable")},
	} {
		t.Run(test.name, func(t *testing.T) {
			proxyCalls, dialCalls := 0, 0
			dialError := errors.New("unexpected connection")
			transport := &http.Transport{
				Proxy: func(*http.Request) (*url.URL, error) {
					proxyCalls++
					return test.proxy, test.err
				},
				DialContext: func(context.Context, string, string) (net.Conn, error) {
					dialCalls++
					return nil, dialError
				},
			}
			defer transport.CloseIdleConnections()
			client := &http.Client{Transport: transport}
			lightning := &Lightning{httpClient: client}
			require.NoError(t, lightning.validateContactAddress("nora@example.com"))
			require.Equal(t, 1, proxyCalls)
			require.Zero(t, dialCalls)
			require.Same(t, transport, client.Transport)
			_, err := transport.DialContext(context.Background(), "tcp", "unused")
			require.ErrorIs(t, err, dialError)
			require.Equal(t, 1, dialCalls)
		})
	}
}

// TestContactAddressPublicIP blocks local, reserved, and mapped destinations without rejecting ordinary public IPs.
func TestContactAddressPublicIP(t *testing.T) {
	for _, ip := range []string{
		"127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.0.2.1", "198.18.0.1",
		"224.0.0.1", "240.0.0.1", "::1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::",
		"::ffff:127.0.0.1", "64:ff9b::127.0.0.1",
	} {
		require.False(t, isPublicContactAddressIP(netip.MustParseAddr(ip)), ip)
	}
	for _, ip := range []string{"8.8.8.8", "::ffff:8.8.8.8", "2001:4860:4860::8888", "2606:4700:4700::1111", "64:ff9b::808:808"} {
		require.True(t, isPublicContactAddressIP(netip.MustParseAddr(ip)), ip)
	}
}

// TestContactAddressLookupBlocksResolvedLoopback checks proxy policy once and blocks resolved local connections even with custom TLS dialers.
func TestContactAddressLookupBlocksResolvedLoopback(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		listener, err := net.Listen("tcp4", "127.0.0.1:0")
		require.NoError(t, err)
		t.Cleanup(func() { _ = listener.Close() })
		_, port, err := net.SplitHostPort(listener.Addr().String())
		require.NoError(t, err)
		accepted := make(chan error, 1)
		go func() {
			connection, err := listener.Accept()
			if connection != nil {
				_ = connection.Close()
			}
			accepted <- err
		}()
		proxyCalls, tlsDialCalls := 0, 0
		transport := &http.Transport{Proxy: func(*http.Request) (*url.URL, error) {
			proxyCalls++
			return nil, nil
		}}
		dialTLS := func(network, address string) (net.Conn, error) {
			tlsDialCalls++
			return (&net.Dialer{Timeout: time.Second}).DialContext(context.Background(), network, address)
		}
		if legacy {
			transport.DialTLS = dialTLS //nolint:staticcheck // Verify that a legacy TLS dialer cannot bypass the guard.
		} else {
			transport.DialTLSContext = func(_ context.Context, network, address string) (net.Conn, error) {
				return dialTLS(network, address)
			}
		}
		client := &http.Client{Transport: transport}
		lightning := &Lightning{httpClient: client}
		require.NoError(t, lightning.validateContactAddress("nora@localhost:"+port))
		_ = listener.Close()
		require.Error(t, <-accepted)
		require.Equal(t, 1, proxyCalls)
		require.Zero(t, tlsDialCalls)
		require.Same(t, transport, client.Transport)
		require.NotNil(t, transport.Proxy)
	}
}
