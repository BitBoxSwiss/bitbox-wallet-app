package client_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/stretchr/testify/require"
)

func TestStatus(t *testing.T) {
	history := client.TxHistory{}
	require.Equal(t, "", history.Status())

	tx1 := &client.TX{
		Height: 10,
		TXHash: client.TXHash(chainhash.HashH([]byte("tx1"))),
		Fee:    nil,
	}
	tx2 := &client.TX{
		Height: 12,
		TXHash: client.TXHash(chainhash.HashH([]byte("tx2"))),
		Fee:    nil,
	}

	history = []*client.TX{tx1}
	require.Equal(t,
		"5ac1b066322843c5cb9160e8079dd759eddf6f1fd60645d6bf54942dcba00d09",
		history.Status())

	history = []*client.TX{tx1, tx2}
	require.Equal(t,
		"9783fa8a2f1c89652022e0bb435f302ee8b856961dd979ee083435c65384f314",
		history.Status())
}
