// Copyright 2018 Shift Devices AG
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

package signing

import (
	"encoding/json"
	"testing"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestKeypath(t *testing.T) {
	input := " m / 44' /0'/1' / 0 "
	absoluteKeypath, err := NewAbsoluteKeypath(input)
	assert.NoError(t, err)
	assert.Equal(t, "m/44'/0'/1'/0", absoluteKeypath.Encode())

	bytes, err := json.Marshal(absoluteKeypath)
	assert.NoError(t, err)

	var decodedKeypath AbsoluteKeypath
	err = json.Unmarshal(bytes, &decodedKeypath)
	if err != nil {
		panic(err)
	}
	assert.NoError(t, err)
	assert.Equal(t, absoluteKeypath.Encode(), decodedKeypath.Encode())
}

func TestNewAbsoluteKeypathFromUint32(t *testing.T) {
	require.Equal(t, "m/", NewAbsoluteKeypathFromUint32().Encode())
	require.Equal(t, "m/1", NewAbsoluteKeypathFromUint32(1).Encode())
	require.Equal(t, "m/1'", NewAbsoluteKeypathFromUint32(1+hdkeychain.HardenedKeyStart).Encode())
	require.Equal(t,
		"m/84'/1'/0'/1/10",
		NewAbsoluteKeypathFromUint32(84+hdkeychain.HardenedKeyStart, 1+hdkeychain.HardenedKeyStart, hdkeychain.HardenedKeyStart, 1, 10).Encode())
}
