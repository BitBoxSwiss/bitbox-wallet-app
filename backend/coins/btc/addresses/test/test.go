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
	configuration := signing.NewConfiguration(
		signing.ScriptTypeP2PKH, derivationPath, []*hdkeychain.ExtendedKey{xpub}, 1)
	return addresses.NewAddressChain(configuration, net, 20, 0, log)
}

// GetAddress returns a dummy address for a given address type.
func GetAddress(scriptType signing.ScriptType) *addresses.AccountAddress {
	extendedPublicKey, err := hdkeychain.NewKeyFromString(xpub)
	if err != nil {
		panic(err)
	}
	configuration := signing.NewSinglesigConfiguration(scriptType, absoluteKeypath, extendedPublicKey)
	return addresses.NewAccountAddress(
		configuration,
		net,
		logging.Log.WithGroup("addresses_test"),
	)
}

// GetMultisigAddress returns a dummy multisig address.
func GetMultisigAddress(signingThreshold, numberOfSigners int) *addresses.AccountAddress {
	xpubs := make([]*hdkeychain.ExtendedKey, numberOfSigners)
	for i := range xpubs {
		seed, err := hdkeychain.GenerateSeed(32)
		if err != nil {
			panic(err)
		}
		master, err := hdkeychain.NewMaster(seed, net)
		if err != nil {
			panic(err)
		}
		xpub, err := master.Neuter()
		if err != nil {
			panic(err)
		}
		xpubs[i] = xpub
	}
	configuration := signing.NewConfiguration(signing.ScriptTypeP2PKH, absoluteKeypath, xpubs, signingThreshold)
	return addresses.NewAccountAddress(
		configuration,
		net,
		logging.Log.WithGroup("addresses_test"),
	)
}
