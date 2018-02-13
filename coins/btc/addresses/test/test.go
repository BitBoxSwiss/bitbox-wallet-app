package test

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
)

// NewAddressChain returns an AddressChain for convenience in testing.
func NewAddressChain() *addresses.AddressChain {
	net := &chaincfg.TestNet3Params
	xprv, err := hdkeychain.NewMaster(make([]byte, hdkeychain.RecommendedSeedLen), net)
	if err != nil {
		panic(err)
	}
	xpub, err := xprv.Neuter()
	if err != nil {
		panic(err)
	}
	return addresses.NewAddressChain(xpub, net, 20, 0, addresses.AddressTypeP2PKH)
}
