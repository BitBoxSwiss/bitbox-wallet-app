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
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
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

func TestRequestTimeout(t *testing.T) {
	old := requestTimeout
	requestTimeout = 50 * time.Millisecond
	defer func() { requestTimeout = old }()

	etherScan := newTestEtherScan(nil)
	etherScan.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			// Simulate a stalled connection: block until the per-request deadline cancels the
			// context, then surface that error the way net/http does.
			<-req.Context().Done()
			return nil, req.Context().Err()
		}),
	}

	_, err := etherScan.BlockNumber(context.Background())
	require.Error(t, err)
}

func TestGweiStringToWei(t *testing.T) {
	for _, tc := range []struct {
		input   string
		want    *big.Int
		wantErr bool
	}{
		{input: "20", want: big.NewInt(20e9)},
		{input: "0", want: big.NewInt(0)},
		{input: "1.5", want: big.NewInt(1500000000)},
		// Fractional-gwei value with more decimals than int64 gwei parsing could handle;
		// this is exactly the case that used to fail with strconv.ParseInt.
		{input: "0.663812392471", want: big.NewInt(663812392)}, // floor(663812392.471)
		{input: "6.63e-1", want: big.NewInt(663000000)},        // exponent form accepted
		{input: "0.0000000001", want: big.NewInt(0)},           // 0.1 wei floors to 0
		{input: "-1", wantErr: true},                           // negative rejected
		{input: "2/3", wantErr: true},                          // rational rejected
		{input: "", wantErr: true},
		{input: "abc", wantErr: true},
	} {
		t.Run(tc.input, func(t *testing.T) {
			got, err := gweiStringToWei(tc.input)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, 0, tc.want.Cmp(got), "want %s, got %s", tc.want, got)
		})
	}
}

func TestFeeTargets(t *testing.T) {
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "gastracker", params.Get("module"))
		require.Equal(t, "gasoracle", params.Get("action"))
		// Fractional gwei values that strconv.ParseInt would have rejected, forcing the old
		// code into the single-level SuggestGasPrice fallback (an extra call + one fee level).
		return jsonRPCResponse(t, `{"result":{
			"FastGasPrice":"1.5",
			"ProposeGasPrice":"1.2",
			"SafeGasPrice":"1.0",
			"suggestBaseFee":"0.663812392471"
		}}`)
	})

	targets, err := etherScan.FeeTargets(context.Background())
	require.NoError(t, err)
	require.Len(t, targets, 3)

	baseFee := big.NewInt(663812392) // floor(0.663812392471 * 1e9)
	for i, want := range []struct {
		code   accounts.FeeTargetCode
		feeCap *big.Int
	}{
		{accounts.FeeTargetCodeHigh, big.NewInt(1500000000)},
		{accounts.FeeTargetCodeNormal, big.NewInt(1200000000)},
		{accounts.FeeTargetCodeLow, big.NewInt(1000000000)},
	} {
		require.Equal(t, want.code, targets[i].TargetCode)
		require.Equal(t, 0, want.feeCap.Cmp(targets[i].GasFeeCap), "feeCap %d", i)
		wantTip := new(big.Int).Sub(want.feeCap, baseFee)
		require.Equal(t, 0, wantTip.Cmp(targets[i].GasTipCap), "tip %d", i)
	}
}

func TestBlockNumberUsesEthBlockNumber(t *testing.T) {
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		params := formValues(t, req)
		require.Equal(t, "1", params.Get("chainId"))
		require.Equal(t, "proxy", params.Get("module"))
		require.Equal(t, "eth_blockNumber", params.Get("action"))
		// The lighter endpoint takes no tag/boolean params (unlike eth_getBlockByNumber).
		require.Empty(t, params.Get("tag"))
		require.Empty(t, params.Get("boolean"))
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":"0x1234"}`)
	})

	blockNumber, err := etherScan.BlockNumber(context.Background())
	require.NoError(t, err)
	require.Equal(t, int64(0x1234), blockNumber.Int64())
}

func TestTransactionLookupsReturnNotFound(t *testing.T) {
	nullResult := func(req *http.Request) *http.Response {
		return jsonRPCResponse(t, `{"jsonrpc":"2.0","id":1,"result":null}`)
	}

	t.Run("receipt", func(t *testing.T) {
		etherScan := newTestEtherScan(nullResult)
		_, err := etherScan.TransactionReceiptWithBlockNumber(context.Background(), common.Hash{})
		require.ErrorIs(t, err, ethereum.NotFound)
	})
	t.Run("byHash", func(t *testing.T) {
		etherScan := newTestEtherScan(nullResult)
		_, _, err := etherScan.TransactionByHash(context.Background(), common.Hash{})
		require.ErrorIs(t, err, ethereum.NotFound)
	})
}

func TestTransactionReceiptTransportErrorIsNotNotFound(t *testing.T) {
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusBadGateway,
			Body:       io.NopCloser(bytes.NewReader(nil)),
			Header:     make(http.Header),
		}
	})
	_, err := etherScan.TransactionReceiptWithBlockNumber(context.Background(), common.Hash{})
	require.Error(t, err)
	require.NotErrorIs(t, err, ethereum.NotFound)
}

