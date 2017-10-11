package jsonp

import "encoding/json"

// MustMarshal encodes a value that cannot fail.
// Panics on an encoding error.
func MustMarshal(value interface{}) []byte {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return jsonBytes
}
