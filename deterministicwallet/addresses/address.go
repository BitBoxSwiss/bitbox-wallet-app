package addresses

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/electrum/client"
)

// Address is a HD address of a wallet, containing the info needed to receive funds on it and to
// spend it.  To receive funds, the Address is used. To sign a spending tx in the context of a HD
// wallet, the keypath to the pubkey is needed as well.
type Address struct {
	btcutil.Address
	PublicKey *btcec.PublicKey
	KeyPath   string
	// History is an ordered list of tx touching this address. It is used to determine if the wallet
	// status changed, and to determine if the address has been used before or not.
	History client.TxHistory
}

// NewAddress creates a new address.
func NewAddress(
	publicKey *btcec.PublicKey,
	net *chaincfg.Params,
	keyPath string,
) *Address {
	pkHash := btcutil.Hash160(publicKey.SerializeCompressed())
	address, err := btcutil.NewAddressPubKeyHash(pkHash, net)
	if err != nil {
		// The only possible failure is a wrong pkHash size, but we are sure we are passing 160
		// bits.
		panic(err)
	}

	return &Address{
		Address:   address,
		PublicKey: publicKey,
		KeyPath:   keyPath,
		History:   client.TxHistory{},
	}
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
