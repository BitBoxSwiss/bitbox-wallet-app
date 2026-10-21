// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

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

func newTestEtherScan(t *testing.T, handler http.HandlerFunc) *EtherScan {
	t.Helper()
	server := httptest.NewTestServer(t, handler)
	return NewEtherScan("1", server.Client(), rate.NewLimiter(rate.Inf, 1))
}

func formValues(t *testing.T, req *http.Request) url.Values {
	t.Helper()
	switch req.Method {
	case http.MethodGet:
		return req.URL.Query()
	case http.MethodPost:
		assert.NoError(t, req.ParseForm())
		return req.PostForm
	default:
		t.Errorf("unexpected method: %s", req.Method)
		return nil
	}
}

// TestRequestTimeout checks that a stalled HTTP response reaches the request deadline in fake time.
func TestRequestTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := newTestEtherScan(t, func(_ http.ResponseWriter, req *http.Request) {
			<-req.Context().Done()
		})
		start := time.Now()
		_, err := client.BlockNumber(t.Context())
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.Equal(t, 30*time.Second, time.Since(start))
	})
}

func TestReconciliationRPCResponses(t *testing.T) {
	for _, body := range []string{
		`{"jsonrpc":"2.0","id":1,"result":null}`,
		`{"jsonrpc":"2.0","id":1}`,
		`{"jsonrpc":"2.0","id":1,"error":{"message":"unavailable"}}`,
	} {
		t.Run(body, func(t *testing.T) {
			client := newTestEtherScan(t, func(w http.ResponseWriter, _ *http.Request) {
				fmt.Fprint(w, body)
			})
			receipt, receiptErr := client.TransactionReceiptWithBlockNumber(context.Background(), common.Hash{})
			tx, _, txErr := client.TransactionByHash(context.Background(), common.Hash{})
			require.Nil(t, receipt)
			require.Nil(t, tx)
			if strings.Contains(body, `"result":null`) {
				require.NoError(t, receiptErr)
				require.ErrorIs(t, txErr, ethereum.NotFound)
			} else {
				require.Error(t, receiptErr)
				require.Error(t, txErr)
				require.NotErrorIs(t, txErr, ethereum.NotFound)
			}
		})
	}
	client := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		assert.Equal(t, "eth_getTransactionCount", req.URL.Query().Get("action"))
		assert.Equal(t, "0x64", req.URL.Query().Get("tag"))
		fmt.Fprint(w, `{"jsonrpc":"2.0","id":1,"result":"0x9"}`)
	})
	nonce, err := client.NonceAt(context.Background(), common.Address{}, big.NewInt(100))
	require.NoError(t, err)
	require.Equal(t, uint64(9), nonce)
	receiptJSON, err := json.Marshal(&types.Receipt{
		BlockNumber: big.NewInt(100), Status: types.ReceiptStatusSuccessful,
		GasUsed: 21000, Logs: []*types.Log{},
	})
	require.NoError(t, err)
	client = newTestEtherScan(t, func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintf(w, `{"jsonrpc":"2.0","id":1,"result":%s}`, receiptJSON)
	})
	receipt, err := client.TransactionReceiptWithBlockNumber(context.Background(), common.Hash{})
	require.NoError(t, err)
	require.Equal(t, big.NewInt(100), receipt.BlockNumber)
	require.Equal(t, uint64(21000), receipt.GasUsed)
}

func TestRPCProxyUsesGETForSmallEstimateGasRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		assert.Equal(t, http.MethodGet, req.Method)
		params := formValues(t, req)
		assert.Equal(t, "1", params.Get("chainId"))
		assert.Equal(t, "proxy", params.Get("module"))
		assert.Equal(t, "eth_estimateGas", params.Get("action"))
		assert.Equal(t, to.Hex(), params.Get("to"))
		fmt.Fprint(w, `{"jsonrpc":"2.0","id":1,"result":"0x5208"}`)
	})

	gas, err := etherScan.EstimateGas(context.Background(), ethereum.CallMsg{
		To: &to,
	})
	require.NoError(t, err)
	require.Equal(t, uint64(21000), gas)
}

func TestRPCProxyUsesPOSTForLargeEstimateGasRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	etherScan := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		assert.Equal(t, http.MethodPost, req.Method)
		assert.Equal(t, "application/x-www-form-urlencoded", req.Header.Get("Content-Type"))
		assert.Empty(t, req.URL.RawQuery)
		params := formValues(t, req)
		assert.Equal(t, "1", params.Get("chainId"))
		assert.Equal(t, "proxy", params.Get("module"))
		assert.Equal(t, "eth_estimateGas", params.Get("action"))
		assert.Equal(t, to.Hex(), params.Get("to"))
		assert.Greater(t, len(params.Get("data")), maxGetRequestTargetLength)
		fmt.Fprint(w, `{"jsonrpc":"2.0","id":1,"result":"0x5208"}`)
	})

	gas, err := etherScan.EstimateGas(context.Background(), ethereum.CallMsg{
		To:   &to,
		Data: bytes.Repeat([]byte{0xab}, 3000),
	})
	require.NoError(t, err)
	require.Equal(t, uint64(21000), gas)
}

