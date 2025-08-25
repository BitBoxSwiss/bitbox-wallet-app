// Copyright 2023 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
