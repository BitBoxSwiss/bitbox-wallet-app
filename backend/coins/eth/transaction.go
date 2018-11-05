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

package eth

import (
	"math/big"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/ethereum/go-ethereum/core/types"
)

// wrappedTransaction wraps an outgoing pending transaction and implements coin.Transaction.
type wrappedTransaction struct {
	tx *types.Transaction
}

// assertion because not implementing the interface fails silently.
var _ ethtypes.EthereumTransaction = wrappedTransaction{}

// Fee implements coin.Transaction.
func (tx wrappedTransaction) Fee() *coin.Amount {
	fee := new(big.Int).Mul(big.NewInt(int64(tx.tx.Gas())), tx.tx.GasPrice())
	amount := coin.NewAmount(fee)
	return &amount
}

// Timestamp implements coin.Transaction.
func (tx wrappedTransaction) Timestamp() *time.Time {
	return nil
}

// ID implements coin.Transaction.
func (tx wrappedTransaction) ID() string {
	return tx.tx.Hash().Hex()
}

// NumConfirmations implements coin.Transaction.
func (tx wrappedTransaction) NumConfirmations() int {
	return 0
}

// Type implements coin.Transaction.
func (tx wrappedTransaction) Type() coin.TxType {
	return coin.TxTypeSend
}

// Amount implements coin.Transaction.
func (tx wrappedTransaction) Amount() coin.Amount {
	return coin.NewAmount(tx.tx.Value())
}

// Addresses implements coin.Transaction.
func (tx wrappedTransaction) Addresses() []string {
	return []string{tx.tx.To().Hex()}
}

// Gas implements ethtypes.EthereumTransaction.
func (tx wrappedTransaction) Gas() uint64 {
	return tx.tx.Gas()
}
