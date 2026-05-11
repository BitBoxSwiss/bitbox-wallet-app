// SPDX-License-Identifier: Apache-2.0

package useragent

import (
	"net/http"
	"runtime"
	"strings"
)

var ownedHostSuffixes = []string{
	".shiftcrypto.io",
	".shiftcrypto.dev",
	".bitbox.swiss",
}

// String returns the BitBoxApp user agent.
func String(version, host string) string {
	return "BitBoxApp/" + version + " (" + host + ")"
}

// HostFromRuntime returns the user agent host token for the current Go runtime.
func HostFromRuntime() string {
	switch runtime.GOOS {
	case "darwin":
		return "mac"
	case "windows":
		return "win"
	default:
		return runtime.GOOS
	}
}

// IsOwnedHost returns true if host belongs to BitBox/Shift infrastructure.
func IsOwnedHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "digitalbitbox.com" {
		return true
	}
	for _, suffix := range ownedHostSuffixes {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	return false
}

type transport struct {
	base      http.RoundTripper
	userAgent string
}

// NewTransport returns a transport that adds the user agent only to BitBox/Shift-owned hosts.
func NewTransport(base http.RoundTripper, userAgent string) http.RoundTripper {
	if base == nil {
		base = http.DefaultTransport
	}
	return &transport{
		base:      base,
		userAgent: userAgent,
	}
}

func (t *transport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Header.Get("User-Agent") != "" || !IsOwnedHost(req.URL.Hostname()) {
		return t.base.RoundTrip(req)
	}

	cloned := req.Clone(req.Context())
	cloned.Header = req.Header.Clone()
	cloned.Header.Set("User-Agent", t.userAgent)
	return t.base.RoundTrip(cloned)
}
