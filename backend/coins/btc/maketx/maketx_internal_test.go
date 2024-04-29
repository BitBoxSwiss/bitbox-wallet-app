// Copyright 2024 Shift Crypto AG
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
