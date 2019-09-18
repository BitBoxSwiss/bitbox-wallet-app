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
	"time"

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

// EthereumTransaction holds information specific to Ethereum.
type EthereumTransaction interface {
	// Gas returns the gas limit for pending tx, and the gas used for confirmed tx.
	Gas() uint64
}

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
}

// MarshalJSON implements json.Marshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) MarshalJSON() ([]byte, error) {
	txSerialized, err := rlp.EncodeToBytes(txh.Transaction)
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]interface{}{
		"tx":      txSerialized,
		"height":  txh.Height,
		"gasUsed": hexutil.Uint64(txh.GasUsed),
		"success": txh.Success,
	})
}

// UnmarshalJSON implements json.Unmarshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) UnmarshalJSON(input []byte) error {
	m := struct {
		TransactionRLP []byte         `json:"tx"`
		Height         uint64         `json:"height"`
		GasUsed        hexutil.Uint64 `json:"gasUsed"`
		Success        bool           `json:"success"`
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
	return nil
}

// Fee implements accounts.Transaction.
func (txh *TransactionWithMetadata) Fee() *coin.Amount {
	fee := new(big.Int).Mul(big.NewInt(int64(txh.Transaction.Gas())), txh.Transaction.GasPrice())
	amount := coin.NewAmount(fee)
	return &amount
}

// Timestamp implements accounts.Transaction.
func (txh *TransactionWithMetadata) Timestamp() *time.Time {
	return nil
}

// ID implements accounts.Transaction.
func (txh *TransactionWithMetadata) ID() string {
	return txh.Transaction.Hash().Hex()
}

// Type implements accounts.Transaction.
func (txh *TransactionWithMetadata) Type() accounts.TxType {
	return accounts.TxTypeSend
}

// Amount implements accounts.Transaction.
func (txh *TransactionWithMetadata) Amount() coin.Amount {
	return coin.NewAmount(txh.Transaction.Value())
}

// Addresses implements accounts.Transaction.
func (txh *TransactionWithMetadata) Addresses() []accounts.AddressAndAmount {
	return []accounts.AddressAndAmount{{
		Address: txh.Transaction.To().Hex(),
		Amount:  txh.Amount(),
	}}
}

// Gas implements ethtypes.EthereumTransaction.
func (txh *TransactionWithMetadata) Gas() uint64 {
	if txh.Height == 0 {
		return txh.Transaction.Gas()
	}
	return txh.GasUsed
}

// NewTransactionWithConfirmations creates a tx with additional data needed to be able to display it
// in the frontend.
func NewTransactionWithConfirmations(
	tx *TransactionWithMetadata,
	tipHeight uint64,
	erc20Token *erc20.Token) *TransactionWithConfirmations {
	data := tx.Transaction.Data()
	if erc20Token == nil && len(data) > 0 {
		panic("invalid config")
	}
	if erc20Token != nil {
		if *tx.Transaction.To() != erc20Token.ContractAddress() ||
			len(data) != 68 ||
			!bytes.Equal(data[:4], []byte{0xa9, 0x05, 0x9c, 0xbb}) ||
			tx.Transaction.Value().Cmp(big.NewInt(0)) != 0 {
			panic("invalid erc20 tx")
		}
	}
	return &TransactionWithConfirmations{
		TransactionWithMetadata: *tx,
		tipHeight:               tipHeight,
		erc20Token:              erc20Token,
	}
}

// TransactionWithConfirmations also stores the current tip height so NumConfirmations() can be
// computed.
type TransactionWithConfirmations struct {
	TransactionWithMetadata
	tipHeight  uint64
	erc20Token *erc20.Token
}

// NumConfirmations implements accounts.Transaction.
func (txh *TransactionWithConfirmations) NumConfirmations() int {
	confs := 0
	if txh.Height > 0 {
		confs = int(txh.tipHeight - txh.Height + 1)
	}
	return confs
}

// Status implements accounts.Transaction.
func (txh *TransactionWithConfirmations) Status() accounts.TxStatus {
	if txh.NumConfirmations() == 0 {
		return accounts.TxStatusPending
	}
	if !txh.Success {
		return accounts.TxStatusFailed
	}
	if txh.NumConfirmations() >= NumConfirmationsComplete {
		return accounts.TxStatusComplete
	}
	return accounts.TxStatusPending
}

// Amount implements accounts.Transaction.
func (txh *TransactionWithConfirmations) Amount() coin.Amount {
	if txh.erc20Token != nil {
		data := txh.Transaction.Data()
		return coin.NewAmount(new(big.Int).SetBytes(data[len(data)-32:]))
	}
	return txh.TransactionWithMetadata.Amount()
}

// Addresses implements accounts.Transaction.
func (txh *TransactionWithConfirmations) Addresses() []accounts.AddressAndAmount {
	if txh.erc20Token != nil {
		data := txh.Transaction.Data()
		// ERC20 transfer.
		return []accounts.AddressAndAmount{{
			Address: common.BytesToAddress(data[4+32-common.AddressLength : 4+32]).Hex(),
			Amount:  txh.Amount(),
		}}
	}

	return txh.TransactionWithMetadata.Addresses()
}

// assertion because not implementing the interface fails silently.
var _ EthereumTransaction = &TransactionWithMetadata{}
var _ EthereumTransaction = &TransactionWithConfirmations{}
