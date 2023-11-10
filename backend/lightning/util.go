// Copyright 2018 Shift Devices AG
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

package lightning

import (
	"net/url"
	"strconv"
)

// Get an int64 value from http request url params.
func getInt64(params url.Values, key string) (int64, error) {
	parsed, err := strconv.ParseInt(params.Get(key), 10, 64)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}

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

// Get an optional int64 value from http request url params.
func getOptionalInt64(params url.Values, key string) (*int64, error) {
	if params.Has(key) {
		parsed, err := strconv.ParseInt(params.Get(key), 10, 64)
		if err != nil {
			return nil, err
		}
		return &parsed, nil
	}
	return nil, nil
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
