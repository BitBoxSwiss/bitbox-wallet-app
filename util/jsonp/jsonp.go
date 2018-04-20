package jsonp

import "encoding/json"

// MustMarshal encodes a value that cannot fail. Panics on an encoding error.
func MustMarshal(value interface{}) []byte {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return jsonBytes
}

// MustUnmarshal decodes json that that cannot fail. Panics on a decoding error.
func MustUnmarshal(jsonBytes []byte, value interface{}) {
	if err := json.Unmarshal(jsonBytes, value); err != nil {
		panic(err)
	}
}
