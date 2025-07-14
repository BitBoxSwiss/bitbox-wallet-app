// Copyright 2025 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package blockbook

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"golang.org/x/time/rate"
)

// callsPerSec is the number of blockbook requests allowed
// per second.
// TODO bznein determine a better value for this.
const callsPerSec = 3.8

// Blockbook is a rate-limited blockbook api client.
type Blockbook struct {
	url        string
	httpClient *http.Client
	limiter    *rate.Limiter
}

// NewBlockbook creates a new instance of EtherScan.
func NewBlockbook(chainId string, httpClient *http.Client) *Blockbook {
	if chainId != "1" {
		panic(fmt.Sprintf("ChainID must be '1', got %s instead", chainId))
	}
	return &Blockbook{
		url:        "https://bb1.shiftcrypto.io/api/",
		httpClient: httpClient,
		limiter:    rate.NewLimiter(rate.Limit(callsPerSec), 1),
	}
}

func (blockbook *Blockbook) call(ctx context.Context, handler string, params url.Values, result interface{}) error {
	if err := blockbook.limiter.Wait(ctx); err != nil {
		return errp.WithStack(err)
	}

	reqUrl := blockbook.url + handler + "?" + params.Encode()

	response, err := blockbook.httpClient.Get(reqUrl)
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return errp.Newf("expected 200 OK, got %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return errp.WithStack(err)
	}
	if err := json.Unmarshal(body, result); err != nil {
		return errp.Newf("unexpected response from blockbook: %s", string(body))
	}

	return nil
}

func (blockbook *Blockbook) address(ctx context.Context, account common.Address, result interface{}) error {
	params := url.Values{}
	address := account.Hex()

	addressPath := fmt.Sprintf("address/%s", address)

	if err := blockbook.call(ctx, addressPath, params, result); err != nil {
		return errp.WithStack(err)
	}

	return nil
}

// Balance implements rpc.Interface.
func (blockbook *Blockbook) Balance(ctx context.Context, account common.Address) (*big.Int, error) {
	result := struct {
		Balance string `json:"balance"`
	}{}

	if err := blockbook.address(ctx, account, &result); err != nil {
		return nil, errp.WithStack(err)
	}

	balance, ok := new(big.Int).SetString(result.Balance, 10)
	if !ok {
		return nil, errp.Newf("could not parse balance %q", result.Balance)
	}
	return balance, nil

}

// BlockNumber implements rpc.Interface.
func (blockbook *Blockbook) BlockNumber(ctx context.Context) (*big.Int, error) {
	result := struct {
		Backend struct {
			Blocks int64 `json:"blocks"`
		} `json:"backend"`
	}{}

	if err := blockbook.call(ctx, "status", nil, &result); err != nil {
		return nil, errp.WithStack(err)
	}

	blockNumber := new(big.Int).SetInt64(result.Backend.Blocks)
	return blockNumber, nil
}

// PendingNonceAt implements rpc.Interface.
func (blockbook *Blockbook) PendingNonceAt(ctx context.Context, account common.Address) (uint64, error) {
	return 0, fmt.Errorf("Not yet implemented")
}

// Transactions implement TransactionSource.
func (blockbook *Blockbook) Transactions(blockTipHeight *big.Int, address common.Address, endBlock *big.Int, erc20Token *erc20.Token) ([]*accounts.TransactionData, error) {
	return nil, fmt.Errorf("Not yet implemented")
}

// SendTransaction implements rpc.Interface.
func (blockbook *Blockbook) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	return fmt.Errorf("Not yet implemented")
}

// ERC20Balance implements rpc.Interface.
func (blockbook *Blockbook) ERC20Balance(account common.Address, erc20Token *erc20.Token) (*big.Int, error) {
	result := struct {
		Tokens []struct {
			Balance  string `json:"balance"`
			Contract string `json:"contract"`
		} `json:"tokens"`
	}{}

	// TODO why is there no context in the signature of this interface method?
	if err := blockbook.address(context.Background(), account, &result); err != nil {
		return nil, errp.WithStack(err)
	}

	for _, token := range result.Tokens {
		if token.Contract == erc20Token.ContractAddress().Hex() {
			balance, ok := new(big.Int).SetString(token.Balance, 10)
			if !ok {
				return nil, errp.Newf("could not parse balance %q", token.Balance)
			}
			return balance, nil
		}
	}
	return nil, errp.Newf("no balance found for token %s", erc20Token.ContractAddress().Hex())
}

// EstimateGas implements rpc.Interface.
func (blockbook *Blockbook) EstimateGas(ctx context.Context, call ethereum.CallMsg) (gas uint64, err error) {
	return 0, fmt.Errorf("Not yet implemented")
}

// FeeTargets implements rpc.Interface.
func (blockbook *Blockbook) FeeTargets(ctx context.Context) ([]*ethtypes.FeeTarget, error) {
	return nil, fmt.Errorf("Not yet implemented")
}

// SuggestGasPrice implements rpc.Interface.
func (blockbook *Blockbook) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	return nil, fmt.Errorf("Not yet implemented")
}

// TransactionByHash implements rpc.Interface.
func (blockbook *Blockbook) TransactionByHash(ctx context.Context, hash common.Hash) (tx *types.Transaction, isPending bool, err error) {
	return nil, false, fmt.Errorf("Not yet implemented")
}

// TransactionReceiptWithBlockNumber implements rpcclient.Interface.
func (blockbook *Blockbook) TransactionReceiptWithBlockNumber(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
	return nil, fmt.Errorf("Not yet implemented")
}
