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
	"encoding/json"
	"math/big"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
)

// Interface can be implemented to provide an Ethereum rpc client.
type Interface interface {
	TransactionReceiptWithBlockNumber(
		ctx context.Context, hash common.Hash) (*RPCTransactionReceipt, error)
	HeaderByNumber(ctx context.Context, number *big.Int) (*types.Header, error)
	BalanceAt(ctx context.Context, account common.Address, blockNumber *big.Int) (*big.Int, error)
	bind.ContractBackend
}

// RPCClient wraps the high level ethclient, extending it with more functions. Implements Interface.
type RPCClient struct {
	*ethclient.Client
	c *rpc.Client
}

// RPCDial connects to a backend.
func RPCDial(url string) (*RPCClient, error) {
	c, err := rpc.DialContext(context.Background(), url)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	return &RPCClient{
		Client: ethclient.NewClient(c),
		c:      c,
	}, nil
}

// RPCTransactionReceipt is a receipt extended with the block number.
type RPCTransactionReceipt struct {
	types.Receipt
	BlockNumber uint64
}

// UnmarshalJSON implements json.Unmarshaler.
func (rpcTR *RPCTransactionReceipt) UnmarshalJSON(msg []byte) error {
	if err := json.Unmarshal(msg, &rpcTR.Receipt); err != nil {
		return err
	}
	bn := struct {
		BlockNumber hexutil.Uint64 `json:"blockNumber"`
	}{}
	if err := json.Unmarshal(msg, &bn); err != nil {
		return err
	}
	rpcTR.BlockNumber = uint64(bn.BlockNumber)
	return nil
}

// TransactionReceiptWithBlockNumber is like rpc.TransactionReceipt, but exposes the block number as
// well. If no receipt was found, `nil, nil` is returned.
func (rpc *RPCClient) TransactionReceiptWithBlockNumber(
	ctx context.Context, hash common.Hash) (*RPCTransactionReceipt, error) {
	var r *RPCTransactionReceipt
	err := rpc.c.CallContext(ctx, &r, "eth_getTransactionReceipt", hash)
	return r, err
}
