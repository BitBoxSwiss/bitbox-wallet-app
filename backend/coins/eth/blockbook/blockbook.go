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
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
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
	// TODO remove before merging into master?
	log *logrus.Entry
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
		log:        logging.Get().WithField("ETH Client", "Blockbook"),
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

func (blockbook *Blockbook) address(ctx context.Context, account common.Address, params url.Values, result interface{}) error {
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

	if err := blockbook.address(ctx, account, url.Values{}, &result); err != nil {
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

// prepareTransactions casts to []accounts.Transactions and removes duplicate entries and sets the
// transaction type (send, receive, send to self) based on the account address.
func prepareTransactions(
	isERC20 bool,
	blockTipHeight *big.Int,
	isInternal bool,
	transactions []*Tx, address common.Address) ([]*accounts.TransactionData, error) {
	seen := map[string]struct{}{}

	// TODO figure out if needed. Etherscan.go uses this to compute the num of confirmations.
	// But numConfirmations is already returned by the API call.
	_ = blockTipHeight

	_ = isInternal // TODO figure out how to deal with internal txs.

	castedTransactions := make([]*accounts.TransactionData, 0, len(transactions))
	ours := address.Hex()
	for _, tx := range transactions {
		if _, ok := seen[tx.Txid]; ok {
			// Skip duplicate transactions.
			continue
		}
		seen[tx.Txid] = struct{}{}

		fee := coin.NewAmount(tx.FeesSat.Int)
		timestamp := time.Unix(tx.Blocktime, 0)
		status, err := tx.Status()
		// TODO do not ignore unconfirmed tx
		if status == accounts.TxStatusPending {
			continue
		}
		if err != nil {
			return nil, errp.WithStack(err)
		}
		from := tx.Vin[0].Addresses[0]
		var to string
		if len(tx.TokenTransfers) > 0 {
			to = tx.TokenTransfers[0].To
		} else {
			to = tx.Vout[0].Addresses[0]
		}
		if ours != from && ours != to {
			return nil, errp.New("transaction does not belong to our account")
		}

		var txType accounts.TxType
		switch {
		case ours == from && ours == to:
			txType = accounts.TxTypeSendSelf
		case ours == from:
			txType = accounts.TxTypeSend
		default:
			txType = accounts.TxTypeReceive
		}

		addresses, err := tx.Addresses(isERC20)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		castedTransaction := &accounts.TransactionData{
			Fee:                      &fee,
			FeeIsDifferentUnit:       isERC20,
			Timestamp:                &timestamp,
			TxID:                     tx.Txid,
			InternalID:               tx.Txid,
			Height:                   tx.Blockheight,
			NumConfirmations:         int(tx.Confirmations),
			NumConfirmationsComplete: ethtypes.NumConfirmationsComplete,
			Status:                   status,
			Type:                     txType,
			Amount:                   tx.Amount(address.Hex(), isERC20),
			Gas:                      tx.EthereumSpecific.GasUsed.Uint64(),
			Nonce:                    &tx.EthereumSpecific.Nonce,
			Addresses:                addresses,
			IsErc20:                  isERC20,
		}
		castedTransactions = append(castedTransactions, castedTransaction)
	}
	return castedTransactions, nil
}

// Transactions implement TransactionSource.
func (blockbook *Blockbook) Transactions(blockTipHeight *big.Int, address common.Address, endBlock *big.Int, erc20Token *erc20.Token) ([]*accounts.TransactionData, error) {
	params := url.Values{}
	isERC20 := erc20Token != nil
	if isERC20 {
		params.Set("contract", erc20Token.ContractAddress().Hex())
	}
	params.Set("details", "txslight")
	if endBlock != nil {
		params.Set("endBlock", endBlock.String())
	}
	result := struct {
		Transactions []*Tx `json:"transactions"`
	}{}

	if err := blockbook.address(context.Background(), address, params, &result); err != nil {
		return nil, errp.WithStack(err)
	}

	transactionsNormal, err := prepareTransactions(isERC20, blockTipHeight, false, result.Transactions, address)

	if err != nil {
		return nil, errp.WithStack(err)
	}

	return transactionsNormal, nil

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

	if err := blockbook.address(context.Background(), account, url.Values{}, &result); err != nil {
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
