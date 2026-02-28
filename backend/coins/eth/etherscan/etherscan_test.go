// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"testing"

	"github.com/ethereum/go-ethereum/common"
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
