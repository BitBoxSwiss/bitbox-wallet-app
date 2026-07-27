// SPDX-License-Identifier: Apache-2.0

package useragent

import (
	"runtime"
)

// String returns the BitBoxApp user agent.
func String(version, platform string) string {
	return "BitBoxApp/" + version + " (" + platform + ")"
}

// PlatformFromRuntime returns the user agent platform token for the current Go runtime.
func PlatformFromRuntime() string {
	switch runtime.GOOS {
	case "darwin":
		return "mac"
	case "windows":
		return "win"
	default:
		return runtime.GOOS
	}
}
