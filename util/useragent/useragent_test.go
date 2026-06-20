// SPDX-License-Identifier: Apache-2.0

package useragent

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestString(t *testing.T) {
	require.Equal(t, "BitBoxApp/1.2.3 (linux)", String("1.2.3", "linux"))
}

func TestPlatformFromRuntime(t *testing.T) {
	switch runtime.GOOS {
	case "darwin":
		require.Equal(t, "mac", PlatformFromRuntime())
	case "windows":
		require.Equal(t, "win", PlatformFromRuntime())
	default:
		require.Equal(t, runtime.GOOS, PlatformFromRuntime())
	}
}
