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

package exchanges

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// APIGet performs a HTTP Get call to a given endpoint and unmarshal the result
// populating a given object.
func APIGet(httpClient *http.Client, endpoint string, result interface{}) error {
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return errp.WithStack(err)
	}

	res, err := httpClient.Do(req)
	if err != nil {
		return errp.WithStack(err)
	}
	defer res.Body.Close() //nolint:errcheck
	if res.StatusCode != http.StatusOK {
		return errp.Newf("%s - bad response code %d", endpoint, res.StatusCode)
	}
	const max = 81920
	responseBody, err := ioutil.ReadAll(io.LimitReader(res.Body, max+1))
	if err != nil {
		return errp.WithStack(err)
	}
	if len(responseBody) > max {
		return errp.Newf("%s - response too long (> %d bytes)", endpoint, max)
	}
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return errp.WithMessage(err,
			fmt.Sprintf("%s - could not parse response: %s", endpoint, string(responseBody)))
	}
	return nil
}
