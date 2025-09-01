// Copyright 2025 Shift Crypto AG
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

package firmware

import (
	"bytes"
	"encoding/binary"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/btcec/v2/schnorr"
	"github.com/btcsuite/btcd/btcutil/psbt"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"google.golang.org/protobuf/proto"
)

const HARDENED = 0x80000000

// LeafHashes is guaranteed to have exactly one element.
type taprootScript struct {
	*psbt.TaprootBip32Derivation
}

// LeafHashes is guaranteed to be empty.
type taprootInternal struct {
	*psbt.TaprootBip32Derivation
}

type ourKey struct {
	segwit          *psbt.Bip32Derivation
	taprootInternal *taprootInternal
	taprootScript   *taprootScript
}

// bip352Pubkey returns the pubkey used for silent payments:
// - 33 byte compressed public key for p2pkh, p2wpkh, p2wpkh-p2sh.
// - 32 byte x-only public key for p2tr
// See https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki#user-content-Inputs_For_Shared_Secret_Derivation.
func (key *ourKey) bip352Pubkey() ([]byte, error) {
	if key.segwit != nil {
		return key.segwit.PubKey, nil
	}
	if key.taprootInternal != nil {
		pubKey, err := schnorr.ParsePubKey(key.taprootInternal.XOnlyPubKey)
		if err != nil {
			return nil, err
		}
		outputKey := txscript.ComputeTaprootKeyNoScript(pubKey)
		return schnorr.SerializePubKey(outputKey), nil
	}
	return nil, errp.New("unsupported script type for silent payments")
}

func (key *ourKey) keypath() []uint32 {
	if key.segwit != nil {
		return key.segwit.Bip32Path
	}
	if key.taprootInternal != nil {
		return key.taprootInternal.Bip32Path
	}
	return key.taprootScript.Bip32Path
}

type psbtInputInfo struct {
	psbt.PInput
}

func (i psbtInputInfo) GetTapInternalKey() []byte {
	return i.TaprootInternalKey
}

func (i psbtInputInfo) GetBip32Derivation() []*psbt.Bip32Derivation {
	return i.Bip32Derivation
}

func (i psbtInputInfo) GetTaprootBip32Derivation() []*psbt.TaprootBip32Derivation {
	return i.TaprootBip32Derivation
}

type psbtOutputInfo struct {
	psbt.POutput
}

func (o psbtOutputInfo) GetTapInternalKey() []byte {
	return o.TaprootInternalKey
}

func (o psbtOutputInfo) GetBip32Derivation() []*psbt.Bip32Derivation {
	return o.Bip32Derivation
}

func (o psbtOutputInfo) GetTaprootBip32Derivation() []*psbt.TaprootBip32Derivation {
	return o.TaprootBip32Derivation
}

type OutputInfo interface {
	psbtInputInfo | psbtOutputInfo
	GetBip32Derivation() []*psbt.Bip32Derivation
	GetTapInternalKey() []byte
	GetTaprootBip32Derivation() []*psbt.TaprootBip32Derivation
}

func findOurKey[O OutputInfo](ourRootFingerprint []byte, outputInfo O) (*ourKey, error) {
	ourRootFingerPrintInt := binary.LittleEndian.Uint32(ourRootFingerprint)
	for _, tapKey := range outputInfo.GetTaprootBip32Derivation() {
		if ourRootFingerPrintInt == tapKey.MasterKeyFingerprint {
			// TODO: check for fingerprint collision

			if bytes.Equal(outputInfo.GetTapInternalKey(), tapKey.XOnlyPubKey) {
				if len(tapKey.LeafHashes) > 0 {
					return nil, errp.New("same key in internal key and in leaf script not allowed")
				}
				return &ourKey{taprootInternal: &taprootInternal{TaprootBip32Derivation: tapKey}}, nil
			}
			if len(tapKey.LeafHashes) != 1 {
				return nil, errp.New("BIP-388 requires all pubkeys to be unique, but pubkeys is in multiple leaf scripts ")
			}
			return &ourKey{taprootScript: &taprootScript{TaprootBip32Derivation: tapKey}}, nil
		}
	}

	for _, derivation := range outputInfo.GetBip32Derivation() {
		if ourRootFingerPrintInt == derivation.MasterKeyFingerprint {
			// TODO: check for fingerprint collision
			return &ourKey{segwit: derivation}, nil
		}
	}
	return nil, errp.New("key not found")
}

