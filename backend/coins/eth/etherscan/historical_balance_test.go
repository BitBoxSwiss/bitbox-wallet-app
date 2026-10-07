// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

// Native and token snapshots use the historical endpoints and retain exact smallest-unit balances,
// including zero and amounts larger than a uint64, without applying token decimal conversion.
func TestHistoricalBalanceAt(t *testing.T) {
	address := common.HexToAddress("0xa29163852021BF4C139D03Dff59ae763AC73e84e")
	at := time.Date(2025, 1, 1, 23, 59, 59, 999999999, time.FixedZone("UTC+1", 3600))
	for _, asset := range []struct {
		name   string
		token  *erc20.Token
		action string
	}{
		{name: "native", action: "balancehistory"},
		{name: "USDT", token: erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6), action: "tokenbalancehistory"},
		{name: "DAI", token: erc20.NewToken("0x6b175474e89094c44da98b954eedeac495271d0f", 18), action: "tokenbalancehistory"},
	} {
		for _, amount := range []string{"0", "32000000000000000000", "123456789012345678901234567890123456789"} {
			t.Run(asset.name+"/"+amount, func(t *testing.T) {
				var actions []string
				client := newTestEtherScan(func(req *http.Request) *http.Response {
					params := formValues(t, req)
					require.Equal(t, "1", params.Get("chainId"))
					action := params.Get("action")
					actions = append(actions, action)
					if action == "getblocknobytime" {
						require.Equal(t, "block", params.Get("module"))
						require.Equal(t, strconv.FormatInt(at.Unix(), 10), params.Get("timestamp"))
						require.Equal(t, "before", params.Get("closest"))
						return jsonRPCResponse(t, `{"status":"1","result":"21525890"}`)
					}
					require.Equal(t, asset.action, action)
					require.Equal(t, "account", params.Get("module"))
					require.Equal(t, address.Hex(), params.Get("address"))
					require.Equal(t, "21525890", params.Get("blockno"))
					if asset.token == nil {
						require.Empty(t, params.Get("contractaddress"))
					} else {
						require.Equal(t, asset.token.ContractAddress().Hex(), params.Get("contractaddress"))
					}
					return jsonRPCResponse(t, fmt.Sprintf(`{"status":"1","result":%q}`, amount))
				})
				balance, err := client.HistoricalBalanceAt(context.Background(), address, at, asset.token)
				require.NoError(t, err)
				expected, ok := new(big.Int).SetString(amount, 10)
				require.True(t, ok)
				require.Equal(t, expected, balance)
				require.Equal(t, []string{"getblocknobytime", asset.action}, actions)
			})
		}
	}
}

// Native and token balances before the Frontier launch are zero without a provider lookup.
func TestHistoricalBalanceAtBeforeMainnetLaunch(t *testing.T) {
	launch := time.Date(2015, 7, 30, 15, 26, 13, 0, time.UTC)
	for _, at := range []time.Time{
		time.Date(2014, 12, 31, 23, 59, 59, 0, time.UTC),
		launch.Add(-time.Nanosecond),
	} {
		t.Run(at.Format(time.RFC3339Nano), func(t *testing.T) {
			client := newTestEtherScan(func(req *http.Request) *http.Response {
				t.Fatal("balances before the mainnet launch must not query the provider")
				return nil
			})

			for _, token := range []*erc20.Token{nil, erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6)} {
				balance, err := client.HistoricalBalanceAt(context.Background(), common.Address{}, at, token)
				require.NoError(t, err)
				require.Equal(t, big.NewInt(0), balance)
			}
		})
	}
}

// Snapshots at or after the launch still query block zero so genesis allocations are preserved.
func TestHistoricalBalanceAtMainnetLaunch(t *testing.T) {
	launch := time.Date(2015, 7, 30, 15, 26, 13, 0, time.UTC)
	for _, at := range []time.Time{launch, launch.Add(time.Nanosecond), launch.Add(time.Second)} {
		t.Run(at.Format(time.RFC3339Nano), func(t *testing.T) {
			var actions []string
			client := newTestEtherScan(func(req *http.Request) *http.Response {
				params := formValues(t, req)
				action := params.Get("action")
				actions = append(actions, action)
				if action == "getblocknobytime" {
					require.Equal(t, strconv.FormatInt(at.Unix(), 10), params.Get("timestamp"))
					return jsonRPCResponse(t, `{"status":"1","result":"0"}`)
				}
				require.Equal(t, "balancehistory", action)
				require.Equal(t, "0", params.Get("blockno"))
				return jsonRPCResponse(t, `{"status":"1","result":"1000000000000000000"}`)
			})

			balance, err := client.HistoricalBalanceAt(context.Background(), common.Address{}, at, nil)
			require.NoError(t, err)
			require.Equal(t, big.NewInt(1e18), balance)
			require.Equal(t, []string{"getblocknobytime", "balancehistory"}, actions)
		})
	}
}

