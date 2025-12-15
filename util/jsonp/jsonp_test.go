// SPDX-License-Identifier: Apache-2.0

package jsonp

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHexBytesMarshalUnmarshal(t *testing.T) {
	original := HexBytes{0x1, 0x2, 0x3, 0x4}
	expectedJSON := "\"01020304\""

	// Test MarshalJSON
	marshaled, err := json.Marshal(original)
	require.NoError(t, err)
	assert.JSONEq(t, expectedJSON, string(marshaled))

	// Test UnmarshalJSON
	var unmarshaled HexBytes
	err = json.Unmarshal([]byte(expectedJSON), &unmarshaled)
	require.NoError(t, err)
	assert.Equal(t, original, unmarshaled)
}