func scriptConfigFromUTXO(
	utxo *wire.TxOut,
	keypath []uint32,
	redeemScript []byte,
) (*messages.BTCScriptConfigWithKeypath, error) {
	// Truncate to hardened prefix.
	for i, el := range keypath {
		if el < HARDENED {
			keypath = keypath[:i]
			break
		}
	}

	if txscript.IsPayToWitnessPubKeyHash(utxo.PkScript) {
		return &messages.BTCScriptConfigWithKeypath{
			ScriptConfig: NewBTCScriptConfigSimple(messages.BTCScriptConfig_P2WPKH),
			Keypath:      keypath,
		}, nil
	}

	if txscript.IsPayToScriptHash(utxo.PkScript) && txscript.IsPayToWitnessPubKeyHash(redeemScript) {
		return &messages.BTCScriptConfigWithKeypath{
			ScriptConfig: NewBTCScriptConfigSimple(messages.BTCScriptConfig_P2WPKH_P2SH),
			Keypath:      keypath,
		}, nil
	}

	if txscript.IsPayToTaproot(utxo.PkScript) {
		return &messages.BTCScriptConfigWithKeypath{
			ScriptConfig: NewBTCScriptConfigSimple(messages.BTCScriptConfig_P2TR),
			Keypath:      keypath,
		}, nil
	}
	return nil, errp.New("unknown output type")
}

func payloadFromPkScript(pkScript []byte) (messages.BTCOutputType, []byte, error) {
	var outputType messages.BTCOutputType
	var payload []byte

	switch {
	case txscript.IsPayToPubKeyHash(pkScript):
		outputType = messages.BTCOutputType_P2PKH
		payload = pkScript[3:23]

	case txscript.IsPayToScriptHash(pkScript):
		outputType = messages.BTCOutputType_P2SH
		payload = pkScript[2:22]

	case txscript.IsPayToWitnessPubKeyHash(pkScript):
		outputType = messages.BTCOutputType_P2WPKH
		payload = pkScript[2:]

	case txscript.IsPayToWitnessScriptHash(pkScript):
		outputType = messages.BTCOutputType_P2WSH
		payload = pkScript[2:]

	case txscript.IsPayToTaproot(pkScript):
		outputType = messages.BTCOutputType_P2TR
		payload = pkScript[2:]

	default:
		return 0, nil, errp.New("unrecognized output type")
	}

	return outputType, payload, nil
}

// PSBTSignOutputOptions allows for providing output options beyond what is encoded in the PSBT.
type PSBTSignOutputOptions struct {
	// If not empty, this output's pkScript will be generated based on this silent payment address.
	// The corresponding output pkScript in the PSBT's global unsigned tx
	// (`PSBT_GLOBAL_UNSIGNED_TX`) will be populated during signing.
	//
	// A DLEQ proof verification is automatically performed during signing to verify the generated
	// output is correct.
	//
	// Silent payments as part of PSBT is described in
	// https://github.com/bitcoin/bips/blob/master/bip-0375.mediawiki, but we don't conform to that yet for two reasons:
	// - it requires PSBTv2, while we only support PSBTv0 (see https://github.com/btcsuite/btcd/issues/2328)
	// - BitBox02 silent payment support predates the BIP, and its DLEQ proof deviates from the one in the BIP.
	SilentPaymentAddress string
}

// PSBTSignOptions allows for providing signing options beyond what is encoded in the PSBT.
type PSBTSignOptions struct {
	FormatUnit messages.BTCSignInitRequest_FormatUnit
	// If ForceScriptConfig is nil, we attempt to infer the involved script configs. For the simple
	// script config (single sig), we infer the script config from the involved
	// pkScripts/redeemScripts.
	//
	// Multisig and policy configs are currently not inferred and must be provided using
	// ForceScriptConfig.
	ForceScriptConfig *messages.BTCScriptConfigWithKeypath
	// Per-output options. The map key is the output index.
	Outputs map[int]*PSBTSignOutputOptions
}

