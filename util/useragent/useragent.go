// SPDX-License-Identifier: Apache-2.0

package useragent

import (
	"runtime"
)

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
