package addresses

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/electrum/client"
)

// Address is a HD address of a wallet, containing the info needed to receive funds on it and to
// spend it.  To receive funds, the Address is used. To sign a spending tx in the context of a HD
// wallet, the keypath to the pubkey is needed as well.
type Address struct {
	btcutil.Address
	publicKey *btcec.PublicKey
	KeyPath   string
	// History is an ordered list of tx touching this address. It is used to determine if the wallet
	// status changed, and to determine if the address has been used before or not.
	History client.TxHistory
	// p2shScript is the redeem script of a BIP16 P2SH output. Nil if this output is not a P2SH
	// output.
	p2shScript  []byte
	addressType AddressType
}

type AddressType string

const (
	// AddressTypeP2PKH is a PayToPubKeyHash output.
	AddressTypeP2PKH = "p2pkh"

	// AddressTypeP2WPKHP2SH is a segwit PayToPubKeyHash output wrapped in p2sh.
	AddressTypeP2WPKHP2SH = "p2wpkh-p2sh"
)

// NewAddress creates a new address.
func NewAddress(
	publicKey *btcec.PublicKey,
	net *chaincfg.Params,
	keyPath string,
	addressType AddressType,
) *Address {
	pkHash := btcutil.Hash160(publicKey.SerializeCompressed())

	var address btcutil.Address
	var script []byte
	switch addressType {
	case AddressTypeP2PKH:
		var err error
		address, err = btcutil.NewAddressPubKeyHash(pkHash, net)
		if err != nil {
			// The only possible failure is a wrong pkHash size, but we are sure we are passing 160
			// bits.
			panic(err)
		}
	case AddressTypeP2WPKHP2SH:
		swAddress, err := btcutil.NewAddressWitnessPubKeyHash(pkHash, net)
		if err != nil {
			// The only possible failure is a wrong pkHash size, but we are sure we are passing 160
			// bits.
			panic(err)
		}
		script, err = txscript.PayToAddrScript(swAddress)
		if err != nil {
			panic(err)
		}
		address, err = btcutil.NewAddressScriptHash(script, net)
		if err != nil {
			panic(err)
		}
	default:
		panic("unrecognized address type")
	}

	return &Address{
		Address:     address,
		publicKey:   publicKey,
		KeyPath:     keyPath,
		History:     client.TxHistory{},
		addressType: addressType,
		p2shScript:  script,
	}
}

func (address *Address) isUsed() bool {
	return len(address.History) != 0
}

// PkScript returns the pubkey script of this address. Use this in a tx output to receive funds.
func (address *Address) PkScript() []byte {
	script, err := txscript.PayToAddrScript(address.Address)
	if err != nil {
		panic(err)
	}
	return script
}

// ScriptHash returns the hash of the output script. Used to subscribe to notifications with
// Electrum.
func (address *Address) ScriptHash() string {
	return chainhash.HashH(address.PkScript()).String()
}

// SigHashData returns whether this address is a segwit output, and the subScript used when
// calculating the signature hash in a transaction. This info is needed when trying to spend this
// output.
func (address *Address) SigHashData() (bool, []byte) {
	switch address.addressType {
	case AddressTypeP2PKH:
		return false, address.PkScript()
	case AddressTypeP2WPKHP2SH:
		return true, address.p2shScript
	default:
		panic("unrecognized address type")
	}
}

// InputData returns the sigScript/witness needed to spend this output.
func (address *Address) InputData(signature btcec.Signature) ([]byte, wire.TxWitness) {
	switch address.addressType {
	case AddressTypeP2PKH:
		sigScript, err := txscript.NewScriptBuilder().
			AddData(append(signature.Serialize(), byte(txscript.SigHashAll))).
			AddData(address.publicKey.SerializeCompressed()).
			Script()
		if err != nil {
			panic(err)
		}
		return sigScript, nil
	case AddressTypeP2WPKHP2SH:
		sigScript, err := txscript.NewScriptBuilder().
			AddData(address.p2shScript).
			Script()
		if err != nil {
			panic(err)
		}
		witness := wire.TxWitness{
			append(signature.Serialize(), byte(txscript.SigHashAll)),
			address.publicKey.SerializeCompressed()}
		return sigScript, witness
	default:
		panic("unrecognized address type")
	}
}