func (b *PSBTSignOptions) isSilentPayment() bool {
	for _, output := range b.Outputs {
		if output.SilentPaymentAddress != "" {
			return true
		}
	}
	return false
}

type psbtConvertResult struct {
	tx            *BTCTx
	ourKeys       []*ourKey
	scriptConfigs []*messages.BTCScriptConfigWithKeypath
}

func newBTCTxFromPSBT(
	psbt_ *psbt.Packet,
	ourRootFingerprint []byte,
	options *PSBTSignOptions) (*psbtConvertResult, error) {
	if options == nil {
		options = &PSBTSignOptions{}
	}

	isSilentPayment := options.isSilentPayment()

	scriptConfigs := make([]*messages.BTCScriptConfigWithKeypath, 0)
	if options.ForceScriptConfig != nil {
		scriptConfigs = []*messages.BTCScriptConfigWithKeypath{options.ForceScriptConfig}
	}

	findOrAddScriptConfig := func(
		txOut *wire.TxOut,
		keypath []uint32,
		redeemScript []byte) (uint32, error) {
		if options.ForceScriptConfig != nil {
			// Referncing scriptConfigs[0] above that is forced to `ForceScriptConfig`.
			return 0, nil
		}

		// Infer script config from the PSBT input/output.
		scriptConfig, err := scriptConfigFromUTXO(
			txOut,
			keypath,
			redeemScript,
		)
		if err != nil {
			return 0, err
		}

		for i, cfg := range scriptConfigs {
			if proto.Equal(cfg, scriptConfig) {
				return uint32(i), nil
			}
		}
		scriptConfigs = append(scriptConfigs, scriptConfig)
		return uint32(len(scriptConfigs) - 1), nil
	}

	numInputs := len(psbt_.UnsignedTx.TxIn)
	ourKeys := make([]*ourKey, numInputs)
	inputs := make([]*BTCTxInput, numInputs)

	for inputIndex, txInput := range psbt_.UnsignedTx.TxIn {
		psbtInput := psbt_.Inputs[inputIndex]
		prevOutPoint := txInput.PreviousOutPoint
		var utxo *wire.TxOut
		switch {
		case psbtInput.WitnessUtxo != nil:
			utxo = psbtInput.WitnessUtxo
		case psbtInput.NonWitnessUtxo != nil:
			utxo = psbtInput.NonWitnessUtxo.TxOut[prevOutPoint.Index]
		default:
			return nil, errp.Newf("could not find utxo of input %d", inputIndex)
		}

		ourKey, err := findOurKey(ourRootFingerprint, psbtInputInfo{psbtInput})
		if err != nil {
			return nil, err
		}

		scriptConfigIndex, err := findOrAddScriptConfig(
			utxo,
			ourKey.keypath(),
			psbtInput.RedeemScript)
		if err != nil {
			return nil, err
		}

		var prevTx *BTCPrevTx
		if psbtInput.NonWitnessUtxo != nil {
			prevTx = NewBTCPrevTxFromBtcd(psbtInput.NonWitnessUtxo)
		}

		var bip352Pubkey []byte
		if isSilentPayment {
			bip352Pubkey, err = ourKey.bip352Pubkey()
			if err != nil {
				return nil, err
			}

		}

		inputs[inputIndex] = &BTCTxInput{
			Input: &messages.BTCSignInputRequest{
				PrevOutHash:       prevOutPoint.Hash[:],
				PrevOutIndex:      prevOutPoint.Index,
				PrevOutValue:      uint64(utxo.Value),
				Sequence:          txInput.Sequence,
				Keypath:           ourKey.keypath(),
				ScriptConfigIndex: scriptConfigIndex,
			},
			PrevTx:       prevTx,
			BIP352Pubkey: bip352Pubkey,
		}
		ourKeys[inputIndex] = ourKey
	}

	numOutputs := len(psbt_.UnsignedTx.TxOut)
	outputs := make([]*messages.BTCSignOutputRequest, numOutputs)

	for outputIndex, txOutput := range psbt_.UnsignedTx.TxOut {
		psbtOutput := psbt_.Outputs[outputIndex]

		outputOptions := options.Outputs[outputIndex]

		// Either change output or a non-change output owned by the BitBox.
		if ourKey, err := findOurKey(ourRootFingerprint, psbtOutputInfo{psbtOutput}); err == nil {
			scriptConfigIndex, err := findOrAddScriptConfig(
				txOutput,
				ourKey.keypath(),
				psbtOutput.RedeemScript)
			if err != nil {
				return nil, err
			}
			outputs[outputIndex] = &messages.BTCSignOutputRequest{
				Ours:              true,
				Value:             uint64(txOutput.Value),
				Keypath:           ourKey.keypath(),
				ScriptConfigIndex: scriptConfigIndex,
			}
		} else {
			var silentPayment *messages.BTCSignOutputRequest_SilentPayment
			var outputType messages.BTCOutputType
			var payload []byte
			if outputOptions != nil && outputOptions.SilentPaymentAddress != "" {
				silentPayment = &messages.BTCSignOutputRequest_SilentPayment{
					Address: outputOptions.SilentPaymentAddress,
				}
			} else {
				outputType, payload, err = payloadFromPkScript(txOutput.PkScript)
				if err != nil {
					return nil, err
				}
			}
			outputs[outputIndex] = &messages.BTCSignOutputRequest{
				Ours:          false,
				Value:         uint64(txOutput.Value),
				Type:          outputType,
				Payload:       payload,
				SilentPayment: silentPayment,
			}
		}
	}

	tx := &BTCTx{
		Version:  uint32(psbt_.UnsignedTx.Version),
		Inputs:   inputs,
		Outputs:  outputs,
		Locktime: psbt_.UnsignedTx.LockTime,
	}

	return &psbtConvertResult{
		tx:            tx,
		ourKeys:       ourKeys,
		scriptConfigs: scriptConfigs,
	}, nil
}

