// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type contactAddressTransport func(*http.Request) (*http.Response, error)

func (transport contactAddressTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

// TestContactAddressLookupMissingUser rejects every HTTP 404 response across providers without saving a contact.
func TestContactAddressLookupMissingUser(t *testing.T) {
	for _, test := range []struct {
		address string
		url     string
		body    string
	}{
		{address: "Toooooooom@bitbox.cash", url: "https://bitbox.cash/.well-known/lnurlp/toooooooom", body: `""`},
		{address: "hospitablebiology95123@cake.cash", url: "https://cake.cash/.well-known/lnurlp/hospitablebiology95123", body: `""`},
		{address: "missing@example.com", url: "https://example.com/.well-known/lnurlp/missing", body: `""`},
		{address: "empty@example.com", url: "https://example.com/.well-known/lnurlp/empty"},
		{address: "plain@example.com", url: "https://example.com/.well-known/lnurlp/plain", body: "Not found"},
		{address: "html@example.com", url: "https://example.com/.well-known/lnurlp/html", body: "<html>Not found</html>"},
		{address: "oversized@example.com", url: "https://example.com/.well-known/lnurlp/oversized", body: strings.Repeat("x", 64*1024+1)},
	} {
		t.Run(test.address, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			lightning.httpClient.Transport = contactAddressTransport(func(request *http.Request) (*http.Response, error) {
				require.Equal(t, test.url, request.URL.String())
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Body:       io.NopCloser(strings.NewReader(test.body)),
				}, nil
			})
			_, err := lightning.SaveContact(Contact{Address: test.address})
			require.ErrorIs(t, err, ErrContactAddressNotFound)
			list, err := lightning.Contacts().List("")
			require.NoError(t, err)
			require.Empty(t, list.Contacts)
		})
	}
}

// TestContactAddressLookupAllowsInconclusiveResponses saves contacts after connection failures or responses without a protocol error.
func TestContactAddressLookupAllowsInconclusiveResponses(t *testing.T) {
	for _, test := range []struct {
		name      string
		status    int
		body      string
		err       error
		readError bool
	}{
		{name: "payment details", status: http.StatusOK, body: `{"tag":"payRequest","callback":"https://example.com/pay","minSendable":1000,"maxSendable":100000}`},
		{name: "reason without error status", status: http.StatusOK, body: `{"reason":"user not found"}`},
		{name: "unrecognized status", status: http.StatusOK, body: `{"status":"UNKNOWN","reason":"user not found"}`},
		{name: "empty JSON success", status: http.StatusOK, body: `""`},
		{name: "plain bad request", status: http.StatusBadRequest, body: `Bad request`},
		{name: "empty JSON service unavailable", status: http.StatusServiceUnavailable, body: `""`},
		{name: "service unavailable status", status: http.StatusServiceUnavailable, body: `Service unavailable`},
		{name: "HTML server error", status: http.StatusInternalServerError, body: `<html>Internal server error</html>`},
		{name: "malformed JSON", status: http.StatusOK, body: `{"status":"ERROR",`},
		{name: "oversized response", status: http.StatusOK, body: `{"status":"ERROR","reason":"user not found","padding":"` + strings.Repeat("x", 64*1024) + `"}`},
		{name: "unreadable response", status: http.StatusOK, readError: true},
		{name: "network failure", err: errors.New("network is unreachable")},
		{name: "timeout", err: context.DeadlineExceeded},
	} {
		t.Run(test.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			lightning.httpClient.Transport = contactAddressTransport(func(*http.Request) (*http.Response, error) {
				if test.err != nil {
					return nil, test.err
				}
				body := io.NopCloser(strings.NewReader(test.body))
				if test.readError {
					body = &contactAddressUnreadableBody{}
				}
				return &http.Response{
					StatusCode: test.status,
					Body:       body,
				}, nil
			})
			contact, err := lightning.SaveContact(Contact{Address: "nora@example.com"})
			require.NoError(t, err)
			list, err := lightning.Contacts().List("")
			require.NoError(t, err)
			require.Equal(t, []Contact{*contact}, list.Contacts)
		})
	}
}

