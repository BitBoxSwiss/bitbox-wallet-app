// SPDX-License-Identifier: Apache-2.0

package maketx

import (
	"math/rand"
	"testing"

	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

func TestShuffleTxInputsAndOutputs(t *testing.T) {
	// Create transaction inputs and outputs
	txIns := []*wire.TxIn{
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x01}, Index: 0}, nil, nil),
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x02}, Index: 0}, nil, nil),
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x03}, Index: 0}, nil, nil),
	}
	txOuts := []*wire.TxOut{
		{Value: 1000000, PkScript: []byte{}},
		{Value: 2000000, PkScript: []byte{}},
		{Value: 3000000, PkScript: []byte{}},
	}

	// Create a new transaction and add inputs and outputs
	tx := wire.NewMsgTx(wire.TxVersion)
	tx.TxIn = txIns
	tx.TxOut = txOuts
	// Shuffle with constant seed
	testRand := rand.New(rand.NewSource(1000))
	shuffleTxInputsAndOutputs(tx, testRand)
	// Expected sorted inputs and outputs
	expectedSortedIns := []*wire.TxIn{
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x02}, Index: 0}, nil, nil),
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x01}, Index: 0}, nil, nil),
		wire.NewTxIn(&wire.OutPoint{Hash: [32]byte{0x03}, Index: 0}, nil, nil),
	}
	expectedSortedOuts := []*wire.TxOut{
		{Value: 3000000, PkScript: []byte{}},
		{Value: 1000000, PkScript: []byte{}},
		{Value: 2000000, PkScript: []byte{}},
	}

	// Compare the shuffled inputs and outputs with the expected sorted ones
	require.Equal(t, expectedSortedIns, tx.TxIn, "The transaction inputs were not successfully shuffled.")
	require.Equal(t, expectedSortedOuts, tx.TxOut, "The transaction outputs were not successfully shuffled.")
}
