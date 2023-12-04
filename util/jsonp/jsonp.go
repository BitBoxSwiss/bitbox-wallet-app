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

package jsonp

import (
	"encoding/hex"
	"encoding/json"
)

// MustMarshal encodes a value that cannot fail. Panics on an encoding error.
func MustMarshal(value interface{}) []byte {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return jsonBytes
}

// MustUnmarshal decodes json that cannot fail. Panics on a decoding error.
func MustUnmarshal(jsonBytes []byte, value interface{}) {
	if err := json.Unmarshal(jsonBytes, value); err != nil {
		panic(err)
	}
}

// HexBytes is a helper type to serialize/deserialize bytes as hex in JSON.
type HexBytes []byte

// MarshalJSON implements json.Marshaler.
func (h HexBytes) MarshalJSON() ([]byte, error) {
	return json.Marshal(hex.EncodeToString(h))
}

// UnmarshalJSON implements json.Unmarshaler.
func (h *HexBytes) UnmarshalJSON(data []byte) error {
	var hexStr string
	if err := json.Unmarshal(data, &hexStr); err != nil {
		return err
	}
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return err
	}
	*h = bytes
	return nil
}
