// SPDX-License-Identifier: Apache-2.0

package signing

// ScriptType indicates which type of output should be produced in case of singlesig.
type ScriptType string

const (
	// ScriptTypeP2PKH is a PayToPubKeyHash output.
	ScriptTypeP2PKH ScriptType = "p2pkh"

	// ScriptTypeP2WPKHP2SH is a segwit v0 PayToPubKeyHash output wrapped in p2sh.
	ScriptTypeP2WPKHP2SH ScriptType = "p2wpkh-p2sh"

	// ScriptTypeP2WPKH is a segwit v0 PayToPubKeyHash output.
	ScriptTypeP2WPKH ScriptType = "p2wpkh"

	// ScriptTypeP2TR is a BIP-86 segwit v1 PayToTaproot output.
	ScriptTypeP2TR ScriptType = "p2tr"
)
