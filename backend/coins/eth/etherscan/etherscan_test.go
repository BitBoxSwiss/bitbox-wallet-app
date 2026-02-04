// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

func TestTransactionsBatchERC20Tokentx(t *testing.T) {
	account := common.HexToAddress("0x1111111111111111111111111111111111111111")
	receiver := common.HexToAddress("0x2222222222222222222222222222222222222222")
	tokenA := erc20.NewToken("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 6)
	tokenB := erc20.NewToken("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 6)
	unsupported := common.HexToAddress("0xcccccccccccccccccccccccccccccccccccccccc")

	var tokentxCalls int32
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			q := r.URL.Query()
			require.Equal(t, "account", q.Get("module"))
			require.Equal(t, "tokentx", q.Get("action"))
			require.True(t, q.Has("contractaddress"))
			require.Equal(t, "", q.Get("contractaddress"))
			require.Equal(t, "0", q.Get("startblock"))
			require.Equal(t, "100", q.Get("endblock"))
			require.Equal(t, "1", q.Get("page"))
			require.Equal(t, "10000", q.Get("offset"))
			require.Equal(t, "latest", q.Get("tag"))
			require.Equal(t, "desc", q.Get("sort"))
			require.Equal(t, account.Hex(), q.Get("address"))

			atomic.AddInt32(&tokentxCalls, 1)
			body := fmt.Sprintf(`{
  "status":"1",
  "message":"OK",
  "result":[
    {"blockNumber":"90","timeStamp":"1700000000","hash":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
     "nonce":"1","from":"%s","to":"%s","value":"1000","gasUsed":"21000","gasPrice":"1",
     "isError":"0","contractAddress":"%s"},
    {"blockNumber":"91","timeStamp":"1700000001","hash":"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
     "nonce":"2","from":"%s","to":"%s","value":"2000","gasUsed":"21000","gasPrice":"1",
     "isError":"0","contractAddress":"%s"},
    {"blockNumber":"92","timeStamp":"1700000002","hash":"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
     "nonce":"3","from":"%s","to":"%s","value":"3000","gasUsed":"21000","gasPrice":"1",
     "isError":"0","contractAddress":"%s"}
  ]
}`, account.Hex(), receiver.Hex(), tokenA.ContractAddress().Hex(),
				account.Hex(), receiver.Hex(), tokenB.ContractAddress().Hex(),
				account.Hex(), receiver.Hex(), unsupported.Hex())
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     http.Header{"Content-Type": []string{"application/json"}},
			}, nil
		}),
	}

	etherScan := NewEtherScan("1", client, rate.NewLimiter(rate.Limit(1000), 1))
	etherScan.url = "http://example"
	etherScan.SetSupportedERC20Tokens([]*erc20.Token{tokenA, tokenB})

	blockTipHeight := big.NewInt(100)
	endBlock := big.NewInt(100)

	transactionsA, err := etherScan.Transactions(blockTipHeight, account, endBlock, tokenA)
	require.NoError(t, err)
	require.Len(t, transactionsA, 1)
	require.True(t, transactionsA[0].IsErc20)

	transactionsB, err := etherScan.Transactions(blockTipHeight, account, endBlock, tokenB)
	require.NoError(t, err)
	require.Len(t, transactionsB, 1)
	require.True(t, transactionsB[0].IsErc20)

	require.Equal(t, int32(1), atomic.LoadInt32(&tokentxCalls))
}