// TestContactAddressLookupProviderError rejects case-insensitive protocol errors regardless of HTTP status or reason wording.
func TestContactAddressLookupProviderError(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
		body   string
	}{
		{name: "database failure", status: http.StatusOK, body: `{"status":"ERROR","reason":"internal server error"}`},
		{name: "maintenance", status: http.StatusOK, body: `{"status":"ERROR","reason":"Service temporarily unavailable"}`},
		{name: "unknown recipient", status: http.StatusOK, body: `{"status":"ERROR","reason":"No account exists for this identifier"}`},
		{name: "lowercase status", status: http.StatusOK, body: `{"status":"error","reason":"Not found"}`},
		{name: "mixed-case status", status: http.StatusBadRequest, body: `{"status":"eRrOr"}`},
		{name: "server error", status: http.StatusInternalServerError, body: `{"status":"ERROR","reason":"internal server error"}`},
		{name: "service unavailable", status: http.StatusServiceUnavailable, body: `{"status":"ERROR","reason":"Try again later"}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			lightning := newTestLightning(t, nil)
			lightning.httpClient.Transport = contactAddressTransport(func(*http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: test.status,
					Body:       io.NopCloser(strings.NewReader(test.body)),
				}, nil
			})
			_, err := lightning.SaveContact(Contact{Address: "nora@bitbox.cash"})
			require.ErrorIs(t, err, ErrContactAddressNotFound)
			list, err := lightning.Contacts().List("")
			require.NoError(t, err)
			require.Empty(t, list.Contacts)
		})
	}
}

type contactAddressUnreadableBody struct {
	read bool
}

func (body *contactAddressUnreadableBody) Read([]byte) (int, error) {
	body.read = true
	return 0, io.ErrUnexpectedEOF
}

func (body *contactAddressUnreadableBody) Close() error {
	return nil
}

// TestContactAddressLookupNotFoundSkipsBody keeps an unreadable body from hiding an HTTP 404 rejection.
func TestContactAddressLookupNotFoundSkipsBody(t *testing.T) {
	body := &contactAddressUnreadableBody{}
	lightning := &Lightning{httpClient: &http.Client{Transport: contactAddressTransport(
		func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusNotFound, Body: body}, nil
		},
	)}}
	require.ErrorIs(t, lightning.validateContactAddress("nora@example.com"), ErrContactAddressNotFound)
	require.False(t, body.read)
}

// TestContactAddressLookupRequest matches SDK casing, escapes usernames, and bounds requests through the configured client.
func TestContactAddressLookupRequest(t *testing.T) {
	for _, test := range []struct {
		address string
		url     string
	}{
		{address: "NORA@EXAMPLE.COM", url: "https://example.com/.well-known/lnurlp/nora"},
		{address: "nora+tag?wallet@example.com", url: "https://example.com/.well-known/lnurlp/nora+tag%3Fwallet"},
		{address: "nora@example.onion", url: "http://example.onion/.well-known/lnurlp/nora"},
	} {
		t.Run(test.address, func(t *testing.T) {
			called := false
			lightning := &Lightning{httpClient: &http.Client{Transport: contactAddressTransport(
				func(request *http.Request) (*http.Response, error) {
					called = true
					require.Equal(t, http.MethodGet, request.Method)
					require.Equal(t, test.url, request.URL.String())
					require.Empty(t, request.URL.RawQuery)
					deadline, ok := request.Context().Deadline()
					require.True(t, ok)
					require.Positive(t, time.Until(deadline))
					require.LessOrEqual(t, time.Until(deadline), 3*time.Second)
					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(`{"tag":"payRequest"}`)),
					}, nil
				},
			)}}
			require.NoError(t, lightning.validateContactAddress(test.address))
			require.True(t, called)
		})
	}
}

// TestContactAddressLookupInvalidHost keeps URL punctuation in the domain from changing the request destination.
func TestContactAddressLookupInvalidHost(t *testing.T) {
	for _, domain := range []string{"example.com?query", "example.com/path", "example.com#fragment"} {
		t.Run(domain, func(t *testing.T) {
			called := false
			lightning := &Lightning{httpClient: &http.Client{Transport: contactAddressTransport(
				func(*http.Request) (*http.Response, error) {
					called = true
					return nil, errors.New("unexpected request")
				},
			)}}
			require.NoError(t, lightning.validateContactAddress("nora@"+domain))
			require.False(t, called)
		})
	}
}
