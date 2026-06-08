// SPDX-License-Identifier: Apache-2.0

package socksproxy

import (
	"net"
	"net/http"
	"net/url"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/proxy"
)

// SocksProxy holds the proxy address and wether to use it.
type SocksProxy struct {
	useProxy         bool
	proxyAddress     string
	fullProxyAddress string
	log              *logrus.Entry
}

const defaultProxyAddress = "127.0.0.1:9050"

// NewSocksProxy returns a new socks proxy instance. If proxyAddress is the empty string, the default
// address '127.0.0.1:9050' will be used.
func NewSocksProxy(useProxy bool, proxyAddress string) SocksProxy {
	if proxyAddress == "" {
		proxyAddress = defaultProxyAddress
	}
	proxy := SocksProxy{
		useProxy:     useProxy,
		proxyAddress: proxyAddress,
		log:          logging.Get().WithGroup("Proxy"),
	}
	proxy.fullProxyAddress = "socks5://" + proxyAddress
	return proxy
}

// Validate validates the socks5 proxy endpoint.
// We check if we could instantiate a proxied http client.
// Currently, no actual connectivity checks as performed.
func (socksProxy SocksProxy) Validate() error {
	if !socksProxy.useProxy {
		return nil
	}
	tbProxyURL, err := url.Parse(socksProxy.fullProxyAddress)
	if err != nil {
		return err
	}
	_, err = proxy.FromURL(tbProxyURL, proxy.Direct)
	return err
}

// GetTCPProxyDialer returns a tcp connection. The connection is proxied, if useProxy is true.
func (socksProxy *SocksProxy) GetTCPProxyDialer() proxy.Dialer {
	if socksProxy.useProxy {
		// Create a proxy that uses Tor's SocksPort.
		dialer, err := proxy.SOCKS5("tcp", socksProxy.proxyAddress, nil, nil)
		if err != nil {
			// TODO: Remove this panic.
			socksProxy.log.WithError(err).Panic("Failed to create SOCKS5 TCP dialer")
		}
		return dialer
	}
	return &net.Dialer{}
}

// GetHTTPClient returns a http client. Requests made with this client are proxied, if useProxy is true.
func (socksProxy *SocksProxy) GetHTTPClient() (*http.Client, error) {
	if socksProxy.useProxy {
		// Create a transport that uses Tor Browser's SocksPort.
		tbProxyURL, err := url.Parse(socksProxy.fullProxyAddress)
		if err != nil {
			socksProxy.log.WithError(err).Error("Failed to parse proxy URL")
			return &http.Client{}, err
		}
		// Get a proxy Dialer that will create the connection on our
		// behalf via the SOCKS5 proxy.  Specify the authentication
		// and re-create the dialer/transport/client if tor's
		// IsolateSOCKSAuth is needed.
		tbDialer, err := proxy.FromURL(tbProxyURL, proxy.Direct)
		if err != nil {
			socksProxy.log.WithError(err).Error("Failed to obtain proxy dialer")
			return &http.Client{}, err
		}

		// Make a http.Transport that uses the proxy dialer, and a
		// http.Client that uses the transport.
		tbTransport := &http.Transport{Dial: tbDialer.Dial}
		client := &http.Client{Transport: tbTransport}
		return client, nil
	}
	return &http.Client{}, nil
}
