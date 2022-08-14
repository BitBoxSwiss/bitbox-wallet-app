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

package util

import (
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// ParseOutPoint parses <txID>:<index> into an outpoint.
func ParseOutPoint(outPointBytes []byte) (*wire.OutPoint, error) {
	split := strings.SplitN(string(outPointBytes), ":", 2)
	if len(split) != 2 {
		return nil, errp.Newf("wrong outPoint format %s", string(outPointBytes))
	}
	txHash, err := chainhash.NewHashFromStr(split[0])
	if err != nil {
		return nil, errp.WithStack(err)
	}
	index, err := strconv.ParseUint(split[1], 10, 32)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return wire.NewOutPoint(txHash, uint32(index)), nil
}

// PkScriptFromAddress decodes an address into the pubKeyScript that can be used in a transaction
// output.
func PkScriptFromAddress(address btcutil.Address) ([]byte, error) {
	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return pkScript, nil
}

// AddressFromPkScript decodes a pkScript into an Address instance.
func AddressFromPkScript(pkScript []byte, net *chaincfg.Params) (btcutil.Address, error) {
	scriptClass, addresses, _, err := txscript.ExtractPkScriptAddrs(pkScript, net)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if len(addresses) != 1 {
		return nil, errp.New("couldn't parse pkScript")
	}
	if scriptClass == txscript.WitnessV1TaprootTy && (net.Net == ltc.MainNet || net.Net == ltc.TestNet4) {
		return nil, errp.New("Taproot not supported on Litecoin")
	}
	return addresses[0], nil
}
