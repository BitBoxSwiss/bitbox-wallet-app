// Copyright 2023 Shift Crypto AG
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

package electrum

import (
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/BitBoxSwiss/block-client-go/failover"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
)

// failoverClient is an Electrum client that is backed by multiple servers. If a server fails, there
// is an automatic failover to another server. If all servers fail, there is a retry timeout and all
// servers are tried again. Subscriptions are automatically re-subscribed on new servers.
type failoverClient struct {
	failover *failover.Failover[*client]

	connectionError                   error
	onConnectionErrorChangedCallbacks []func(error)
	// covers connectionError and onConnectionErrorChangedCallbacks.
	mu sync.RWMutex
}

// newFailoverClient creates a new failover client.
func newFailoverClient(opts *failover.Options[*client]) *failoverClient {
	return &failoverClient{
		failover:                          failover.New[*client](opts),
		onConnectionErrorChangedCallbacks: []func(error){},
	}
}

func (f *failoverClient) setConnectionError(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err != f.connectionError {
		f.connectionError = err
		for _, callback := range f.onConnectionErrorChangedCallbacks {
			go callback(err)
		}
	}
}

func (f *failoverClient) ConnectionError() error {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.connectionError
}

func (f *failoverClient) RegisterOnConnectionErrorChangedEvent(callback func(error)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.onConnectionErrorChangedCallbacks = append(f.onConnectionErrorChangedCallbacks, callback)
}

func (f *failoverClient) EstimateFee(number int) (btcutil.Amount, error) {
	return failover.Call(f.failover, func(c *client) (btcutil.Amount, error) {
		return c.EstimateFee(number)
	})
}

func (f *failoverClient) GetMerkle(txHash chainhash.Hash, height int) (*blockchain.GetMerkleResult, error) {
	return failover.Call(f.failover, func(c *client) (*blockchain.GetMerkleResult, error) {
		return c.GetMerkle(txHash, height)
	})
}

func (f *failoverClient) Headers(startHeight int, count int) (*blockchain.HeadersResult, error) {
	return failover.Call(f.failover, func(c *client) (*blockchain.HeadersResult, error) {
		return c.Headers(startHeight, count)
	})
}

func (f *failoverClient) HeadersSubscribe(result func(header *types.Header)) {
	failover.Subscribe(
		f.failover,
		func(c *client, result func(*types.Header, error)) {
			c.HeadersSubscribe(func(header *types.Header, err error) {
				result(header, err)
			})
		},
		func(header *types.Header, err error) {
			if err != nil {
				// Can only happen if the failover client is closed.
				return
			}
			result(header)
		})
}

func (f *failoverClient) RelayFee() (btcutil.Amount, error) {
	return failover.Call(f.failover, func(c *client) (btcutil.Amount, error) {
		return c.RelayFee()
	})
}

func (f *failoverClient) ScriptHashGetHistory(scriptHashHex blockchain.ScriptHashHex) (blockchain.TxHistory, error) {
	return failover.Call(f.failover, func(c *client) (blockchain.TxHistory, error) {
		return c.ScriptHashGetHistory(scriptHashHex)
	})
}

func (f *failoverClient) ScriptHashSubscribe(
	setupAndTeardown func() func(),
	scriptHashHex blockchain.ScriptHashHex,
	result func(status string)) {
	failover.Subscribe(
		f.failover,
		// This is called the first time `ScriptHashSubscribe()` is called for the current server,
		// and again everytime a new server is connected (failover).
		func(c *client, result func(string, error)) {
			// Do something before and after subscribing on a server.
			teardown := setupAndTeardown()
			// The callback will be called once after subscribing and then more times when the server pushes
			// notifications. We teardown the subscription setup once.
			once := sync.Once{}
			c.ScriptHashSubscribe(scriptHashHex, func(status string, err error) {
				defer once.Do(teardown)
				result(status, err)
			})
		},
		func(status string, err error) {
			if err != nil {
				// Can only happen if the failover client is closed.
				return
			}
			result(status)
		})
}

func (f *failoverClient) TransactionBroadcast(transaction *wire.MsgTx) error {
	_, err := failover.Call(f.failover, func(c *client) (struct{}, error) {
		return struct{}{}, c.TransactionBroadcast(transaction)
	})
	return err
}

func (f *failoverClient) TransactionGet(txHash chainhash.Hash) (*wire.MsgTx, error) {
	return failover.Call(f.failover, func(c *client) (*wire.MsgTx, error) {
		return c.TransactionGet(txHash)
	})
}

func (f *failoverClient) Close() {
	f.failover.Close()
}
