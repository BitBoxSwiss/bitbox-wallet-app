// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

type feeTargetsRoundTripFunc func(*http.Request) (*http.Response, error)

func (f feeTargetsRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

// TestFeeTargets preserves decimal Gwei precision and positive tips when an oracle price equals the base fee.
func TestFeeTargets(t *testing.T) {
	for _, test := range []struct {
		name   string
		prices [4]string // High, normal, low, and base fee, in Gwei.
		caps   [3]int64
		tips   [3]int64
	}{
		{
			name:   "integer prices",
			prices: [4]string{"5", "4", "3", "2"},
			caps:   [3]int64{5_000_000_000, 4_000_000_000, 3_000_000_000},
			tips:   [3]int64{3_000_000_000, 2_000_000_000, 1_000_000_000},
		},
		{
			name:   "fractional prices from oracle",
			prices: [4]string{"0.115092298", "0.104629362", "0.103629362", "0.103629362"},
			caps:   [3]int64{115_092_298, 104_629_362, 103_629_363},
			tips:   [3]int64{11_462_936, 1_000_000, 1},
		},
		{
			name:   "fractional base fee",
			prices: [4]string{"3", "2", "1", "0.123456789"},
			caps:   [3]int64{3_000_000_000, 2_000_000_000, 1_000_000_000},
			tips:   [3]int64{2_876_543_211, 1_876_543_211, 876_543_211},
		},
		{
			name:   "prices equal base fee",
			prices: [4]string{"1", "1", "1", "1"},
			caps:   [3]int64{1_000_000_001, 1_000_000_001, 1_000_000_001},
			tips:   [3]int64{1, 1, 1},
		},
		{
			name:   "wei precision and trailing zeros",
			prices: [4]string{"0.0000000030", "0.000000002", "0.000000001", "0"},
			caps:   [3]int64{3, 2, 1},
			tips:   [3]int64{3, 2, 1},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := NewEtherScan("1", &http.Client{
				Transport: feeTargetsRoundTripFunc(func(req *http.Request) (*http.Response, error) {
					require.Equal(t, "gastracker", req.URL.Query().Get("module"))
					require.Equal(t, "gasoracle", req.URL.Query().Get("action"))
					body := fmt.Sprintf(`{"status":"1","result":{"FastGasPrice":%q,"ProposeGasPrice":%q,"SafeGasPrice":%q,"suggestBaseFee":%q}}`,
						test.prices[0], test.prices[1], test.prices[2], test.prices[3])
					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(body)),
					}, nil
				}),
			}, rate.NewLimiter(rate.Inf, 1))
			targets, err := client.FeeTargets(t.Context())
			require.NoError(t, err)
			require.Len(t, targets, 3)
			for i, code := range []accounts.FeeTargetCode{
				accounts.FeeTargetCodeHigh, accounts.FeeTargetCodeNormal, accounts.FeeTargetCodeLow,
			} {
				require.Equal(t, code, targets[i].TargetCode)
				require.Equal(t, big.NewInt(test.caps[i]), targets[i].GasFeeCap)
				require.Equal(t, big.NewInt(test.tips[i]), targets[i].GasTipCap)
			}
		})
	}
}

// TestFeeTargetsRejectsInvalidFees keeps malformed or unusable oracle responses on the existing fallback path.
func TestFeeTargetsRejectsInvalidFees(t *testing.T) {
	for _, test := range []struct {
		name  string
		field string
		value string
	}{
		{name: "malformed price", field: "FastGasPrice", value: "invalid"},
		{name: "missing price", field: "ProposeGasPrice", value: ""},
		{name: "negative price", field: "SafeGasPrice", value: "-1"},
		{name: "negative base fee", field: "suggestBaseFee", value: "-1"},
		{name: "fractional wei price", field: "FastGasPrice", value: "3.0000000001"},
		{name: "fractional wei base fee", field: "suggestBaseFee", value: "0.0000000001"},
		{name: "rational price", field: "FastGasPrice", value: "6/2"},
		{name: "zero price", field: "SafeGasPrice", value: "0"},
		{name: "base exceeds price", field: "suggestBaseFee", value: "2"},
	} {
		t.Run(test.name, func(t *testing.T) {
			prices := map[string]string{
				"FastGasPrice": "3", "ProposeGasPrice": "2", "SafeGasPrice": "1", "suggestBaseFee": "0",
			}
			prices[test.field] = test.value
			body, err := json.Marshal(map[string]interface{}{"status": "1", "result": prices})
			require.NoError(t, err)
			client := NewEtherScan("1", &http.Client{
				Transport: feeTargetsRoundTripFunc(func(*http.Request) (*http.Response, error) {
					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(string(body))),
					}, nil
				}),
			}, rate.NewLimiter(rate.Inf, 1))
			targets, err := client.FeeTargets(t.Context())
			require.Error(t, err)
			require.Nil(t, targets)
		})
	}
}
