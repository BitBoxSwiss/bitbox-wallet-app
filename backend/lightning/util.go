// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"net/url"
	"strconv"
)

// Get an optional bool value from http request url params.
func getOptionalBool(params url.Values, key string) (*bool, error) {
	if params.Has(key) {
		parsed, err := strconv.ParseBool(params.Get(key))
		if err != nil {
			return nil, err
		}
		return &parsed, nil
	}
	return nil, nil
}

// Get an optional list from http request url params.
func getOptionalList(params url.Values, key string) *[]string {
	if params.Has(key) {
		parsed := params[key]
		return &parsed
	}
	return nil
}

// Get an optional uint32 value from http request url params.
func getOptionalUint32(params url.Values, key string) (*uint32, error) {
	if params.Has(key) {
		parsed, err := strconv.ParseInt(params.Get(key), 10, 32)
		if err != nil {
			return nil, err
		}
		value := uint32(parsed)
		return &value, nil
	}
	return nil, nil
}

// Get an optional uint64 value from http request url params.
func getOptionalUint64(params url.Values, key string) (*uint64, error) {
	if params.Has(key) {
		parsed, err := strconv.ParseInt(params.Get(key), 10, 64)
		if err != nil {
			return nil, err
		}
		value := uint64(parsed)
		return &value, nil
	}
	return nil, nil
}