// Before a token is deployed its historical balance is zero, including at mainnet block zero.
func TestHistoricalBalanceAtBeforeTokenDeployment(t *testing.T) {
	token := erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6)
	for _, block := range []string{"0", "1000000"} {
		t.Run(block, func(t *testing.T) {
			var actions []string
			client := newTestEtherScan(func(req *http.Request) *http.Response {
				params := formValues(t, req)
				action := params.Get("action")
				actions = append(actions, action)
				if action == "getblocknobytime" {
					return jsonRPCResponse(t, fmt.Sprintf(`{"status":"1","result":%q}`, block))
				}
				require.Equal(t, "tokenbalancehistory", action)
				require.Equal(t, token.ContractAddress().Hex(), params.Get("contractaddress"))
				require.Equal(t, block, params.Get("blockno"))
				return jsonRPCResponse(t, `{"status":"1","result":"0"}`)
			})

			balance, err := client.HistoricalBalanceAt(
				context.Background(), common.Address{}, time.Date(2015, 7, 30, 15, 26, 13, 0, time.UTC), token)
			require.NoError(t, err)
			require.Equal(t, big.NewInt(0), balance)
			require.Equal(t, []string{"getblocknobytime", "tokenbalancehistory"}, actions)
		})
	}
}

// Other chains must retain their provider's errors rather than applying Ethereum mainnet's launch.
func TestHistoricalBalanceAtBeforeMainnetLaunchOtherChain(t *testing.T) {
	var requests int
	client := newTestEtherScan(func(req *http.Request) *http.Response {
		requests++
		require.Equal(t, "11155111", formValues(t, req).Get("chainId"))
		return jsonRPCResponse(t, `{"status":"0","result":"unavailable"}`)
	})
	client.chainId = "11155111"

	balance, err := client.HistoricalBalanceAt(
		context.Background(), common.Address{}, time.Date(2014, 12, 31, 23, 59, 59, 0, time.UTC), nil)
	require.ErrorContains(t, err, "could not get snapshot block")
	require.Nil(t, balance)
	require.Equal(t, 1, requests)
}

// Native and token snapshots reject failed lookups and invalid values without falling back to history.
func TestHistoricalBalanceAtInvalidResponse(t *testing.T) {
	for _, test := range []struct {
		name   string
		action string
		body   string
		error  string
	}{
		{"block lookup failure", "getblocknobytime", `{"status":"0","result":"unavailable"}`, "could not get snapshot block"},
		{"no block after launch", "getblocknobytime", `{"status":"1","message":"NOTOK","result":"Error! No closest block found"}`, "unexpected snapshot block"},
		{"missing block", "getblocknobytime", `{"status":"1"}`, "unexpected snapshot block"},
		{"invalid block", "getblocknobytime", `{"status":"1","result":"invalid"}`, "unexpected snapshot block"},
		{"negative block", "getblocknobytime", `{"status":"1","result":"-1"}`, "unexpected snapshot block"},
		{"balance lookup failure", "balancehistory", `{"status":"0","result":"unavailable"}`, "could not get snapshot balance"},
		{"missing balance", "balancehistory", `{"status":"1"}`, "unexpected snapshot balance"},
		{"invalid balance", "balancehistory", `{"status":"1","result":"invalid"}`, "unexpected snapshot balance"},
		{"negative balance", "balancehistory", `{"status":"1","result":"-1"}`, "unexpected snapshot balance"},
	} {
		for _, token := range []*erc20.Token{nil, erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6)} {
			action := test.action
			balanceAction := "balancehistory"
			if token != nil {
				balanceAction = "tokenbalancehistory"
				if action == "balancehistory" {
					action = balanceAction
				}
			}
			t.Run(balanceAction+"/"+test.name, func(t *testing.T) {
				var actions []string
				client := newTestEtherScan(func(req *http.Request) *http.Response {
					requestAction := formValues(t, req).Get("action")
					actions = append(actions, requestAction)
					if requestAction == action {
						return jsonRPCResponse(t, test.body)
					}
					require.Equal(t, "getblocknobytime", requestAction)
					return jsonRPCResponse(t, `{"status":"1","result":"21525890"}`)
				})
				balance, err := client.HistoricalBalanceAt(context.Background(), common.Address{}, time.Now(), token)
				require.ErrorContains(t, err, test.error)
				require.Nil(t, balance)
				expectedActions := []string{"getblocknobytime"}
				if action != "getblocknobytime" {
					expectedActions = append(expectedActions, balanceAction)
				}
				require.Equal(t, expectedActions, actions)
			})
		}
	}
}

