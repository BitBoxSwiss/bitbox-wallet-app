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

package signing_test

import (
	"encoding/json"
	"testing"

	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/stretchr/testify/assert"
)

func TestKeypath(t *testing.T) {
	input := " m / 44' /0'/1' / 0 "
	absoluteKeypath, err := signing.NewAbsoluteKeypath(input)
	assert.NoError(t, err)
	assert.Equal(t, "m/44'/0'/1'/0", absoluteKeypath.Encode())

	bytes, err := json.Marshal(absoluteKeypath)
	assert.NoError(t, err)

	var decodedKeypath signing.AbsoluteKeypath
	err = json.Unmarshal(bytes, &decodedKeypath)
	if err != nil {
		panic(err)
	}
	assert.NoError(t, err)
	assert.Equal(t, absoluteKeypath.Encode(), decodedKeypath.Encode())
}
