// SPDX-License-Identifier: Apache-2.0

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
