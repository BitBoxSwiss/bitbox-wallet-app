package addresses

import "github.com/shiftdevices/godbb/backend/signing"

// SigScriptWitnessSize returns the maximum possible sigscript size for a given address type.
func SigScriptWitnessSize(configuration *signing.Configuration) (int, bool) {
	if configuration.Multisig() {
		// TODO
	}
	switch configuration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		// OP_DATA_72
		// 72 bytes of signature data (including SIGHASH op)
		// OP_DATA_33
		// 33 bytes of compressed pubkey
		// OP_73, OP_33 are data push ops.
		return 1 + 72 + 1 + 33, false
	case signing.ScriptTypeP2WPKHP2SH:
		// OP_0 (1 byte) OP_20 (1 byte) pubkeyHash (20 bytes)
		const redeemScriptSize = 1 + 1 + 20
		// OP_DATA_22 (1 Byte) redeemScript (22 bytes)
		return 1 + redeemScriptSize, true
	case signing.ScriptTypeP2WPKH:
		return 0, true // hooray
	default:
		// TODO: multisig
		panic("unknown address type")
	}
}
