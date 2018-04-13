package addresses_test

import (
	"encoding/hex"
	"testing"

	"github.com/shiftdevices/godbb/util/logging"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
	"github.com/stretchr/testify/require"
)

const keyPath = "0/10"

var (
	pkBytes, _      = hex.DecodeString("03c9b80dd4ba5c004d85ed37c9077bbffd3e7315a5a4ca589c9023a9665fb1af1f")
	payToAddrScript = []byte{
		0x76, 0xa9, 0x14, 0xc6, 0xcb, 0xae, 0xc, 0x80, 0xdf, 0x54, 0xc8, 0x85, 0x7d,
		0x56, 0xd6, 0x3a, 0xa2, 0xe5, 0xab, 0xe1, 0xa6, 0x41, 0xb7, 0x88, 0xac}
	pk, _ = btcec.ParsePubKey(pkBytes, btcec.S256())
	net   = &chaincfg.TestNet3Params
	tx1   = &client.TxInfo{
		Height: 10,
		TXHash: client.TXHash(chainhash.HashH([]byte("tx1"))),
		Fee:    nil,
	}
	log = logging.Log.WithGroup("addresses_test")
)

func TestNewAddress(t *testing.T) {
	address := addresses.NewAddress(pk, net, keyPath, addresses.AddressTypeP2PKH, log)
	require.Equal(t, keyPath, address.KeyPath)
	require.Equal(t,
		"mye65xn4WGxC9XgRtaNbyAfWwBqAYLgtKB",
		address.EncodeAddress())
	require.Empty(t, address.History)
	require.True(t, address.IsForNet(net))
}

func TestPkScript(t *testing.T) {
	address := addresses.NewAddress(pk, net, keyPath, addresses.AddressTypeP2PKH, log)
	require.Equal(t, payToAddrScript, address.PkScript())
}

func TestScriptHashHex(t *testing.T) {
	address := addresses.NewAddress(pk, net, keyPath, addresses.AddressTypeP2PKH, log)
	require.Equal(t,
		"9d7adb4dafdab53b92b59d68378dc2a65585e22dea93f3cefc4598f1a803af40",
		address.ScriptHashHex())
}
