// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"math/big"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/sirupsen/logrus"
)

// TransactionRequest contains the parsed values needed to construct an EVM transaction.
type TransactionRequest struct {
	From             ethcommon.Address
	Recipient        ethcommon.Address
	RecipientAddress string
	Data             []byte
	Value            *big.Int
	Nonce            *uint64
}

// newTransaction fills a missing nonce and estimates gas and fees using the target-chain client.
func newTransaction(
	chainID uint64,
	client rpcclient.Interface,
	proposedTx TransactionRequest,
	log *logrus.Entry,
) (*types.Transaction, error) {
	var nonce uint64
	var gasPrice *big.Int

	if proposedTx.Nonce != nil {
		nonce = *proposedTx.Nonce
	} else {
		var err error
		if nonce, err = client.PendingNonceAt(context.TODO(), proposedTx.From); err != nil {
			return nil, err
		}
	}

	value := new(big.Int)
	if proposedTx.Value != nil {
		value.Set(proposedTx.Value)
	}

	message := ethereum.CallMsg{
		From:     proposedTx.From,
		To:       &proposedTx.Recipient,
		Gas:      0,
		GasPrice: big.NewInt(0),
		Value:    value,
		Data:     proposedTx.Data,
	}

	gasLimit, err := client.EstimateGas(context.TODO(), message)
	if err != nil {
		if strings.Contains(err.Error(), etherscan.ERC20GasErr) {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
		log.WithError(err).Error("Could not estimate the gas limit.")
		return nil, errp.WithStack(errors.TxValidationError(err.Error()))
	}

	for _, t := range feeTargetsForChain(chainID, client, log) {
		// TODO Let user choose gas price/priority
		if t.TargetCode == accounts.FeeTargetCodeNormal {
			if t.GasFeeCap == nil || t.GasFeeCap.Sign() <= 0 {
				return nil, errors.ErrFeeTooLow
			}
			gasPrice = t.GasFeeCap
		}
	}
	if gasPrice == nil {
		return nil, errp.WithStack(errors.ErrFeesNotAvailable)
	}

	return types.NewTransaction(nonce,
		*message.To,
		message.Value, gasLimit, gasPrice, message.Data), nil
}

// feeTargetsForChain returns three priorities with fee targets estimated by Etherscan
// https://docs.etherscan.io/api-endpoints/gas-tracker#get-gas-oracle
// If the service should not be reachable, we fallback to only one priority, estimated by
// the ETH RPC eth_gasPrice endpoint.
func feeTargetsForChain(
	chainID uint64,
	client rpcclient.Interface,
	log *logrus.Entry,
) []*ethtypes.FeeTarget {
	if chainID != sepoliaChainID {
		etherscanFeeTargets, err := client.FeeTargets(context.TODO())
		if err == nil {
			return etherscanFeeTargets
		}
		log.WithError(err).Error("Could not get fee targets from eth gas station, falling back to RPC eth_gasPrice")
	}
	suggestedGasPrice, err := client.SuggestGasPrice(context.TODO())
	if err != nil {
		log.WithError(err).Error("Fallback to RPC eth_gasPrice failed")
		return nil
	}
	return []*ethtypes.FeeTarget{
		{
			TargetCode: accounts.FeeTargetCodeNormal,
			GasFeeCap:  suggestedGasPrice,
			GasTipCap:  suggestedGasPrice,
		},
	}
}
