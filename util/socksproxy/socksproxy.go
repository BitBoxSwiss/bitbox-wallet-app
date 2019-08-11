// Copyright 2019 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package socksproxy

import (
	"net"
	"net/http"
	"net/url"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/proxy"
)

// SocksProxy holds the proxy address and wether to use it
type SocksProxy struct {
	useProxy         bool
	proxyAddress     string
	fullProxyAddress string
	log              *logrus.Entry
}

// NewSocksProxy returns a new socks proxy instance
func NewSocksProxy(useProxy bool, proxyAddress string) SocksProxy {
	proxy := SocksProxy{
		useProxy:     useProxy,
		proxyAddress: proxyAddress,
		log:          logging.Get().WithGroup("Proxy"),
	}
	proxy.fullProxyAddress = "socks5://" + proxyAddress
	return proxy
}

// GetTCPProxyDialer returns a tcp connection. The connection is proxied, if useProxy is true.
func (socksProxy *SocksProxy) GetTCPProxyDialer() (proxy.Dialer, error) {
	if socksProxy.useProxy {
		socksProxy.log.Println("Using proxy connection")
		// Create a proxy that uses Tor's SocksPort.
		dialer, err := proxy.SOCKS5("tcp", socksProxy.proxyAddress, nil, nil)
		if err != nil {
			socksProxy.log.WithError(err).Error("Failed to create tcp connection over socks5 proxy")
			return nil, err
		}
		return dialer, nil
	}
	socksProxy.log.Println("Using an unproxied tcp client")
	return &net.Dialer{}, nil
}

// GetHTTPClient returns a http client. Requests made with this client are proxied, if useProxy is true.
func (socksProxy *SocksProxy) GetHTTPClient() (*http.Client, error) {
	if socksProxy.useProxy {
		// Create a transport that uses Tor Browser's SocksPort.
		socksProxy.log.Println("Creating new socksProxy http client")
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
	socksProxy.log.Println("Using an unproxied http connection")
	return &http.Client{}, nil
}
