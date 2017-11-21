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

type Address struct {
	btcutil.Address
	PublicKey *btcec.PublicKey
	KeyPath   string
	History   []*client.TX
}

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

func (address *Address) PkScript() []byte {
	script, err := txscript.PayToAddrScript(address.Address)
	if err != nil {
		// Can't fail.
		panic(err)
	}
	return script
}

func (address *Address) ScriptHash() string {
	return chainhash.HashH(address.PkScript()).String()
}
