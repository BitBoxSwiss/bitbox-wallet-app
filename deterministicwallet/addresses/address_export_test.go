package addresses

import "github.com/btcsuite/btcd/btcec"

func (address *Address) TstPublicKey() *btcec.PublicKey {
	return address.publicKey
}