func TestRPCProxyUsesPOSTForSendTransactionRequest(t *testing.T) {
	to := common.HexToAddress("0x0000000000000000000000000000000000000001")
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    1,
		GasPrice: big.NewInt(1),
		Gas:      100000,
		To:       &to,
		Value:    big.NewInt(0),
	})
	etherScan := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		assert.Equal(t, http.MethodPost, req.Method)
		assert.Equal(t, "application/x-www-form-urlencoded", req.Header.Get("Content-Type"))
		assert.Empty(t, req.URL.RawQuery)
		params := formValues(t, req)
		assert.Equal(t, "1", params.Get("chainId"))
		assert.Equal(t, "proxy", params.Get("module"))
		assert.Equal(t, "eth_sendRawTransaction", params.Get("action"))
		assert.LessOrEqual(t, len(params.Get("hex")), maxGetRequestTargetLength)
		fmt.Fprintf(w, `{"jsonrpc":"2.0","id":1,"result":%q}`, tx.Hash().Hex())
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

	// Serve the responses over the in-memory network.
	etherScan := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		endBlock := req.URL.Query().Get("endblock")
		result, ok := responses[endBlock]
		if !ok {
			result = []map[string]string{}
		}
		assert.NoError(t, json.NewEncoder(w).Encode(struct {
			Result []map[string]string `json:"result"`
		}{
			Result: result,
		}))
	})

	// Act: call the pagination code starting at endblock 9999.
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

func TestBalancesAtBlock(t *testing.T) {
	address := common.Address{19: 2}
	client := newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		params := req.URL.Query()
		assert.Equal(t, "balancemulti", params.Get("action"))
		assert.Equal(t, "0x64", params.Get("tag"))
		assert.Equal(t, address.Hex(), params.Get("address"))
		fmt.Fprint(w, `{"status":"1","result":[{"account":"`+address.Hex()+`","balance":"20000"}]}`)
	})
	balances, err := client.Balances(context.Background(), []common.Address{address}, big.NewInt(100))
	require.NoError(t, err)
	require.Equal(t, big.NewInt(20000), balances[address])

	client = newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		params := req.URL.Query()
		assert.Equal(t, "balance", params.Get("action"))
		assert.Equal(t, address.Hex(), params.Get("address"))
		assert.Equal(t, "0x64", params.Get("tag"))
		fmt.Fprint(w, `{"status":"1","result":"20000"}`)
	})
	balance, err := client.Balance(context.Background(), address, big.NewInt(100))
	require.NoError(t, err)
	require.Equal(t, big.NewInt(20000), balance)

	token := erc20.NewToken("0x0000000000000000000000000000000000000001", 6)
	client = newTestEtherScan(t, func(w http.ResponseWriter, req *http.Request) {
		params := req.URL.Query()
		assert.Equal(t, "eth_call", params.Get("action"))
		assert.Equal(t, token.ContractAddress().Hex(), params.Get("to"))
		assert.Equal(t, "0x70a082310000000000000000000000000000000000000000000000000000000000000002", params.Get("data"))
		assert.Equal(t, "0x64", params.Get("tag"))
		fmt.Fprint(w, `{"jsonrpc":"2.0","result":"0x0000000000000000000000000000000000000000000000000000000000004e20"}`)
	})
	balance, err = client.ERC20Balance(address, token, big.NewInt(100))
	require.NoError(t, err)
	require.Equal(t, big.NewInt(20000), balance)

	client = newTestEtherScan(t, func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"jsonrpc":"2.0","result":"0x"}`)
	})
	_, err = client.ERC20Balance(address, token, big.NewInt(100))
	require.Error(t, err)
}

func TestSendTransactionPreservesRPCError(t *testing.T) {
	client := newTestEtherScan(t, func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"jsonrpc":"2.0","error":{"code":-32000,"message":"insufficient funds"}}`)
	})
	tx := types.NewTransaction(0, common.Address{1}, big.NewInt(1), 21000, big.NewInt(1), nil)
	require.ErrorIs(t, client.SendTransaction(context.Background(), tx), rpcclient.RPCError{Code: -32000, Message: "insufficient funds"})
}

func TestSendTransactionErrors(t *testing.T) {
	tx := types.NewTransaction(0, common.Address{1}, big.NewInt(1), 21000, big.NewInt(1), nil)
	for _, test := range []struct {
		body     string
		rejected bool
	}{
		{`{"status":"0","message":"NOTOK","result":"Max rate limit reached"}`, true},
		{`{"status":"0","message":"NOTOK","result":"Max rate limit reached, please use API Key for higher rate limit"}`, true},
		{`{"status":"0","message":"NOTOK","result":"Invalid API Key"}`, true},
		{`{"status":"0","message":"NOTOK","result":"Unexpected err, timeout occurred or server too busy. Please try again later"}`, false},
		{`{"jsonrpc":"2.0","result":null}`, false},
		{fmt.Sprintf(`{"jsonrpc":"2.0","result":%q}`, (common.Hash{1}).Hex()), false},
	} {
		t.Run(test.body, func(t *testing.T) {
			client := newTestEtherScan(t, func(w http.ResponseWriter, _ *http.Request) {
				fmt.Fprint(w, test.body)
			})
			err := client.SendTransaction(t.Context(), tx)
			require.Error(t, err)
			require.Equal(t, test.rejected, errors.Is(err, rpcclient.ErrRequestRejected))
		})
	}
}

func TestSendTransactionNotAttempted(t *testing.T) {
	client := newTestEtherScan(t, func(http.ResponseWriter, *http.Request) {
		t.Error("a canceled request must not be sent")
	})
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	tx := types.NewTransaction(0, common.Address{1}, big.NewInt(1), 21000, big.NewInt(1), nil)
	require.ErrorIs(t, client.SendTransaction(ctx, tx), rpcclient.ErrRequestRejected)
}