// Sign a PSBT. If `options` is nil, the default options are used. The PSBT input signatures will be
// populated.
func (device *Device) BTCSignPSBT(
	coin messages.BTCCoin,
	psbt_ *psbt.Packet,
	options *PSBTSignOptions) error {

	if options == nil {
		options = &PSBTSignOptions{}
	}

	ourRootFingerprint, err := device.RootFingerprint()
	if err != nil {
		return err
	}
	txResult, err := newBTCTxFromPSBT(psbt_, ourRootFingerprint, options)
	if err != nil {
		return err
	}
	signResult, err := device.BTCSign(
		coin, txResult.scriptConfigs, nil, txResult.tx, options.FormatUnit)
	if err != nil {
		return err
	}

	for inputIndex := range psbt_.Inputs {
		psbtInput := &psbt_.Inputs[inputIndex]
		signatureCompact := signResult.Signatures[inputIndex]
		r := new(btcec.ModNScalar)
		r.SetByteSlice(signatureCompact[:32])
		s := new(btcec.ModNScalar)
		s.SetByteSlice(signatureCompact[32:])
		signatureDER := ecdsa.NewSignature(r, s).Serialize()
		ourKey := txResult.ourKeys[inputIndex]
		switch {
		case ourKey.segwit != nil:
			psbtInput.PartialSigs = []*psbt.PartialSig{
				{
					PubKey:    ourKey.segwit.PubKey,
					Signature: append(signatureDER, byte(txscript.SigHashAll)),
				},
			}
		case ourKey.taprootInternal != nil:
			psbtInput.TaprootKeySpendSig = signatureCompact
		case ourKey.taprootScript != nil:
			psbtInput.TaprootScriptSpendSig = []*psbt.TaprootScriptSpendSig{
				{
					XOnlyPubKey: ourKey.taprootScript.XOnlyPubKey,
					LeafHash:    ourKey.taprootScript.LeafHashes[0],
					Signature:   signatureCompact,
					SigHash:     txscript.SigHashDefault,
				},
			}
		default:
			panic("unreachable")
		}
	}

	for index, generatedOutput := range signResult.GeneratedOutputs {
		psbt_.UnsignedTx.TxOut[index].PkScript = generatedOutput
	}

	return nil
}
