// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package test

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
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
	return configuration, addresses.NewAddressChain(configuration, net, 20, 0, isAddressUsed, log)
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
		signing.NewEmptyRelativeKeypath(),
		net,
		logging.Get().WithGroup("addresses_test"),
	)
}
