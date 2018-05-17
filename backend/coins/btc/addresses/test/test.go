package test

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/logging"
)

const xpub = "tpubDCxoQyC5JaGydxN3yprM6sgqgu65LruN3JBm1fnSmGxXR3AcuNwr" +
	"E7J2CVaCvuLPJtJNySjshNsYbR96Y7yfEdcywYqWubzUQLVGh2b4mF9"

var (
	net             = &chaincfg.TestNet3Params
	absoluteKeypath = signing.NewEmptyAbsoluteKeypath().Child(0, false).Child(10, false)
)

// NewAddressChain returns an AddressChain for convenience in testing.
func NewAddressChain() *addresses.AddressChain {
	log := logging.Log.WithGroup("addresses_test")
	xprv, err := hdkeychain.NewMaster(make([]byte, hdkeychain.RecommendedSeedLen), net)
	if err != nil {
		panic(err)
	}
	xpub, err := xprv.Neuter()
	if err != nil {
		panic(err)
	}
	derivationPath, err := signing.NewAbsoluteKeypath("m/44'/1'")
	if err != nil {
		panic(err)
	}
	configuration := signing.NewConfiguration(derivationPath, []*hdkeychain.ExtendedKey{xpub}, 1)
	return addresses.NewAddressChain(configuration, net, 20, 0, addresses.AddressTypeP2PKH, log)
}

// GetAddress returns a dummy address for a given address type.
func GetAddress(addressType addresses.AddressType) *addresses.AccountAddress {
	extendedPublicKey, err := hdkeychain.NewKeyFromString(xpub)
	if err != nil {
		panic(err)
	}
	configuration := signing.NewSinglesigConfiguration(absoluteKeypath, extendedPublicKey)
	return addresses.NewAccountAddress(
		configuration,
		addressType,
		net,
		logging.Log.WithGroup("addresses_test"),
	)
}
