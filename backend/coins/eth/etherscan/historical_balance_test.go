// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func TestHistoricalBalanceAt(t *testing.T) {
	address := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	at := time.Date(2025, 1, 1, 23, 59, 59, 999999999, time.FixedZone("UTC+1", 3600))
	for _, amount := range []string{"0", "32000000000000000000"} {
		t.Run(amount, func(t *testing.T) {
			var actions []string
			client := newTestEtherScan(func(req *http.Request) *http.Response {
				params := formValues(t, req)
				require.Equal(t, "1", params.Get("chainId"))
				action := params.Get("action")
				actions = append(actions, action)
				switch action {
				case "getblocknobytime":
					require.Equal(t, "block", params.Get("module"))
					require.Equal(t, strconv.FormatInt(at.Unix(), 10), params.Get("timestamp"))
					require.Equal(t, "before", params.Get("closest"))
					return jsonRPCResponse(t, `{"status":"1","result":"21525890"}`)
				case "balancehistory":
					require.Equal(t, "account", params.Get("module"))
					require.Equal(t, address.Hex(), params.Get("address"))
					require.Equal(t, "21525890", params.Get("blockno"))
					return jsonRPCResponse(t, fmt.Sprintf(`{"status":"1","result":%q}`, amount))
				default:
					t.Fatalf("unexpected action: %s", action)
					return nil
				}
			})
			balance, err := client.HistoricalBalanceAt(context.Background(), address, at)
			require.NoError(t, err)
			expected, ok := new(big.Int).SetString(amount, 10)
			require.True(t, ok)
			require.Equal(t, expected, balance)
			require.Equal(t, []string{"getblocknobytime", "balancehistory"}, actions)
		})
	}
}

func TestHistoricalBalanceAtInvalidResponse(t *testing.T) {
	for _, test := range []struct {
		name   string
		action string
		body   string
		error  string
	}{
		{"block lookup failure", "getblocknobytime", `{"status":"0","result":"unavailable"}`, "could not get snapshot block"},
		{"missing block", "getblocknobytime", `{"status":"1"}`, "unexpected snapshot block"},
		{"invalid block", "getblocknobytime", `{"status":"1","result":"invalid"}`, "unexpected snapshot block"},
		{"negative block", "getblocknobytime", `{"status":"1","result":"-1"}`, "unexpected snapshot block"},
		{"balance lookup failure", "balancehistory", `{"status":"0","result":"unavailable"}`, "could not get snapshot balance"},
		{"missing balance", "balancehistory", `{"status":"1"}`, "unexpected snapshot balance"},
		{"invalid balance", "balancehistory", `{"status":"1","result":"invalid"}`, "unexpected snapshot balance"},
		{"negative balance", "balancehistory", `{"status":"1","result":"-1"}`, "unexpected snapshot balance"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var actions []string
			client := newTestEtherScan(func(req *http.Request) *http.Response {
				action := formValues(t, req).Get("action")
				actions = append(actions, action)
				if action == test.action {
					return jsonRPCResponse(t, test.body)
				}
				require.Equal(t, "getblocknobytime", action)
				return jsonRPCResponse(t, `{"status":"1","result":"21525890"}`)
			})
			balance, err := client.HistoricalBalanceAt(context.Background(), common.Address{}, time.Now())
			require.ErrorContains(t, err, test.error)
			require.Nil(t, balance)
			if test.action == "getblocknobytime" {
				require.Equal(t, []string{"getblocknobytime"}, actions)
			}
		})
	}
}
