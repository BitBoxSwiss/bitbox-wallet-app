// SPDX-License-Identifier: Apache-2.0

package blockchain

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/stretchr/testify/require"
)

func TestStatus(t *testing.T) {
	history := TxHistory{}
	require.Equal(t, "", history.Status())

	tx1 := &TxInfo{
		Height: 10,
		TXHash: TXHash(chainhash.HashH([]byte("tx1"))),
	}
	tx2 := &TxInfo{
		Height: 12,
		TXHash: TXHash(chainhash.HashH([]byte("tx2"))),
	}

	history = []*TxInfo{tx1}
	require.Equal(t,
		"5ac1b066322843c5cb9160e8079dd759eddf6f1fd60645d6bf54942dcba00d09",
		history.Status())

	history = []*TxInfo{tx1, tx2}
	require.Equal(t,
		"9783fa8a2f1c89652022e0bb435f302ee8b856961dd979ee083435c65384f314",
		history.Status())
}
