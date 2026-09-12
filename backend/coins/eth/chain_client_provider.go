// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"net/http"
	"strconv"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"golang.org/x/time/rate"
)

// ChainClientProvider returns an RPC client for the given EVM chain ID.
type ChainClientProvider func(chainID uint64) rpcclient.Interface

// NewEtherscanChainClientProvider creates clients that share an HTTP client and rate limiter.
func NewEtherscanChainClientProvider(
	httpClient *http.Client,
	limiter *rate.Limiter,
) ChainClientProvider {
	return func(chainID uint64) rpcclient.Interface {
		return etherscan.NewEtherScan(strconv.FormatUint(chainID, 10), httpClient, limiter)
	}
}
