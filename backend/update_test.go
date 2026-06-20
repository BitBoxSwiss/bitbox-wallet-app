// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	"github.com/stretchr/testify/require"
)

func TestNewUpdateRequestSetsUserAgent(t *testing.T) {
	backend := &Backend{environment: environment{}}

	request, err := backend.newUpdateRequest()

	require.NoError(t, err)
	require.Equal(t, updateFileURL, request.URL.String())
	require.Equal(t, "BitBoxApp/"+versioninfo.Version.String()+" (linux)", request.Header.Get("User-Agent"))
}
