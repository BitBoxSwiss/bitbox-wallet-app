// Copyright 2019 Shift Devices AG
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

package rpcclient

import (
	"context"
	"math/big"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Interface can be implemented to provide an Ethereum rpc client.
//
//go:generate moq -pkg mocks -out mocks/rpcclient.go . Interface
type Interface interface {
	TransactionReceiptWithBlockNumber(
		ctx context.Context, hash common.Hash) (*RPCTransactionReceipt, error)
	// BlockNumber returns the current latest block number.
	BlockNumber(ctx context.Context) (*big.Int, error)
	TransactionByHash(ctx context.Context, hash common.Hash) (tx *types.Transaction, isPending bool, err error)
	// Balance returns the current confirmed balance of the address.
	Balance(ctx context.Context, account common.Address) (*big.Int, error)
	// ERC20Balance returns the current confirmed token balance of the given token for the adddress.
	ERC20Balance(account common.Address, erc20Token *erc20.Token) (*big.Int, error)
	// SendTransaction injects the transaction into the pending pool for execution.
	SendTransaction(ctx context.Context, tx *types.Transaction) error
	// PendingNonceAt retrieves the current pending nonce associated with an account.
	PendingNonceAt(ctx context.Context, account common.Address) (uint64, error)
	// EstimateGas tries to estimate the gas needed to execute a specific
	// transaction based on the current pending state of the backend blockchain.
	// There is no guarantee that this is the true gas limit requirement as other
	// transactions may be added or removed by miners, but it should provide a basis
	// for setting a reasonable default.
	EstimateGas(ctx context.Context, call ethereum.CallMsg) (gas uint64, err error)
	// SuggestGasPrice retrieves the currently suggested gas price to allow a timely
	// execution of a transaction.
	SuggestGasPrice(ctx context.Context) (*big.Int, error)
}

// RPCTransactionReceipt is a receipt extended with the block number.
type RPCTransactionReceipt struct {
	types.Receipt
	BlockNumber uint64
}

// RPCTransaction is a transaction extended with additional fields populated by the
// `eth_getTransactionByHash api` call.
type RPCTransaction struct {
	types.Transaction
	BlockNumber *string `json:"blockNumber,omitempty"`
}
