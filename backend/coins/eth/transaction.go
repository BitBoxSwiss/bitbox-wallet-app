// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"encoding/hex"
	"math/big"
	"slices"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	keystorePkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
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

// SignTransactionArgs contains a transaction request and its target EVM chain.
type SignTransactionArgs struct {
	ChainID     uint64
	Broadcast   bool
	Transaction TransactionRequest
}

// SignTransaction validates, signs, and optionally broadcasts an EVM transaction request.
func SignTransaction(
	args SignTransactionArgs,
	client rpcclient.Interface,
	signingConfiguration *signing.Configuration,
	connectKeystore func() (keystorePkg.Keystore, error),
	pending *PendingTransactions,
	log *logrus.Entry,
) (*types.Transaction, error) {
	proposedTx := args.Transaction

	if signingConfiguration == nil {
		return nil, errp.New("account must be initialized")
	}
	expectedSender := crypto.PubkeyToAddress(*signingConfiguration.PublicKey().ToECDSA())
	if expectedSender != proposedTx.From {
		return nil, errp.New("transaction from address does not match account")
	}

	if !slices.Contains(supportedEVMChains, args.ChainID) {
		return nil, errp.New("unsupported EVM network")
	}

	if pending != nil && (pending.chainID != args.ChainID || pending.sender != expectedSender) {
		return nil, errp.New("pending transactions do not match transaction chain and sender")
	}
	if client == nil {
		return nil, errp.New("EVM chain client is unavailable")
	}

	txData, err := prepareTransaction(args.ChainID, client, proposedTx, log)
	if err != nil {
		return nil, err
	}

	keystore, err := connectKeystore()
	if err != nil {
		return nil, err
	}
	var sender *outgoingSender
	if pending != nil {
		var unlock func()
		sender, unlock, err = pending.outgoing.lock(args.ChainID, expectedSender)
		if err != nil {
			return nil, err
		}
		defer unlock()
		if args.Broadcast || proposedTx.Nonce == nil {
			if err := sender.refresh(client); err != nil {
				return nil, err
			}
		}
	}
	if proposedTx.Nonce != nil {
		txData.Nonce = *proposedTx.Nonce
	} else {
		if sender != nil {
			txData.Nonce, err = sender.nextNonce(client)
		} else {
			txData.Nonce, err = client.PendingNonceAt(context.TODO(), proposedTx.From)
		}
		if err != nil {
			return nil, err
		}
	}
	txProposal := &TxProposal{
		ChainID:          args.ChainID,
		Tx:               types.NewTx(txData),
		Keypath:          signingConfiguration.AbsoluteKeypath(),
		RecipientAddress: proposedTx.RecipientAddress,
	}
	if args.Broadcast && sender != nil {
		// Contract calldata alone cannot identify an ERC20 token. Only check ETH here.
		if err := sender.checkFunds(client, txProposal.Tx, nil); err != nil {
			return nil, err
		}
	}
	if err := keystore.SignTransaction(txProposal); err != nil {
		return nil, err
	}
	if args.Broadcast {
		if err := client.SendTransaction(context.TODO(), txProposal.Tx); err != nil {
			return nil, errp.WithStack(err)
		}
		if pending != nil {
			pending.track(sender, txProposal.Tx)
		}
	}
	return txProposal.Tx, nil
}

// SignTypedMsg signs an Ethereum EIP-712 typed message for a supported EVM chain.
func SignTypedMsg(
	chainID uint64,
	data string,
	signingConfiguration *signing.Configuration,
	connectKeystore func() (keystorePkg.Keystore, error),
) (string, error) {
	if signingConfiguration == nil {
		return "", errp.New("account must be initialized")
	}
	if !slices.Contains(supportedEVMChains, chainID) {
		return "", errp.New("unsupported EVM network")
	}
	keystore, err := connectKeystore()
	if err != nil {
		return "", err
	}
	signature, err := keystore.SignETHTypedMessage(chainID, []byte(data), signingConfiguration.AbsoluteKeypath())
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(signature), nil
}

// prepareTransaction estimates gas and fees using the target-chain client.
// The nonce is assigned before constructing the transaction for signing.
func prepareTransaction(
	chainID uint64,
	client rpcclient.Interface,
	proposedTx TransactionRequest,
	log *logrus.Entry,
) (*types.LegacyTx, error) {
	var gasPrice *big.Int

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

	return &types.LegacyTx{
		To: message.To, Value: message.Value, Gas: gasLimit, GasPrice: gasPrice, Data: message.Data,
	}, nil
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
