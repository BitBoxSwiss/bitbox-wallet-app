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
	"context"
	"net/http"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// FromTransport creates a new HTTP client wrapping base with RateLimitedHTTPTransport.
// The arguments are the same as in NewRateLimitedHTTPTransport.
func FromTransport(base http.RoundTripper, callInterval time.Duration) *http.Client {
	rt := NewRateLimitedHTTPTransport(base, callInterval)
	return &http.Client{Transport: rt}
}

// RateLimitedHTTPTransport is a http.RoundTripper that rate limits the requests,
// waiting at least callInterval between requests.
//
// It is suitable only for the requests without a deadline because the transport
// does not extend the timeout duration of a request's context while being blocked
// by the callInterval limit. In such cases, LimitedCall is a better choice.
type RateLimitedHTTPTransport struct {
	base        http.RoundTripper
	callLimiter *LimitedCall
}

// NewRateLimitedHTTPTransport make a new rate limited http transport.
// If base is nil, http.DefaultTransport is used.
func NewRateLimitedHTTPTransport(
	base http.RoundTripper, callInterval time.Duration) *RateLimitedHTTPTransport {
	if base == nil {
		base = http.DefaultTransport
	}
	return &RateLimitedHTTPTransport{
		base:        base,
		callLimiter: NewLimitedCall(callInterval),
	}
}

// RoundTrip implements http.RoundTripper, rate limiting the requests.
func (transport *RateLimitedHTTPTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	var callRes *http.Response
	callErr := transport.callLimiter.Call(req.Context(), req.URL.String(), func() error {
		res, err := transport.base.RoundTrip(req)
		callRes = res
		return err
	})
	return callRes, callErr
}

// LimitedCall allows to rate-limit recurring function calls.
type LimitedCall struct {
	tickInterval time.Duration
	tickCh       chan struct{}
	log          *logrus.Entry
}

// NewLimitedCall creates new LimitedCall which allows a function to be called
// at most once per the specified internval.
func NewLimitedCall(minInterval time.Duration) *LimitedCall {
	l := &LimitedCall{
		tickInterval: minInterval,
		tickCh:       make(chan struct{}),
		log:          logging.Get().WithGroup("ratelimit"),
	}
	go l.tick()
	return l
}

func (l *LimitedCall) tick() {
	l.tickCh <- struct{}{}
	time.AfterFunc(l.tickInterval, l.tick)
}

// Call blocks fn from being executed until at least minInterval, specified
// in NewLimitedCall, passed after the previous invocation or the context is done.
// It propagates the error returned by fn as is.
//
// The logAnnotate arg is the message logged together with the elapsed time
// of how long fn is blocked for, periodically.
func (l *LimitedCall) Call(ctx context.Context, logAnnotate string, fn func() error) error {
	logInterval := 5 * time.Second // avoid excessive logging
	if logInterval < l.tickInterval {
		logInterval = l.tickInterval
	}
	var elapsed time.Duration
	for {
		select {
		case <-l.tickCh:
			if elapsed > 0 {
				l.log.Printf("calling %s after %v", logAnnotate, elapsed)
			}
			return fn()
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(logInterval):
			elapsed += logInterval
			l.log.Printf("waiting to call %s for %v now", logAnnotate, elapsed)
		}
	}
}
