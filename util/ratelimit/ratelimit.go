// Copyright 2020 Shift Crypto AG
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

// Package ratelimit provides a util http.RoundTripper which rate limits its calls.
package ratelimit

import (
	"net/http"
	"time"
)

// FromTransport creates a new HTTP client wrapping base with RateLimitedHTTPTransport.
// The arguments are the same as in NewRateLimitedHTTPTransport.
func FromTransport(base http.RoundTripper, callInterval time.Duration) *http.Client {
	rt := NewRateLimitedHTTPTransport(base, callInterval)
	return &http.Client{Transport: rt}
}

// RateLimitedHTTPTransport is a http.RoundTripper that rate limits the requests, waiting at least
// `callInterval` between requests.
type RateLimitedHTTPTransport struct {
	base         http.RoundTripper
	rateCh       chan struct{}
	callInterval time.Duration
}

// NewRateLimitedHTTPTransport make a new rate limited http transport.
// If base is nil, http.DefaultTransport is used.
func NewRateLimitedHTTPTransport(
	base http.RoundTripper, callInterval time.Duration) *RateLimitedHTTPTransport {
	if base == nil {
		base = http.DefaultTransport
	}
	transport := &RateLimitedHTTPTransport{
		base:         base,
		rateCh:       make(chan struct{}),
		callInterval: callInterval,
	}
	go transport.tick()
	return transport
}

func (transport *RateLimitedHTTPTransport) tick() {
	transport.rateCh <- struct{}{}
	time.AfterFunc(transport.callInterval, transport.tick)
}

// RoundTrip implements http.RoundTripper, rate limiting the requests.
func (transport *RateLimitedHTTPTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	<-transport.rateCh
	return transport.base.RoundTrip(req)
}
