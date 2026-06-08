// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"testing"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func makeTokenTx(hash, blockNumber string, from, to, contract common.Address) map[string]string {
	return map[string]string{
		"blockNumber":     blockNumber,
		"timeStamp":       "1700000000",
		"hash":            hash,
		"nonce":           "1",
		"from":            from.Hex(),
		"to":              to.Hex(),
		"contractAddress": contract.Hex(),
		"value":           "1",
		"gasPrice":        "1",
		"gasUsed":         "1",
		"isError":         "0",
	}
}

func newTestEtherScan(handler func(*http.Request) *http.Response) *EtherScan {
	etherScan := NewEtherScan("1", &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return handler(req), nil
		}),
	}, rate.NewLimiter(rate.Inf, 1))
	etherScan.url = "https://example.test/v2/api"
	return etherScan
}

func jsonRPCResponse(t *testing.T, body string) *http.Response {
	t.Helper()
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
		Header:     make(http.Header),
	}
}

func formValues(t *testing.T, req *http.Request) url.Values {
	t.Helper()
	switch req.Method {
	case http.MethodGet:
		return req.URL.Query()
	case http.MethodPost:
		require.NoError(t, req.ParseForm())
		return req.PostForm
	default:
		t.Fatalf("unexpected method: %s", req.Method)
		return nil
	}
}

func TestRPCProxyUsesGETForSmallEstimateGasRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		require.Equal(t, http.MethodGet, req.Method)
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "proxy", params.Get("module"))
		require.Equal(t, "eth_estimateGas", params.Get("action"))
		require.Equal(t, to.Hex(), params.Get("to"))
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":"0x5208"}`)
	})

	gas, err := etherScan.EstimateGas(context.Background(), ethereum.CallMsg{
		To: &to,
	})
	require.NoError(t, err)
	require.Equal(t, uint64(21000), gas)
}

func TestRPCProxyUsesPOSTForLargeEstimateGasRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		require.Equal(t, http.MethodPost, req.Method)
		require.Equal(t, "application/x-www-form-urlencoded", req.Header.Get("Content-Type"))
		require.Empty(t, req.URL.RawQuery)
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "proxy", params.Get("module"))
		require.Equal(t, "eth_estimateGas", params.Get("action"))
		require.Equal(t, to.Hex(), params.Get("to"))
		require.Greater(t, len(params.Get("data")), maxGetRequestTargetLength)
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":"0x5208"}`)
	})

	gas, err := etherScan.EstimateGas(context.Background(), ethereum.CallMsg{
		To:   &to,
		Data: bytes.Repeat([]byte{0xab}, 3000),
	})
	require.NoError(t, err)
	require.Equal(t, uint64(21000), gas)
}

func TestRPCProxyUsesGETForSmallSendTransactionRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		require.Equal(t, http.MethodGet, req.Method)
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "proxy", params.Get("module"))
		require.Equal(t, "eth_sendRawTransaction", params.Get("action"))
		require.LessOrEqual(t, len(params.Get("hex")), maxGetRequestTargetLength)
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
	})

	tx := types.NewTx(&types.LegacyTx{
		Nonce:    1,
		GasPrice: big.NewInt(1),
		Gas:      100000,
		To:       &to,
		Value:    big.NewInt(0),
	})
	require.NoError(t, etherScan.SendTransaction(context.Background(), tx))
}

func TestRPCProxyUsesPOSTForLargeSendTransactionRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		require.Equal(t, http.MethodPost, req.Method)
		require.Equal(t, "application/x-www-form-urlencoded", req.Header.Get("Content-Type"))
		require.Empty(t, req.URL.RawQuery)
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "proxy", params.Get("module"))
		require.Equal(t, "eth_sendRawTransaction", params.Get("action"))
		require.Greater(t, len(params.Get("hex")), maxGetRequestTargetLength)
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
	})

	tx := types.NewTx(&types.LegacyTx{
		Nonce:    1,
		GasPrice: big.NewInt(1),
		Gas:      100000,
		To:       &to,
		Value:    big.NewInt(0),
		Data:     bytes.Repeat([]byte{0xab}, 3000),
	})
	require.NoError(t, etherScan.SendTransaction(context.Background(), tx))
}

func TestTokenTransactionsByContractPaginationDedup(t *testing.T) {
	// Arrange: construct deterministic addresses and a duplicate tx hash.
	address := common.HexToAddress("0x0000000000000000000000000000000000000001")
	to := common.HexToAddress("0x0000000000000000000000000000000000000002")
	contract := common.HexToAddress("0x0000000000000000000000000000000000000003")

	dupHash := fmt.Sprintf("0x%064x", 1)
	// Page 1 mimics a full Etherscan page (maxTokenTransactionsPerQuery entries),
	// including a duplicate hash and a last entry that sets the next page boundary.
	page1 := make([]map[string]string, 0, maxTokenTransactionsPerQuery)
	page1 = append(
		page1,
		makeTokenTx(dupHash, "500", address, to, contract),
		makeTokenTx(dupHash, "500", address, to, contract),
	)
	for i := 0; len(page1) < maxTokenTransactionsPerQuery; i++ {
		hash := fmt.Sprintf("0x%064x", i+2)
		page1 = append(page1, makeTokenTx(hash, "600", address, to, contract))
	}
	page1[len(page1)-1]["blockNumber"] = "500"

	// Page 2 includes the duplicate again and one older tx to ensure pagination
	// continues and deduplication is exercised across pages.
	page2 := []map[string]string{
		makeTokenTx(dupHash, "500", address, to, contract),
		makeTokenTx(dupHash, "500", address, to, contract),
		makeTokenTx(fmt.Sprintf("0x%064x", 999999), "499", address, to, contract),
	}

	// Map endblock query parameter -> mocked response body.
	responses := map[string][]map[string]string{
		"9999": page1,
		"500":  page2,
	}

	// Stub HTTP client so the test runs without real network calls.
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			endBlock := req.URL.Query().Get("endblock")
			result, ok := responses[endBlock]
			if !ok {
				result = []map[string]string{}
			}
			body, err := json.Marshal(struct {
				Result []map[string]string `json:"result"`
			}{
				Result: result,
			})
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	// Act: call the pagination code starting at endblock 9999.
	etherScan := NewEtherScan("1", client, rate.NewLimiter(rate.Inf, 1))
	result, err := etherScan.TokenTransactionsByContract(
		big.NewInt(10000),
		address,
		big.NewInt(9999),
	)
	require.NoError(t, err)

	// Assert: all unique txs are returned and the duplicate appears only twice.
	transactions := result[contract]
	require.Len(t, transactions, maxTokenTransactionsPerQuery+1)

	dupCount := 0
	for _, tx := range transactions {
		if tx.TxID == dupHash {
			dupCount++
		}
	}
	require.Equal(t, 2, dupCount)
}
