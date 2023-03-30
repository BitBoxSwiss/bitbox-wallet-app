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

	btcutil "github.com/btcsuite/btcd/btcutil"
	chainhash "github.com/btcsuite/btcd/chaincfg/chainhash"
	wire "github.com/btcsuite/btcd/wire"
	blockchain "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/block-client-go/electrum/types"
)

// BlockchainMock implements blockchain.Interface for use in tests.
type BlockchainMock struct {
	MockScriptHashGetHistory func(blockchain.ScriptHashHex) (blockchain.TxHistory, error)
	MockTransactionGet       func(chainhash.Hash) (*wire.MsgTx, error)
	MockScriptHashSubscribe  func(func() func(), blockchain.ScriptHashHex, func(string))
	MockHeadersSubscribe     func(func(*types.Header))
	MockTransactionBroadcast func(*wire.MsgTx) error
	MockRelayFee             func() (btcutil.Amount, error)
	MockEstimateFee          func(int) (btcutil.Amount, error)
	MockHeaders              func(int, int) (*blockchain.HeadersResult, error)
	MockGetMerkle            func(chainhash.Hash, int) (*blockchain.GetMerkleResult, error)
	MockClose                func()
	MockConnectionError      func() error

	MockRegisterOnConnectionErrorChangedEvent func(func(error))
}

// ScriptHashGetHistory implements Interface.
func (b *BlockchainMock) ScriptHashGetHistory(s blockchain.ScriptHashHex) (blockchain.TxHistory, error) {
	if b.MockScriptHashGetHistory != nil {
		return b.MockScriptHashGetHistory(s)
	}
	panic("ScriptHashGetHistory not mocked")
}

// TransactionGet implements Interface.
func (b *BlockchainMock) TransactionGet(h chainhash.Hash) (*wire.MsgTx, error) {
	if b.MockTransactionGet != nil {
		return b.MockTransactionGet(h)
	}
	panic("TransactionGet not mocked")
}

// ScriptHashSubscribe implements Interface.
func (b *BlockchainMock) ScriptHashSubscribe(setupAndTeardown func() func(), s blockchain.ScriptHashHex, success func(string)) {
	if b.MockScriptHashSubscribe != nil {
		b.MockScriptHashSubscribe(setupAndTeardown, s, success)
	}
}

// HeadersSubscribe implements Interface.
func (b *BlockchainMock) HeadersSubscribe(success func(*types.Header)) {
	if b.MockHeadersSubscribe != nil {
		b.MockHeadersSubscribe(success)
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
func (b *BlockchainMock) RelayFee() (btcutil.Amount, error) {
	if b.MockRelayFee != nil {
		return b.MockRelayFee()
	}
	panic("not implemented")
}

// EstimateFee implements Interface.
func (b *BlockchainMock) EstimateFee(i int) (btcutil.Amount, error) {
	if b.MockEstimateFee != nil {
		return b.MockEstimateFee(i)
	}
	panic("not implemented")
}

// Headers implements Interface.
func (b *BlockchainMock) Headers(i1 int, i2 int) (*blockchain.HeadersResult, error) {
	if b.MockHeaders != nil {
		return b.MockHeaders(i1, i2)
	}
	return &blockchain.HeadersResult{
		Headers: []*wire.BlockHeader{},
		Max:     1,
	}, nil
}

// GetMerkle implements Interface.
func (b *BlockchainMock) GetMerkle(h chainhash.Hash, i int) (*blockchain.GetMerkleResult, error) {
	if b.MockGetMerkle != nil {
		return b.MockGetMerkle(h, i)
	}
	panic("not implemented")
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
	if b.MockRegisterOnConnectionErrorChangedEvent != nil {
		b.MockRegisterOnConnectionErrorChangedEvent(f)
	}
}
