// SPDX-License-Identifier: Apache-2.0

package util

import (
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
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
