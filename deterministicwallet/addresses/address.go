package addresses

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/electrum/client"
)

// Address is a HD address of a wallet, containing the public key, derivation keypath, and
// transaction history.
type Address struct {
	btcutil.Address
	PublicKey *btcec.PublicKey
	KeyPath   string
	History   []*client.TX
}

// NewAddress creates a new address.
func NewAddress(
	address btcutil.Address,
	publicKey *btcec.PublicKey,
	keyPath string,
) *Address {
	return &Address{
		Address:   address,
		PublicKey: publicKey,
		KeyPath:   keyPath,
		History:   []*client.TX{},
	}
}

// Status encodes the status of the address history as a hash, according to the Electrum
// specification.
// https://github.com/kyuupichan/electrumx/blob/b01139bb93a7b0cfbd45b64e170223f4871a4a87/docs/PROTOCOL.rst#blockchainaddresssubscribe
func (address *Address) Status() string {
	if len(address.History) == 0 {
		return ""
	}
	status := bytes.Buffer{}
	for _, tx := range address.History {
		status.WriteString(fmt.Sprintf("%s:%d:", tx.TXHash.Hash().String(), tx.Height))
	}
	return hex.EncodeToString(chainhash.HashB(status.Bytes()))
}

func (address *Address) isUsed() bool {
	return len(address.History) != 0
}

// PkScript returns the pubkey script of this address. Use this in a tx output to receive funds.
func (address *Address) PkScript() []byte {
	script, err := txscript.PayToAddrScript(address.Address)
	if err != nil {
		// Can't fail.
		panic(err)
	}
	return script
}

// ScriptHash returns the hash of the output script. Used to subscribe to notifications with
// Electrum.
func (address *Address) ScriptHash() string {
	return chainhash.HashH(address.PkScript()).String()
}
