// SPDX-License-Identifier: Apache-2.0

package util

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
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
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
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

// TruncateString truncates `s` to size `size` if too long.
func TruncateString(s string, size int) string {
	if len(s) > size {
		return s[:size]
	}
	return s
}

func formatAddress(s string) string {
	const groupSize = 4

	if len(s) == 0 {
		return s
	}

	result := make([]byte, 0, len(s)+len(s)/groupSize)
	for i := 0; i < len(s); i++ {
		if i > 0 && i%groupSize == 0 {
			result = append(result, ' ')
		}
		result = append(result, s[i])
	}
	return string(result)
}

func formatETHAddress(s string) string {
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		if len(s) <= 2 {
			return s
		}
		return s[:2] + " " + formatAddress(s[2:])
	}
	return formatAddress(s)
}

// FormatAddress formats an address-like string for display based on the coin code.
func FormatAddress(code coinpkg.Code, s string) string {
	if code == coinpkg.CodeETH || code == coinpkg.CodeSEPETH || strings.HasPrefix(string(code), "eth-erc20-") {
		return formatETHAddress(s)
	}
	return formatAddress(s)
}
