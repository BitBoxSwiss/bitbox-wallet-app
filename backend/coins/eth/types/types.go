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
	"encoding/json"
	"math/big"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

// EthereumTransaction holds information specific to Ethereum.
type EthereumTransaction interface {
	// Gas returns the gas limit for pending tx, and the gas used for confirmed tx.
	Gas() uint64
}

// TransactionWithHeight wraps an outgoing transaction and implements accounts.Transaction.
type TransactionWithHeight struct {
	Transaction *types.Transaction
	// Height is 0 for pending tx.
	Height uint64
}

// MarshalJSON implements json.Marshaler. Used for DB serialization.
func (txh *TransactionWithHeight) MarshalJSON() ([]byte, error) {
	txSerialized, err := rlp.EncodeToBytes(txh.Transaction)
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]interface{}{
		"tx":     txSerialized,
		"height": txh.Height,
	})
}

// UnmarshalJSON implements json.Unmarshaler. Used for DB serialization.
func (txh *TransactionWithHeight) UnmarshalJSON(input []byte) error {
	m := struct {
		TransactionRLP []byte `json:"tx"`
		Height         uint64 `json:"height"`
	}{}
	if err := json.Unmarshal(input, &m); err != nil {
		return err
	}
	txh.Transaction = new(types.Transaction)
	if err := rlp.DecodeBytes(m.TransactionRLP, txh.Transaction); err != nil {
		return err
	}
	txh.Height = m.Height
	return nil
}

// assertion because not implementing the interface fails silently.
var _ EthereumTransaction = &TransactionWithHeight{}

// Fee implements accounts.Transaction.
func (txh *TransactionWithHeight) Fee() *coin.Amount {
	fee := new(big.Int).Mul(big.NewInt(int64(txh.Transaction.Gas())), txh.Transaction.GasPrice())
	amount := coin.NewAmount(fee)
	return &amount
}

// Timestamp implements accounts.Transaction.
func (txh *TransactionWithHeight) Timestamp() *time.Time {
	return nil
}

// ID implements accounts.Transaction.
func (txh *TransactionWithHeight) ID() string {
	return txh.Transaction.Hash().Hex()
}

// NumConfirmations implements accounts.Transaction.
func (txh *TransactionWithHeight) NumConfirmations() int {
	return 0
}

// Type implements accounts.Transaction.
func (txh *TransactionWithHeight) Type() accounts.TxType {
	return accounts.TxTypeSend
}

// Amount implements accounts.Transaction.
func (txh *TransactionWithHeight) Amount() coin.Amount {
	return coin.NewAmount(txh.Transaction.Value())
}

// Addresses implements accounts.Transaction.
func (txh *TransactionWithHeight) Addresses() []accounts.AddressAndAmount {
	return []accounts.AddressAndAmount{{
		Address: txh.Transaction.To().Hex(),
		Amount:  txh.Amount(),
	}}
}

// Gas implements ethtypes.EthereumTransaction.
func (txh *TransactionWithHeight) Gas() uint64 {
	return txh.Transaction.Gas()
}
