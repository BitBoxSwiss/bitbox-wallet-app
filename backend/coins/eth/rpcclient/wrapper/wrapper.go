package wrapper

import (
	"context"
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

type rpcClientWithTransactionsSource interface {
	eth.TransactionsSource
	rpcclient.Interface
}

type client struct {
	defaultRpcClient  rpcClientWithTransactionsSource
	fallbackRpcClient rpcClientWithTransactionsSource

	// TODO do we maybe want to add some fields to keep track
	// of which one we are using? if we switch to the fallback one
	// it might make sense to use that for a while instead of wasting
	// time each time trying the default first and falling back to the
	// other one later.
}

// NewClient creates a new client that uses the default RPC client unless it fails,
// in which case it falls back to the fallback RPC client.
func NewClient(defaultRPCClient, fallbackRPCClient rpcClientWithTransactionsSource) *client {
	return &client{
		defaultRpcClient:  defaultRPCClient,
		fallbackRpcClient: fallbackRPCClient,
	}
}

// Transactions queries either the default or the fallback endpoint for transactions for the given account, until endBlock.
// Provide erc20Token to filter for those. If nil, standard etheruem transactions will be fetched.
func (c *client) Transactions(
	blockTipHeight *big.Int,
	address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
	[]*accounts.TransactionData, error) {
	res, err := c.defaultRpcClient.Transactions(blockTipHeight, address, endBlock, erc20Token)
	if err != nil {
		return c.fallbackRpcClient.Transactions(blockTipHeight, address, endBlock, erc20Token)
	}
	return res, nil
}

// TransactionReceiptWithBlockNumber implements rpcclient.Interface.
func (c *client) TransactionReceiptWithBlockNumber(ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
	res, err := c.defaultRpcClient.TransactionReceiptWithBlockNumber(ctx, hash)
	if err != nil {
		return c.fallbackRpcClient.TransactionReceiptWithBlockNumber(ctx, hash)
	}
	return res, nil
}

// BlockNumber implements rpcclient.Interface.
func (c *client) BlockNumber(ctx context.Context) (*big.Int, error) {
	res, err := c.defaultRpcClient.BlockNumber(ctx)
	if err != nil {
		return c.fallbackRpcClient.BlockNumber(ctx)
	}
	return res, nil
}

// TransactionByHash implements rpcclient.Interface.
// TODO the error here is used by the caller to determine whether the tx has been found or not, so
// right now it wouldn't work using it for our fallback logic. Need to refactor this.
func (c *client) TransactionByHash(ctx context.Context, hash common.Hash) (*types.Transaction, bool, error) {
	res, pending, err := c.defaultRpcClient.TransactionByHash(ctx, hash)
	if err != nil {
		return c.fallbackRpcClient.TransactionByHash(ctx, hash)
	}
	return res, pending, nil
}

// Balance implements rpcclient.Interface.
func (c *client) Balance(ctx context.Context, account common.Address) (*big.Int, error) {
	res, err := c.defaultRpcClient.Balance(ctx, account)
	if err != nil {
		return c.fallbackRpcClient.Balance(ctx, account)
	}
	return res, nil
}

// ERC20Balance implements rpcclient.Interface.
func (c *client) ERC20Balance(account common.Address, erc20Token *erc20.Token) (*big.Int, error) {
	res, err := c.defaultRpcClient.ERC20Balance(account, erc20Token)
	if err != nil {
		return c.fallbackRpcClient.ERC20Balance(account, erc20Token)
	}
	return res, nil
}

// SendTransaction implements rpcclient.Interface.
func (c *client) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	err := c.defaultRpcClient.SendTransaction(ctx, tx)
	if err != nil {
		return c.fallbackRpcClient.SendTransaction(ctx, tx)
	}
	return nil
}

// PendingNonceAt implements rpcclient.Interface.
func (c *client) PendingNonceAt(ctx context.Context, account common.Address) (uint64, error) {
	res, err := c.defaultRpcClient.PendingNonceAt(ctx, account)
	if err != nil {
		return c.fallbackRpcClient.PendingNonceAt(ctx, account)
	}
	return res, nil
}

// EstimateGas implements rpcclient.Interface.
func (c *client) EstimateGas(ctx context.Context, call ethereum.CallMsg) (uint64, error) {
	res, err := c.defaultRpcClient.EstimateGas(ctx, call)
	if err != nil {
		return c.fallbackRpcClient.EstimateGas(ctx, call)
	}
	return res, nil
}

// SuggestGasPrice implements rpcclient.Interface.
func (c *client) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	res, err := c.defaultRpcClient.SuggestGasPrice(ctx)
	if err != nil {
		return c.fallbackRpcClient.SuggestGasPrice(ctx)
	}
	return res, nil
}

// FeeTargets implements rpcclient.Interface.
func (c *client) FeeTargets(ctx context.Context) ([]*ethtypes.FeeTarget, error) {
	res, err := c.defaultRpcClient.FeeTargets(ctx)
	if err != nil {
		return c.fallbackRpcClient.FeeTargets(ctx)
	}
	return res, nil
}
