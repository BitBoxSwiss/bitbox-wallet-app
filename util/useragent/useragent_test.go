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

func TestHostFromRuntime(t *testing.T) {
	switch runtime.GOOS {
	case "darwin":
		require.Equal(t, "mac", HostFromRuntime())
	case "windows":
		require.Equal(t, "win", HostFromRuntime())
	default:
		require.Equal(t, runtime.GOOS, HostFromRuntime())
	}
}