// Concurrent native and token requests share a limit of two historical balance requests per second.
func TestHistoricalBalanceRateLimit(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var lock sync.Mutex
		var requestTimes []time.Time
		handler := func(*http.Request) *http.Response {
			lock.Lock()
			requestTimes = append(requestTimes, time.Now())
			lock.Unlock()
			return jsonRPCResponse(t, `{"status":"1","result":"0"}`)
		}
		clients := []*EtherScan{
			NewEtherScan("1", &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return handler(req), nil
			})}, rate.NewLimiter(rate.Inf, 1)),
			newTestEtherScan(handler),
		}
		defaultClient := NewEtherScan("11155111", nil, nil)
		require.Same(t, defaultClient.historicalBalanceLimiter, clients[0].historicalBalanceLimiter)
		sharedLimiter := rate.NewLimiter(2, 1)
		for _, client := range clients {
			client.historicalBalanceLimiter = sharedLimiter
		}

		start := time.Now()
		results := make(chan error, 4)
		for i := 0; i < cap(results); i++ {
			go func() {
				action := "balancehistory"
				if i%2 == 1 {
					action = "tokenbalancehistory"
				}
				var result struct{ Result string }
				results <- clients[i%len(clients)].call(
					t.Context(), url.Values{"action": {action}}, &result)
			}()
		}
		for i := 0; i < cap(results); i++ {
			require.NoError(t, <-results)
		}
		require.Len(t, requestTimes, cap(results))
		for i, requestTime := range requestTimes {
			require.Equal(t, time.Duration(i)*500*time.Millisecond, requestTime.Sub(start))
		}
	})
}

// Waiting for a historical allowance must not reserve a general slot that later overlaps ordinary traffic.
func TestHistoricalBalanceRateLimitWithOrdinaryRequests(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		type request struct {
			action string
			at     time.Time
		}
		var lock sync.Mutex
		var requests []request
		handler := func(req *http.Request) *http.Response {
			lock.Lock()
			requests = append(requests, request{action: req.URL.Query().Get("action"), at: time.Now()})
			lock.Unlock()
			return jsonRPCResponse(t, `{"status":"1","result":"0"}`)
		}
		clients := []*EtherScan{newTestEtherScan(handler), newTestEtherScan(handler)}
		generalLimiter := rate.NewLimiter(rate.Every(250*time.Millisecond), 1)
		historyLimiter := rate.NewLimiter(rate.Every(500*time.Millisecond), 1)
		require.True(t, historyLimiter.Allow())
		for _, client := range clients {
			client.limiter = generalLimiter
			client.historicalBalanceLimiter = historyLimiter
		}
		results := make(chan error, 4)
		startRequest := func(client *EtherScan, action string) {
			go func() {
				var result struct{ Result string }
				results <- client.call(t.Context(), url.Values{"action": {action}}, &result)
			}()
			synctest.Wait()
		}
		startRequest(clients[0], "balancehistory")
		time.Sleep(400 * time.Millisecond)
		startRequest(clients[1], "eth_blockNumber")
		time.Sleep(300 * time.Millisecond)
		startRequest(clients[0], "tokenbalancehistory")
		time.Sleep(200 * time.Millisecond)
		startRequest(clients[1], "eth_blockNumber")
		for i := 0; i < cap(results); i++ {
			require.NoError(t, <-results)
		}
		require.Len(t, requests, cap(results))
		var lastHistorical time.Time
		for i, request := range requests {
			if i > 0 {
				require.GreaterOrEqual(t, request.at.Sub(requests[i-1].at), 250*time.Millisecond)
			}
			if request.action == "balancehistory" || request.action == "tokenbalancehistory" {
				if !lastHistorical.IsZero() {
					require.GreaterOrEqual(t, request.at.Sub(lastHistorical), 500*time.Millisecond)
				}
				lastHistorical = request.at
			}
		}
	})
}

// A canceled historical request stops waiting for the rate limit without sending a balance query.
func TestHistoricalBalanceRateLimitCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var actions []string
		client := newTestEtherScan(func(req *http.Request) *http.Response {
			actions = append(actions, formValues(t, req).Get("action"))
			return jsonRPCResponse(t, `{"status":"1","result":"21525890"}`)
		})
		client.historicalBalanceLimiter = rate.NewLimiter(2, 1)
		require.True(t, client.historicalBalanceLimiter.Allow())
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		result := make(chan error, 1)
		go func() {
			_, err := client.HistoricalBalanceAt(
				ctx, common.Address{}, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), nil)
			result <- err
		}()
		synctest.Wait()
		cancel()
		err := <-result
		require.ErrorIs(t, err, rpcclient.ErrRequestRejected)
		require.ErrorContains(t, err, context.Canceled.Error())
		require.Equal(t, []string{"getblocknobytime"}, actions)
	})
}

// Historical requests reject rate-limit waits that cannot fit within the shared HTTP request deadline.
func TestHistoricalBalanceRateLimitDeadline(t *testing.T) {
	client := newTestEtherScan(func(req *http.Request) *http.Response {
		t.Fatal("a historical request that exceeds the deadline must not reach the provider")
		return nil
	})
	client.historicalBalanceLimiter = rate.NewLimiter(rate.Every(time.Minute), 1)
	require.True(t, client.historicalBalanceLimiter.Allow())
	var result struct{ Result string }
	err := client.call(t.Context(), url.Values{"action": {"tokenbalancehistory"}}, &result)
	require.ErrorIs(t, err, rpcclient.ErrRequestRejected)
	require.ErrorContains(t, err, "would exceed context deadline")
}