func jsonResult(t *testing.T, rows []map[string]string) *http.Response {
	t.Helper()
	body, err := json.Marshal(struct {
		Result []map[string]string `json:"result"`
	}{Result: rows})
	require.NoError(t, err)
	return jsonRPCResponse(t, string(body))
}

func TestFetchTxListReportsTruncationBoundary(t *testing.T) {
	old := PageSizeThreshold
	PageSizeThreshold = 2
	defer func() { PageSizeThreshold = old }()

	addr := common.HexToAddress("0x0000000000000000000000000000000000000001")
	other := common.HexToAddress("0x0000000000000000000000000000000000000002")
	contract := common.HexToAddress("0x0000000000000000000000000000000000000003")
	// A full page (== PageSizeThreshold) whose rows all sit in one block: pagination stalls, so the
	// window at and below block 50 is reported as possibly-truncated.
	page := []map[string]string{
		makeTokenTx(fmt.Sprintf("0x%064x", 1), "50", other, addr, contract),
		makeTokenTx(fmt.Sprintf("0x%064x", 2), "50", other, addr, contract),
	}
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		return jsonResult(t, page)
	})

	byContract, truncatedBelow, err := etherScan.TokenTransactionsByContract(
		context.Background(), big.NewInt(100), addr, big.NewInt(0), big.NewInt(100))
	require.NoError(t, err)
	require.NotNil(t, truncatedBelow)
	require.Equal(t, int64(50), truncatedBelow.Int64())
	require.Len(t, byContract[contract], 2)
}

func TestTransactionsUniqueInternalIDForDuplicateTokenTransfers(t *testing.T) {
	addr := common.HexToAddress("0x0000000000000000000000000000000000000001")
	other := common.HexToAddress("0x0000000000000000000000000000000000000002")
	contract := common.HexToAddress("0x0000000000000000000000000000000000000003")
	hash := fmt.Sprintf("0x%064x", 7)
	// Two identical transfer logs sharing one tx hash (a contract transferring twice in one tx).
	dup := makeTokenTx(hash, "50", other, addr, contract)
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		return jsonResult(t, []map[string]string{dup, dup})
	})

	token := erc20.NewToken(contract.Hex(), 18)
	txs, truncatedBelow, err := etherScan.Transactions(
		context.Background(), big.NewInt(100), addr, big.NewInt(0), big.NewInt(100), token)
	require.NoError(t, err)
	require.Nil(t, truncatedBelow)
	require.Len(t, txs, 2)
	require.Equal(t, hash, txs[0].InternalID)
	require.Equal(t, hash+"-token-1", txs[1].InternalID)
}

func TestTransactionsClampsConfirmationsOnLaggingTip(t *testing.T) {
	addr := common.HexToAddress("0x0000000000000000000000000000000000000001")
	other := common.HexToAddress("0x0000000000000000000000000000000000000002")
	contract := common.HexToAddress("0x0000000000000000000000000000000000000003")
	// Tx mined at block 50, but the reported tip is only 10 (a lagging proxy node). Without the
	// clamp this underflows the uint64 confirmation subtraction into a huge count.
	tx := makeTokenTx(fmt.Sprintf("0x%064x", 5), "50", other, addr, contract)
	etherScan := newTestEtherScan(func(req *http.Request) *http.Response {
		return jsonResult(t, []map[string]string{tx})
	})

	token := erc20.NewToken(contract.Hex(), 18)
	txs, _, err := etherScan.Transactions(
		context.Background(), big.NewInt(10), addr, big.NewInt(0), big.NewInt(10), token)
	require.NoError(t, err)
	require.Len(t, txs, 1)
	require.Equal(t, 0, txs[0].NumConfirmations)
	require.Equal(t, accounts.TxStatusPending, txs[0].Status)
}

func TestTokenTransactionsByContractPaginationDedup(t *testing.T) {
	// Arrange: construct deterministic addresses and a duplicate tx hash.
	address := common.HexToAddress("0x0000000000000000000000000000000000000001")
	to := common.HexToAddress("0x0000000000000000000000000000000000000002")
	contract := common.HexToAddress("0x0000000000000000000000000000000000000003")

	dupHash := fmt.Sprintf("0x%064x", 1)
	// Page 1 mimics a full Etherscan page (PageSizeThreshold entries),
	// including a duplicate hash and a last entry that sets the next page boundary.
	page1 := make([]map[string]string, 0, PageSizeThreshold)
	page1 = append(
		page1,
		makeTokenTx(dupHash, "500", address, to, contract),
		makeTokenTx(dupHash, "500", address, to, contract),
	)
	for i := 0; len(page1) < PageSizeThreshold; i++ {
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
	result, truncatedBelow, err := etherScan.TokenTransactionsByContract(
		context.Background(),
		big.NewInt(10000),
		address,
		big.NewInt(0),
		big.NewInt(9999),
	)
	require.NoError(t, err)
	require.Nil(t, truncatedBelow)

	// Assert: all unique txs are returned and the duplicate appears only twice.
	transactions := result[contract]
	require.Len(t, transactions, PageSizeThreshold+1)

	dupCount := 0
	for _, tx := range transactions {
		if tx.TxID == dupHash {
			dupCount++
		}
	}
	require.Equal(t, 2, dupCount)
}
