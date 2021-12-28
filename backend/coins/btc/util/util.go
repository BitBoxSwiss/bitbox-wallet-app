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

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
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
	// Convert taproot addresses. Drop this once `PayToAddrsScript` does this upstream.
	if addrTaproot, ok := address.(*btcutil.AddressTaproot); ok {
		// OP_1: segwit v1. 0x20 = data push of 32 bytes.
		// https://github.com/bitcoin/bips/blob/4c6389f8431f677847b115538a47ce8c826c6be8/bip-0341.mediawiki#script-validation-rules
		pubkey := addrTaproot.ScriptAddress()
		if len(pubkey) != 32 {
			return nil, errp.Newf("unexpected pubkey size, got %d bytes, expected 32 bytes", len(pubkey))
		}
		return append([]byte{txscript.OP_1, 0x20}, pubkey...), nil
	}
	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return pkScript, nil
}

// AddressFromPkScript decodes a pkScript into an Address instance.
func AddressFromPkScript(pkScript []byte, net *chaincfg.Params) (btcutil.Address, error) {
	// Parse taproot scripts. Drop this check once `ExtractPkScriptAddrs` does this upstream.
	// https://github.com/bitcoin/bips/blob/4c6389f8431f677847b115538a47ce8c826c6be8/bip-0341.mediawiki#script-validation-rules.
	switch net.Net {
	case wire.MainNet, wire.TestNet3: // enable Taproot for Bitcoin mainnet/testnet.
		if len(pkScript) == 34 && pkScript[0] == txscript.OP_1 && pkScript[1] == 0x20 {
			return btcutil.NewAddressTaproot(pkScript[2:], net)
		}
	}
	_, addresses, _, err := txscript.ExtractPkScriptAddrs(pkScript, net)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if len(addresses) != 1 {
		return nil, errp.New("couldn't parse pkScript")
	}
	return addresses[0], nil
}
