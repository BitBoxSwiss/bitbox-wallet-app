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

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Interface can be implemented to provide an Ethereum rpc client.
//go:generate moq -pkg mocks -out mocks/rpcclient.go . Interface
type Interface interface {
	TransactionReceiptWithBlockNumber(
		ctx context.Context, hash common.Hash) (*RPCTransactionReceipt, error)
	HeaderByNumber(ctx context.Context, number *big.Int) (*types.Header, error)
	TransactionByHash(ctx context.Context, hash common.Hash) (tx *types.Transaction, isPending bool, err error)
	BalanceAt(ctx context.Context, account common.Address, blockNumber *big.Int) (*big.Int, error)
	bind.ContractBackend
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
