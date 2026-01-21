// SPDX-License-Identifier: Apache-2.0

package firmware

import (
	"bytes"
	"encoding/binary"

	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/schnorr"
	"github.com/btcsuite/btcd/btcutil/bech32"
	"github.com/btcsuite/btcd/txscript"
)

func bip352SmallestOutpointHash(tx *BTCTx, aPubSum *btcec.PublicKey) []byte {
	var smallestOutpoint []byte
	for _, input := range tx.Inputs {
		var serialized bytes.Buffer
		serialized.Write(input.Input.PrevOutHash)
		_ = binary.Write(&serialized, binary.LittleEndian, input.Input.PrevOutIndex)

		if smallestOutpoint == nil || bytes.Compare(serialized.Bytes(), smallestOutpoint) == -1 {
			smallestOutpoint = serialized.Bytes()
		}
	}

	var msg bytes.Buffer
	msg.Write(smallestOutpoint)
	msg.Write(aPubSum.SerializeCompressed())
	return taggedSha256([]byte("BIP0352/Inputs"), msg.Bytes())
}

// DecodeSilentPaymentAddress decodes a slient payment address, returning the bech32 HRP and the
// scan/spend pubkeys.
func DecodeSilentPaymentAddress(address string) (string, *btcec.PublicKey, *btcec.PublicKey, error) {
	hrp, data, err := bech32.DecodeNoLimit(address)
	if err != nil {
		return "", nil, nil, errp.WithStack(err)
	}
	version, data := data[0], data[1:]
	if version != 0 {
		return "", nil, nil, errp.New("unexpected silent payment address version")
	}
	regrouped, err := bech32.ConvertBits(data, 5, 8, false)
	if err != nil {
		return "", nil, nil, errp.WithStack(err)
	}
	if len(regrouped) != 66 {
		return "", nil, nil, errp.New("unexpected silent payment payload length")
	}
	scanPubKey, err := btcec.ParsePubKey(regrouped[:33])
	if err != nil {
		return "", nil, nil, errp.WithStack(err)
	}
	spendPubKey, err := btcec.ParsePubKey(regrouped[33:])
	if err != nil {
		return "", nil, nil, errp.WithStack(err)
	}
	return hrp, scanPubKey, spendPubKey, nil
}

func bip352InputSum(tx *BTCTx) (*btcec.PublicKey, error) {
	var aPubSum *btcec.PublicKey
	for _, inp := range tx.Inputs {
		var pubkey *btcec.PublicKey
		switch len(inp.BIP352Pubkey) {
		case btcec.PubKeyBytesLenCompressed:
			var err error
			pubkey, err = btcec.ParsePubKey(inp.BIP352Pubkey)
			if err != nil {
				return nil, err
			}
		case schnorr.PubKeyBytesLen:
			var err error
			pubkey, err = schnorr.ParsePubKey(inp.BIP352Pubkey)
			if err != nil {
				return nil, err
			}
		default:
			return nil, errp.New("BIP352PubKey of each input must be present")
		}
		if aPubSum == nil {
			aPubSum = pubkey
		} else {
			aPubSum = pubkeyAdd(aPubSum, pubkey)
		}
	}
	return aPubSum, nil
}

// t_k = hash_"BIP0352/SharedSecret"(serP(ecdh_shared_secret) || ser32(k))
// See https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki#creating-outputs
func bip352CalculateTk(ecdhSharedSecret *btcec.PublicKey, k uint32) []byte {
	var tkMsg bytes.Buffer
	tkMsg.Write(ecdhSharedSecret.SerializeCompressed())
	_ = binary.Write(&tkMsg, binary.LittleEndian, k)
	return taggedSha256([]byte("BIP0352/SharedSecret"), tkMsg.Bytes())

}

func silentPaymentOutputVerify(tx *BTCTx, outputIndex int, proof []byte, generatedOutputPkscript []byte) error {
	if len(proof) != 33+64 {
		return errp.New("wrong DLEQ proof size ")
	}
	cPub, err := btcec.ParsePubKey(proof[:33])
	if err != nil {
		return errp.WithStack(err)
	}
	dleqProof := proof[33:]

	output := tx.Outputs[outputIndex]
	if output.SilentPayment == nil {
		return errp.New("silent payment address missing")
	}
	_, scanPubKey, spendPubKey, err := DecodeSilentPaymentAddress(output.SilentPayment.Address)
	if err != nil {
		return err
	}

	aPubSum, err := bip352InputSum(tx)
	if err != nil {
		return err
	}
	if err := dleqVerify(dleqProof, aPubSum, scanPubKey, cPub); err != nil {
		return err
	}

	inputsHash := bip352SmallestOutpointHash(tx, aPubSum)
	// ecdh_shared_secret = input_hash·a·B_scan = input_hash*C
	ecdhSharedSecret := scalarMult(inputsHash, cPub)
	tk := bip352CalculateTk(ecdhSharedSecret, 0)
	// T_k = t_k*G
	tkPub := scalarBaseMult(tk)
	// B_m  + T_k
	expectedOutputKey := pubkeyAdd(spendPubKey, tkPub)

	expectedPkScript, err := txscript.PayToTaprootScript(expectedOutputKey)
	if err != nil {
		return errp.WithStack(err)
	}
	if !bytes.Equal(expectedPkScript, generatedOutputPkscript) {
		return errp.New("incorrect silent payment output")
	}
	return nil
}
