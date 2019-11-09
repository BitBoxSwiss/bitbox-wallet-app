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
	chainhash "github.com/btcsuite/btcd/chaincfg/chainhash"
	wire "github.com/btcsuite/btcd/wire"
	btcutil "github.com/btcsuite/btcutil"
	blockchain "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
)

// BlockchainMock implements blockchain.Interface for use in tests.
type BlockchainMock struct {
	scriptHashGetHistory func(blockchain.ScriptHashHex, func(blockchain.TxHistory) error, func(error))
	transactionGet       func(chainhash.Hash, func(*wire.MsgTx) error, func(error))
	scriptHashSubscribe  func(func() func(error), blockchain.ScriptHashHex, func(string) error)
	headersSubscribe     func(func() func(error), func(*blockchain.Header) error)
	transactionBroadcast func(*wire.MsgTx) error
	relayFee             func(func(btcutil.Amount), func(error))
	estimateFee          func(int, func(*btcutil.Amount) error, func(error))
	headers              func(int, int, func([]*wire.BlockHeader, int))
	getMerkle            func(chainhash.Hash, int, func(merkle []blockchain.TXHash, pos int) error, func(error))
	close                func()
	connectionStatus     func() blockchain.Status

	registerOnConnectionStatusChangedEvent func(func(blockchain.Status))
}

// ScriptHashGetHistory implements Interface.
func (b *BlockchainMock) ScriptHashGetHistory(s blockchain.ScriptHashHex, success func(blockchain.TxHistory) error, cleanup func(error)) {
	if b.scriptHashGetHistory != nil {
		b.scriptHashGetHistory(s, success, cleanup)
	}
}

// TransactionGet implements Interface.
func (b *BlockchainMock) TransactionGet(h chainhash.Hash, success func(*wire.MsgTx) error, cleanup func(error)) {
	if b.transactionGet != nil {
		b.transactionGet(h, success, cleanup)
	}
}

// ScriptHashSubscribe implements Interface.
func (b *BlockchainMock) ScriptHashSubscribe(setupAndTeardown func() func(error), s blockchain.ScriptHashHex, success func(string) error) {
	if b.scriptHashSubscribe != nil {
		b.scriptHashSubscribe(setupAndTeardown, s, success)
	}
}

// HeadersSubscribe implements Interface.
func (b *BlockchainMock) HeadersSubscribe(setupAndTeardown func() func(error), success func(*blockchain.Header) error) {
	if b.headersSubscribe != nil {
		b.headersSubscribe(setupAndTeardown, success)
	}
}

// TransactionBroadcast implements Interface.
func (b *BlockchainMock) TransactionBroadcast(msgTx *wire.MsgTx) error {
	if b.transactionBroadcast != nil {
		return b.transactionBroadcast(msgTx)
	}
	return nil
}

// RelayFee implements Interface.
func (b *BlockchainMock) RelayFee(success func(btcutil.Amount), cleanup func(error)) {
	if b.relayFee != nil {
		b.relayFee(success, cleanup)
	}
}

// EstimateFee implements Interface.
func (b *BlockchainMock) EstimateFee(i int, success func(*btcutil.Amount) error, cleanup func(error)) {
	if b.estimateFee != nil {
		b.estimateFee(i, success, cleanup)
	}
}

// Headers implements Interface.
func (b *BlockchainMock) Headers(i1 int, i2 int, success func([]*wire.BlockHeader, int)) {
	if b.headers != nil {
		b.headers(i1, i2, success)
	} else {
		success([]*wire.BlockHeader{}, 1)
	}
}

// GetMerkle implements Interface.
func (b *BlockchainMock) GetMerkle(h chainhash.Hash, i int, success func(merkle []blockchain.TXHash, pos int) error, cleanup func(error)) {
	if b.getMerkle != nil {
		b.getMerkle(h, i, success, cleanup)
	}
}

// Close implements Interface.
func (b *BlockchainMock) Close() {
	if b.close != nil {
		b.close()
	}
}

// ConnectionStatus implements Interface.
func (b *BlockchainMock) ConnectionStatus() blockchain.Status {
	if b.connectionStatus != nil {
		return b.connectionStatus()
	}
	return blockchain.DISCONNECTED
}

// RegisterOnConnectionStatusChangedEvent implements Interface.
func (b *BlockchainMock) RegisterOnConnectionStatusChangedEvent(f func(blockchain.Status)) {
	b.registerOnConnectionStatusChangedEvent(f)
}
