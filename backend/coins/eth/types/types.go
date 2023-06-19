// Copyright 2018 Shift Devices AG
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

package types

import (
	"bytes"
	"encoding/json"
	"math/big"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

// NumConfirmationsComplete indicates after how many confs the tx is considered complete.
const NumConfirmationsComplete = 12

// TransactionWithMetadata wraps an outgoing transaction and implements accounts.Transaction.
type TransactionWithMetadata struct {
	Transaction *types.Transaction
	// Height is 0 for pending tx.
	Height uint64
	// Only applies if Height > 0
	GasUsed uint64
	// Only applies if Height > 0.
	// false if contract execution failed, otherwise true.
	Success bool
	// Number of broadcast attempts.
	BroadcastAttempts uint16
}

// MarshalJSON implements json.Marshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) MarshalJSON() ([]byte, error) {
	txSerialized, err := rlp.EncodeToBytes(txh.Transaction)
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]interface{}{
		"tx":                txSerialized,
		"height":            txh.Height,
		"gasUsed":           hexutil.Uint64(txh.GasUsed),
		"success":           txh.Success,
		"broadcastAttempts": txh.BroadcastAttempts,
	})
}

// UnmarshalJSON implements json.Unmarshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) UnmarshalJSON(input []byte) error {
	m := struct {
		TransactionRLP    []byte         `json:"tx"`
		Height            uint64         `json:"height"`
		GasUsed           hexutil.Uint64 `json:"gasUsed"`
		Success           bool           `json:"success"`
		BroadcastAttempts uint16         `json:"broadcastAttempts"`
	}{}
	if err := json.Unmarshal(input, &m); err != nil {
		return err
	}
	txh.Transaction = new(types.Transaction)
	if err := rlp.DecodeBytes(m.TransactionRLP, txh.Transaction); err != nil {
		return err
	}
	txh.Height = m.Height
	txh.GasUsed = uint64(m.GasUsed)
	txh.Success = m.Success
	txh.BroadcastAttempts = m.BroadcastAttempts
	return nil
}

// TransactionData returns the tx data to be shown to the user.
func (txh *TransactionWithMetadata) TransactionData(
	tipHeight uint64, erc20Token *erc20.Token, accountAddress string) *accounts.TransactionData {
	data := txh.Transaction.Data()
	if erc20Token == nil && len(data) > 0 {
		panic("invalid config")
	}

	amount := coin.NewAmount(txh.Transaction.Value())
	address := txh.Transaction.To().Hex()

	if erc20Token != nil {
		// ERC20 transfer.

		// An ERC20-Token transfer looks like this:
		// - Data is <0xa9059cbb><32 bytes address><32 bytes big endian amount>
		// - Tx value is 0 (contract invocation).
		if *txh.Transaction.To() != erc20Token.ContractAddress() ||
			len(data) != 68 ||
			!bytes.Equal(data[:4], []byte{0xa9, 0x05, 0x9c, 0xbb}) ||
			txh.Transaction.Value().Cmp(big.NewInt(0)) != 0 {
			panic("invalid erc20 tx")
		}
		data := txh.Transaction.Data()
		amount = coin.NewAmount(new(big.Int).SetBytes(data[len(data)-32:]))
		address = common.BytesToAddress(data[4+32-common.AddressLength : 4+32]).Hex()
	}

	numConfirmations := txh.numConfirmations(tipHeight)
	nonce := txh.Transaction.Nonce()

	var txType accounts.TxType
	if address == accountAddress {
		txType = accounts.TxTypeSendSelf
	} else {
		txType = accounts.TxTypeSend
	}

	return &accounts.TransactionData{
		Fee: txh.fee(),
		// ERC20 token transaction pay fees in Ether.
		FeeIsDifferentUnit:       erc20Token != nil,
		IsErc20:                  erc20Token != nil,
		Timestamp:                nil,
		TxID:                     txh.TxID(),
		InternalID:               txh.TxID(),
		Height:                   int(txh.Height),
		NumConfirmations:         numConfirmations,
		NumConfirmationsComplete: NumConfirmationsComplete,
		Status:                   txh.status(numConfirmations),
		Type:                     txType,
		Amount:                   amount,
		Addresses: []accounts.AddressAndAmount{{
			Address: address,
			Amount:  amount,
		}},
		Gas:   txh.gas(),
		Nonce: &nonce,
	}
}

func (txh *TransactionWithMetadata) fee() *coin.Amount {
	fee := new(big.Int).Mul(big.NewInt(int64(txh.Transaction.Gas())), txh.Transaction.GasPrice())
	amount := coin.NewAmount(fee)
	return &amount
}

// TxID returns the transaction ID.
func (txh *TransactionWithMetadata) TxID() string {
	return txh.Transaction.Hash().Hex()
}

func (txh *TransactionWithMetadata) gas() uint64 {
	if txh.Height == 0 {
		return txh.Transaction.Gas()
	}
	return txh.GasUsed
}

func (txh *TransactionWithMetadata) numConfirmations(tipHeight uint64) int {
	confs := 0
	if txh.Height > 0 {
		confs = int(tipHeight - txh.Height + 1)
	}
	return confs
}

func (txh *TransactionWithMetadata) status(numConfirmations int) accounts.TxStatus {
	if numConfirmations == 0 {
		return accounts.TxStatusPending
	}
	if !txh.Success {
		return accounts.TxStatusFailed
	}
	if numConfirmations >= NumConfirmationsComplete {
		return accounts.TxStatusComplete
	}
	return accounts.TxStatusPending
}
