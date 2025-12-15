// SPDX-License-Identifier: Apache-2.0

package test

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
)

const xpub = "tpubDCxoQyC5JaGydxN3yprM6sgqgu65LruN3JBm1fnSmGxXR3AcuNwr" +
	"E7J2CVaCvuLPJtJNySjshNsYbR96Y7yfEdcywYqWubzUQLVGh2b4mF9"

var (
	net             = &chaincfg.TestNet3Params
	absoluteKeypath = signing.NewEmptyAbsoluteKeypath().Child(0, false).Child(10, false)
)

// NewAddressChain returns an AddressChain for convenience in testing.
func NewAddressChain(
	isAddressUsed func(*addresses.AccountAddress) (bool, error)) (*signing.Configuration, *addresses.AddressChain) {
	log := logging.Get().WithGroup("addresses_test")
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
	configuration := signing.NewBitcoinConfiguration(
		signing.ScriptTypeP2PKH, []byte{1, 2, 3, 4}, derivationPath, xpub)
	return configuration, addresses.NewAddressChain(configuration, net, 20, false, isAddressUsed, log)
}

// GetAddress returns a dummy address for a given address type.
func GetAddress(scriptType signing.ScriptType) *addresses.AccountAddress {
	extendedPublicKey, err := hdkeychain.NewKeyFromString(xpub)
	if err != nil {
		panic(err)
	}
	configuration := signing.NewBitcoinConfiguration(
		scriptType, []byte{1, 2, 3, 4}, absoluteKeypath, extendedPublicKey)
	return addresses.NewAccountAddress(
		configuration,
		types.Derivation{Change: false, AddressIndex: 0},
		net,
		logging.Get().WithGroup("addresses_test"),
	)
}
