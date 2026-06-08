// SPDX-License-Identifier: Apache-2.0

package bitbox

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBundledFirmware(t *testing.T) {
	binary, err := BundledFirmware()
	require.NoError(t, err)
	require.NotEmpty(t, binary)
}
