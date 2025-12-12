// SPDX-License-Identifier: Apache-2.0

package socksproxy

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	// Empty endpoint means default endpoint.
	require.NoError(t, NewSocksProxy(true, "").Validate())

	require.NoError(t, NewSocksProxy(true, "127.0.0.1:9050").Validate())
	require.Error(t, NewSocksProxy(true, "127.0.0.1:XXXX").Validate())
	require.Error(t, NewSocksProxy(true, "127.0.0.1:9050 ").Validate())
}
