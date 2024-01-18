// Copyright 2022 Shift Crypto AG
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

package util

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// APIGet performs a HTTP Get call to a given endpoint and unmarshal the result populating a given object.
// Input params:
// - `httpClient` which is used to perform the call
// - `endpoint` the url for the endpoint to fetch
// - `apikey` if not empty it is used as X-API-KEY header value
// - `maxSize` indicates the max expected response size. If it exceeds the function returns an error
// - `result` object that should be used to unmarshal the response body
// Returns the error code (if available) and possibly an error.
func APIGet(httpClient *http.Client, endpoint string, apiKey string, maxSize int64, result interface{}) (int, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, errp.WithStack(err)
	}

	if len(apiKey) > 0 {
		req.Header.Add("X-API-KEY", apiKey)
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return 0, errp.WithStack(err)
	}
	defer res.Body.Close() //nolint:errcheck
	if res.StatusCode != http.StatusOK {
		return res.StatusCode, errp.Newf("%s - bad response code %d", endpoint, res.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(res.Body, maxSize+1))
	if err != nil {
		return res.StatusCode, errp.WithStack(err)
	}
	if len(responseBody) > int(maxSize) {
		return res.StatusCode, errp.Newf("%s - response too long (> %d bytes)", endpoint, maxSize)
	}
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return res.StatusCode, errp.WithMessage(err,
			fmt.Sprintf("%s - could not parse response: %s", endpoint, string(responseBody)))
	}
	return res.StatusCode, nil
}
