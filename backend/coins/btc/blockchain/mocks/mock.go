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

package mocks

import (
	"errors"

	chainhash "github.com/btcsuite/btcd/chaincfg/chainhash"
	wire "github.com/btcsuite/btcd/wire"
	btcutil "github.com/btcsuite/btcutil"
	blockchain "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
)

// BlockchainMock implements blockchain.Interface for use in tests.
type BlockchainMock struct {
	MockScriptHashGetHistory func(blockchain.ScriptHashHex, func(blockchain.TxHistory), func(error))
	MockTransactionGet       func(chainhash.Hash) (*wire.MsgTx, error)
	MockScriptHashSubscribe  func(func() func(error), blockchain.ScriptHashHex, func(string))
	MockHeadersSubscribe     func(func() func(error), func(*blockchain.Header))
	MockTransactionBroadcast func(*wire.MsgTx) error
	MockRelayFee             func(func(btcutil.Amount), func(error))
	MockEstimateFee          func(int, func(*btcutil.Amount), func(error))
	MockHeaders              func(int, int, func([]*wire.BlockHeader, int))
	MockGetMerkle            func(chainhash.Hash, int, func(merkle []blockchain.TXHash, pos int), func(error))
	MockClose                func()
	MockConnectionError      func() error

	MockRegisterOnConnectionErrorChangedEvent func(func(error))
}

// ScriptHashGetHistory implements Interface.
func (b *BlockchainMock) ScriptHashGetHistory(s blockchain.ScriptHashHex, success func(blockchain.TxHistory), cleanup func(error)) {
	if b.MockScriptHashGetHistory != nil {
		b.MockScriptHashGetHistory(s, success, cleanup)
	}
}

// TransactionGet implements Interface.
func (b *BlockchainMock) TransactionGet(h chainhash.Hash) (*wire.MsgTx, error) {
	if b.MockTransactionGet != nil {
		return b.MockTransactionGet(h)
	}
	panic("TransactionGet not mocked")
}

// ScriptHashSubscribe implements Interface.
func (b *BlockchainMock) ScriptHashSubscribe(setupAndTeardown func() func(error), s blockchain.ScriptHashHex, success func(string)) {
	if b.MockScriptHashSubscribe != nil {
		b.MockScriptHashSubscribe(setupAndTeardown, s, success)
	}
}

// HeadersSubscribe implements Interface.
func (b *BlockchainMock) HeadersSubscribe(setupAndTeardown func() func(error), success func(*blockchain.Header)) {
	if b.MockHeadersSubscribe != nil {
		b.MockHeadersSubscribe(setupAndTeardown, success)
	}
}

// TransactionBroadcast implements Interface.
func (b *BlockchainMock) TransactionBroadcast(msgTx *wire.MsgTx) error {
	if b.MockTransactionBroadcast != nil {
		return b.MockTransactionBroadcast(msgTx)
	}
	return nil
}

// RelayFee implements Interface.
func (b *BlockchainMock) RelayFee(success func(btcutil.Amount), cleanup func(error)) {
	if b.MockRelayFee != nil {
		b.MockRelayFee(success, cleanup)
	}
}

// EstimateFee implements Interface.
func (b *BlockchainMock) EstimateFee(i int, success func(*btcutil.Amount), cleanup func(error)) {
	if b.MockEstimateFee != nil {
		b.MockEstimateFee(i, success, cleanup)
	}
}

// Headers implements Interface.
func (b *BlockchainMock) Headers(i1 int, i2 int, success func([]*wire.BlockHeader, int)) {
	if b.MockHeaders != nil {
		b.MockHeaders(i1, i2, success)
	} else {
		success([]*wire.BlockHeader{}, 1)
	}
}

// GetMerkle implements Interface.
func (b *BlockchainMock) GetMerkle(h chainhash.Hash, i int, success func(merkle []blockchain.TXHash, pos int), cleanup func(error)) {
	if b.MockGetMerkle != nil {
		b.MockGetMerkle(h, i, success, cleanup)
	}
}

// Close implements Interface.
func (b *BlockchainMock) Close() {
	if b.MockClose != nil {
		b.MockClose()
	}
}

// ConnectionError implements Interface.
func (b *BlockchainMock) ConnectionError() error {
	if b.MockConnectionError != nil {
		return b.MockConnectionError()
	}
	return errors.New("disconnected")
}

// RegisterOnConnectionErrorChangedEvent implements Interface.
func (b *BlockchainMock) RegisterOnConnectionErrorChangedEvent(f func(error)) {
	b.MockRegisterOnConnectionErrorChangedEvent(f)
}
