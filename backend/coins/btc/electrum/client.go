// SPDX-License-Identifier: Apache-2.0

package electrum

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/block-client-go/electrum"
	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
)

// client wraps electrum.Client to convert some method inputs and outputs to btcd/btcutil types. It
// also implements blockchain.Interface.
type client struct {
	client *electrum.Client
}

func (c *client) EstimateFee(number int) (btcutil.Amount, error) {
	fee, err := c.client.EstimateFee(context.Background(), number)
	if err != nil {
		return 0, err
	}
	return btcutil.NewAmount(fee)
}

func (c *client) GetMerkle(txHash chainhash.Hash, height int) (*blockchain.GetMerkleResult, error) {
	result, err := c.client.GetMerkle(context.Background(), txHash.String(), height)
	if err != nil {
		return nil, err
	}
	merkle := make([]blockchain.TXHash, len(result.Merkle))
	for i, s := range result.Merkle {
		t, err := chainhash.NewHashFromStr(s)
		if err != nil {
			return nil, err
		}
		merkle[i] = blockchain.TXHash(*t)
	}
	return &blockchain.GetMerkleResult{Merkle: merkle, Pos: result.Pos}, nil
}

func (c *client) Headers(startHeight int, count int) (*blockchain.HeadersResult, error) {
	headersResult, err := c.client.Headers(context.Background(), startHeight, count)
	if err != nil {
		return nil, err
	}
	headers := make([]*wire.BlockHeader, len(headersResult.Headers))
	for i, h := range headersResult.Headers {
		header := &wire.BlockHeader{}
		err := header.Deserialize(bytes.NewReader(h))
		if err != nil {
			return nil, err
		}
		headers[i] = header
	}
	return &blockchain.HeadersResult{Headers: headers, Max: headersResult.Max}, nil
}

func (c *client) HeadersSubscribe(result func(*types.Header, error)) {
	c.client.HeadersSubscribe(context.Background(), result)
}

func (c *client) RelayFee() (btcutil.Amount, error) {
	fee, err := c.client.RelayFee(context.Background())
	if err != nil {
		return 0, err
	}
	return btcutil.NewAmount(fee)
}

func (c *client) ScriptHashGetHistory(scriptHashHex blockchain.ScriptHashHex) (
	blockchain.TxHistory, error) {
	historyA, err := c.client.ScriptHashGetHistory(context.Background(), string(scriptHashHex))
	if err != nil {
		return nil, err
	}
	history := blockchain.TxHistory{}
	for _, t := range historyA {
		txHash, err := chainhash.NewHashFromStr(t.TxHash)
		if err != nil {
			return nil, err
		}
		history = append(history, &blockchain.TxInfo{
			Height: t.Height,
			TXHash: blockchain.TXHash(*txHash),
		})
	}
	return history, nil
}

func (c *client) ScriptHashSubscribe(
	scriptHashHex blockchain.ScriptHashHex,
	success func(string, error),
) {
	c.client.ScriptHashSubscribe(context.Background(), string(scriptHashHex), success)
}

func (c *client) TransactionBroadcast(transaction *wire.MsgTx) error {
	rawTx := &bytes.Buffer{}
	_ = transaction.BtcEncode(rawTx, 0, wire.WitnessEncoding)
	rawTxHex := hex.EncodeToString(rawTx.Bytes())
	txID, err := c.client.TransactionBroadcast(context.Background(), rawTxHex)
	if err != nil {
		// Return a new error, stripping the rawTxHex from it, if it is there.
		return errors.New(strings.ReplaceAll(err.Error(), fmt.Sprintf("[%s]", rawTxHex), ""))
	}
	if txID != transaction.TxHash().String() {
		return errp.New("Response is unexpected (transaction hash mismatch)")
	}
	return nil
}

func (c *client) TransactionGet(txHash chainhash.Hash) (*wire.MsgTx, error) {
	rawTx, err := c.client.TransactionGet(context.Background(), txHash.String())
	if err != nil {
		return nil, err
	}

	tx := &wire.MsgTx{}
	if err := tx.BtcDecode(bytes.NewReader(rawTx), 0, wire.WitnessEncoding); err != nil {
		return nil, err
	}
	return tx, nil
}

func (c *client) SetOnError(f func(error)) {
	c.client.SetOnError(f)
}

func (c *client) Close() {
	c.client.Close()
}
