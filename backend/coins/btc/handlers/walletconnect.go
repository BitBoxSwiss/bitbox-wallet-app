// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/hex"
	"encoding/json"
	"math/big"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

type walletConnectTransactionRequest struct {
	From     string          `json:"from"`
	To       string          `json:"to"`
	Data     string          `json:"data"`
	Input    json.RawMessage `json:"input,omitempty"`
	Gas      string          `json:"gas,omitempty"`
	GasPrice string          `json:"gasPrice,omitempty"`
	Value    string          `json:"value,omitempty"`
	Nonce    string          `json:"nonce,omitempty"`
	ChainID  json.RawMessage `json:"chainId,omitempty"`
}

func parseWalletConnectTransactionRequest(
	requestChainID uint64,
	request walletConnectTransactionRequest,
) (eth.TransactionRequest, error) {
	if request.Input != nil {
		return eth.TransactionRequest{}, errp.New("transaction input field is unsupported; use data")
	}
	if request.ChainID != nil {
		var transactionChainID hexutil.Uint64
		if err := transactionChainID.UnmarshalJSON(request.ChainID); err != nil {
			return eth.TransactionRequest{}, errp.WithStack(err)
		}
		if uint64(transactionChainID) != requestChainID {
			return eth.TransactionRequest{}, errp.New("transaction chain ID does not match request chain")
		}
	}
	if !eth.IsValidEthAddress(request.From) || !eth.IsValidEthAddress(request.To) {
		return eth.TransactionRequest{}, errp.WithStack(errors.ErrInvalidAddress)
	}

	var nonce *uint64
	if request.Nonce != "" {
		parsedNonce, err := strconv.ParseUint(strings.TrimPrefix(request.Nonce, "0x"), 16, 64)
		if err != nil {
			return eth.TransactionRequest{}, errp.WithStack(err)
		}
		nonce = &parsedNonce
	}

	value := new(big.Int)
	if request.Value != "" {
		parsedValue, ok := new(big.Int).SetString(strings.TrimPrefix(request.Value, "0x"), 16)
		if !ok {
			return eth.TransactionRequest{}, errp.New("error setting transaction value")
		}
		value = parsedValue
	}

	data, err := hex.DecodeString(strings.TrimPrefix(request.Data, "0x"))
	if err != nil {
		return eth.TransactionRequest{}, errp.WithStack(err)
	}

	return eth.TransactionRequest{
		From:             ethcommon.HexToAddress(request.From),
		Recipient:        ethcommon.HexToAddress(request.To),
		RecipientAddress: request.To,
		Data:             data,
		Value:            value,
		Nonce:            nonce,
	}, nil
}
