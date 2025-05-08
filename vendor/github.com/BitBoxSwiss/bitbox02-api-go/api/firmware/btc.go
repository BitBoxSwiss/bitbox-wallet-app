// Copyright 2018-2019 Shift Cryptosecurity AG
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
	"encoding/binary"
	"errors"
	"fmt"
	"strings"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/btcsuite/btcd/btcutil/base58"
	"github.com/btcsuite/btcd/wire"
	"google.golang.org/protobuf/proto"
)

const multisigNameMaxLen = 30

// nonAtomicQueryBTC is like nonAtomicQuery, but nested one level deeper.
func (device *Device) nonAtomicQueryBTC(request *messages.BTCRequest) (*messages.BTCResponse, error) {
	response, err := device.nonAtomicQuery(&messages.Request{
		Request: &messages.Request_Btc{
			Btc: request,
		},
	})
	if err != nil {
		return nil, err
	}
	btcResponse, ok := response.Response.(*messages.Response_Btc)
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	return btcResponse.Btc, nil
}

// queryBTC is like query, but nested one level deeper.
func (device *Device) queryBTC(request *messages.BTCRequest) (*messages.BTCResponse, error) {
	return atomicQueriesValue(device, func() (*messages.BTCResponse, error) {
		return device.nonAtomicQueryBTC(request)
	})
}

// NewBTCScriptConfigSimple is a helper to construct the correct script config for simple script
// types.
func NewBTCScriptConfigSimple(typ messages.BTCScriptConfig_SimpleType) *messages.BTCScriptConfig {
	return &messages.BTCScriptConfig{
		Config: &messages.BTCScriptConfig_SimpleType_{
			SimpleType: typ,
		},
	}
}

// NewXPub parses an xpub string into an XPub protobuf message. The XPub version is not checked an
// discarded.
func NewXPub(xpub string) (*messages.XPub, error) {
	decoded, _, err := base58.CheckDecode(xpub)
	if err != nil {
		return nil, err
	}
	if len(decoded) != 77 {
		return nil, errp.New("invalid xpub length")
	}
	// CheckDecode shaves of one version byte, but we have 4...
	decoded = decoded[3:]
	depth, decoded := decoded[:1], decoded[1:]
	parentFP, decoded := decoded[:4], decoded[4:]
	childNum, decoded := decoded[:4], decoded[4:]
	chainCode, decoded := decoded[:32], decoded[32:]
	pubkey := decoded[:33]
	return &messages.XPub{
		Depth:             depth,
		ParentFingerprint: parentFP,
		ChildNum:          binary.BigEndian.Uint32(childNum),
		ChainCode:         chainCode,
		PublicKey:         pubkey,
	}, nil
}

// NewBTCScriptConfigMultisig is a helper to construct the a multisig script config.
func NewBTCScriptConfigMultisig(
	threshold uint32,
	xpubs []string,
	ourXPubIndex uint32,
) (*messages.BTCScriptConfig, error) {
	xpubsLen := uint32(len(xpubs))
	if xpubsLen < 2 || xpubsLen > 15 || threshold == 0 || threshold > xpubsLen {
		return nil, errors.New("2 <= m <= n <= 15 must hold (m = threshold, n = number of signers)")
	}
	xpubsConverted := make([]*messages.XPub, len(xpubs))
	for i, xpub := range xpubs {
		xpubConverted, err := NewXPub(xpub)
		if err != nil {
			return nil, err
		}
		xpubsConverted[i] = xpubConverted
	}

	scriptConfig := &messages.BTCScriptConfig{
		Config: &messages.BTCScriptConfig_Multisig_{
			Multisig: &messages.BTCScriptConfig_Multisig{
				Threshold:    threshold,
				Xpubs:        xpubsConverted,
				OurXpubIndex: ourXPubIndex,
			},
		},
	}
	return scriptConfig, nil
}

// BTCXPub queries the device for a btc, ltc, tbtc, tltc xpubs.
func (device *Device) BTCXPub(
	coin messages.BTCCoin,
	keypath []uint32,
	xpubType messages.BTCPubRequest_XPubType,
	display bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_BtcPub{
			BtcPub: &messages.BTCPubRequest{
				Coin:    coin,
				Keypath: keypath,
				Output: &messages.BTCPubRequest_XpubType{
					XpubType: xpubType,
				},
				Display: display,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.Response_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

// BTCAddress queries the device for a btc, ltc, tbtc, tltc address.
func (device *Device) BTCAddress(
	coin messages.BTCCoin,
	keypath []uint32,
	scriptConfig *messages.BTCScriptConfig,
	display bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_BtcPub{
			BtcPub: &messages.BTCPubRequest{
				Coin:    coin,
				Keypath: keypath,
				Output: &messages.BTCPubRequest_ScriptConfig{
					ScriptConfig: scriptConfig,
				},
				Display: display,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.Response_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

func (device *Device) nonAtomicQueryBtcSign(request proto.Message) (
	*messages.BTCSignNextResponse, error) {
	response, err := device.nonAtomicQuery(request)
	if err != nil {
		return nil, err
	}
	next, ok := response.Response.(*messages.Response_BtcSignNext)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return next.BtcSignNext, nil
}

func (device *Device) nonAtomicNestedQueryBtcSign(request *messages.BTCRequest) (
	*messages.BTCSignNextResponse, error) {
	response, err := device.nonAtomicQueryBTC(request)
	if err != nil {
		return nil, err
	}
	next, ok := response.Response.(*messages.BTCResponse_SignNext)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return next.SignNext, nil
}

func isTaproot(sc *messages.BTCScriptConfigWithKeypath) bool {
	simpleTypeConfig, ok := sc.ScriptConfig.Config.(*messages.BTCScriptConfig_SimpleType_)
	return ok && simpleTypeConfig.SimpleType == messages.BTCScriptConfig_P2TR
}

// BTCSignNeedsPrevTxs returns true if the PrevTx field in BTCTxInput needs to be populated before
// calling BTCSign(). This is the case if there are any non-taproot inputs in the transaction to be
// signed.
func BTCSignNeedsPrevTxs(scriptConfigs []*messages.BTCScriptConfigWithKeypath) bool {
	for _, sc := range scriptConfigs {
		if !isTaproot(sc) {
			return true
		}
	}
	return false
}

// BTCPrevTx is the transaction referenced by an input.
type BTCPrevTx struct {
	Version  uint32
	Inputs   []*messages.BTCPrevTxInputRequest
	Outputs  []*messages.BTCPrevTxOutputRequest
	Locktime uint32
}

// NewBTCPrevTxFromBtcd converts a btcd transaction to a BTCPrevTx.
func NewBTCPrevTxFromBtcd(tx *wire.MsgTx) *BTCPrevTx {
	prevTxInputs := make([]*messages.BTCPrevTxInputRequest, len(tx.TxIn))
	for prevInputIndex, prevTxIn := range tx.TxIn {
		prevTxInputs[prevInputIndex] = &messages.BTCPrevTxInputRequest{
			PrevOutHash:     prevTxIn.PreviousOutPoint.Hash[:],
			PrevOutIndex:    prevTxIn.PreviousOutPoint.Index,
			SignatureScript: prevTxIn.SignatureScript,
			Sequence:        prevTxIn.Sequence,
		}
	}
	prevTxOuputs := make([]*messages.BTCPrevTxOutputRequest, len(tx.TxOut))
	for prevOutputIndex, prevTxOut := range tx.TxOut {
		prevTxOuputs[prevOutputIndex] = &messages.BTCPrevTxOutputRequest{
			Value:        uint64(prevTxOut.Value),
			PubkeyScript: prevTxOut.PkScript,
		}
	}

	return &BTCPrevTx{
		Version:  uint32(tx.Version),
		Inputs:   prevTxInputs,
		Outputs:  prevTxOuputs,
		Locktime: tx.LockTime,
	}
}

// BTCTxInput contains the data needed to sign an input.
type BTCTxInput struct {
	Input *messages.BTCSignInputRequest
	// PrevTx must be the transaction referenced by Input.PrevOutHash. Can be nil if
	// `BTCSignNeedsPrevTxs()` returns false.
	PrevTx *BTCPrevTx
	// Required for silent payment address verification.
	//
	// Public key according to
	// https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki#user-content-Inputs_For_Shared_Secret_Derivation.
	// Must be 33 bytes for a regular pubkey, and 32 bytes in case of a Taproot x-only output
	// pubkey.
	//
	// IMPORTANT: for Taproot inputs, you must provide the 32 byte x-only pubkey, not a 33 byte
	// pubkey, otherwise the parity of the Y coordinate could be wrong.
	BIP352Pubkey []byte
}

// BTCTx is the data needed to sign a btc transaction.
type BTCTx struct {
	Version         uint32
	Inputs          []*BTCTxInput
	Outputs         []*messages.BTCSignOutputRequest
	Locktime        uint32
	PaymentRequests []*messages.BTCPaymentRequestRequest
}

// BTCSignResult is the result of `BTCSign()`.
type BTCSignResult struct {
	// Signatures contains the input signatures. One 64 byte signature per input.
	Signatures [][]byte
	// GeneratedOutputs contains the outputs generated (silent payments). The map key is the input
	// index, the map value is the generated pkScript.
	GeneratedOutputs map[int][]byte
}

func (device *Device) nonAtomicBTCSign(
	coin messages.BTCCoin,
	scriptConfigs []*messages.BTCScriptConfigWithKeypath,
	outputScriptConfigs []*messages.BTCScriptConfigWithKeypath,
	tx *BTCTx,
	formatUnit messages.BTCSignInitRequest_FormatUnit,
) (*BTCSignResult, error) {
	generatedOutputs := map[int][]byte{}
	if !device.version.AtLeast(semver.NewSemVer(9, 10, 0)) {
		for _, sc := range scriptConfigs {
			if isTaproot(sc) {
				return nil, UnsupportedError("9.10.0")
			}
		}
	}

	supportsAntiklepto := device.version.AtLeast(semver.NewSemVer(9, 4, 0))

	containsSilentPaymentOutputs := false
	for _, output := range tx.Outputs {
		if output.SilentPayment != nil {
			containsSilentPaymentOutputs = true
			break
		}
	}

	if containsSilentPaymentOutputs && !device.version.AtLeast(semver.NewSemVer(9, 21, 0)) {
		return nil, UnsupportedError("9.21.0")
	}

	if len(outputScriptConfigs) > 0 && !device.version.AtLeast(semver.NewSemVer(9, 22, 0)) {
		return nil, UnsupportedError("9.22.0")
	}

	signatures := make([][]byte, len(tx.Inputs))
	next, err := device.nonAtomicQueryBtcSign(&messages.Request{
		Request: &messages.Request_BtcSignInit{
			BtcSignInit: &messages.BTCSignInitRequest{
				Coin:                         coin,
				ScriptConfigs:                scriptConfigs,
				Version:                      tx.Version,
				NumInputs:                    uint32(len(tx.Inputs)),
				NumOutputs:                   uint32(len(tx.Outputs)),
				Locktime:                     tx.Locktime,
				FormatUnit:                   formatUnit,
				ContainsSilentPaymentOutputs: containsSilentPaymentOutputs,
				OutputScriptConfigs:          outputScriptConfigs,
			}}})
	if err != nil {
		return nil, err
	}

	isInputsPass2 := false
	for {
		switch next.Type {
		case messages.BTCSignNextResponse_INPUT:
			inputIndex := next.Index
			input := tx.Inputs[inputIndex].Input

			inputIsSchnorr := isTaproot(scriptConfigs[input.ScriptConfigIndex])

			// Anti-Klepto protocol not supported yet for Schnorr signatures.
			performAntiklepto := supportsAntiklepto && isInputsPass2 && !inputIsSchnorr

			var hostNonce []byte
			if performAntiklepto {
				nonce, err := generateHostNonce()
				if err != nil {
					return nil, err
				}
				hostNonce = nonce
				input.HostNonceCommitment = &messages.AntiKleptoHostNonceCommitment{
					Commitment: antikleptoHostCommit(hostNonce),
				}
			}
			next, err = device.nonAtomicQueryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignInput{
					BtcSignInput: input,
				}})
			if err != nil {
				return nil, err
			}

			if performAntiklepto {
				if next.Type != messages.BTCSignNextResponse_HOST_NONCE || next.AntiKleptoSignerCommitment == nil {
					return nil, errp.New("unexpected response; expected signer nonce commitment")
				}
				signerCommitment := next.AntiKleptoSignerCommitment.Commitment
				next, err = device.nonAtomicNestedQueryBtcSign(
					&messages.BTCRequest{
						Request: &messages.BTCRequest_AntikleptoSignature{
							AntikleptoSignature: &messages.AntiKleptoSignatureRequest{
								HostNonce: hostNonce,
							},
						},
					})
				if err != nil {
					return nil, err
				}
				err := antikleptoVerify(
					hostNonce,
					signerCommitment,
					next.Signature,
				)
				if err != nil {
					return nil, err
				}
			}
			if isInputsPass2 {
				if !next.HasSignature {
					return nil, errp.New("unexpected response; expected signature")
				}
				signatures[inputIndex] = next.Signature
			}

			if inputIndex+1 == uint32(len(tx.Inputs)) {
				isInputsPass2 = true
			}
		case messages.BTCSignNextResponse_PREVTX_INIT:
			prevtx := tx.Inputs[next.Index].PrevTx
			next, err = device.nonAtomicNestedQueryBtcSign(
				&messages.BTCRequest{
					Request: &messages.BTCRequest_PrevtxInit{
						PrevtxInit: &messages.BTCPrevTxInitRequest{
							Version:    prevtx.Version,
							NumInputs:  uint32(len(prevtx.Inputs)),
							NumOutputs: uint32(len(prevtx.Outputs)),
							Locktime:   prevtx.Locktime,
						},
					},
				})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_PREVTX_INPUT:
			prevtxInput := tx.Inputs[next.Index].PrevTx.Inputs[next.PrevIndex]
			next, err = device.nonAtomicNestedQueryBtcSign(
				&messages.BTCRequest{
					Request: &messages.BTCRequest_PrevtxInput{
						PrevtxInput: prevtxInput,
					},
				})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_PREVTX_OUTPUT:
			prevtxOutput := tx.Inputs[next.Index].PrevTx.Outputs[next.PrevIndex]
			next, err = device.nonAtomicNestedQueryBtcSign(
				&messages.BTCRequest{
					Request: &messages.BTCRequest_PrevtxOutput{
						PrevtxOutput: prevtxOutput,
					},
				})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_OUTPUT:
			outputIndex := next.Index
			next, err = device.nonAtomicQueryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignOutput{
					BtcSignOutput: tx.Outputs[outputIndex],
				}})
			if err != nil {
				return nil, err
			}
			if next.GeneratedOutputPkscript != nil {
				generatedOutputs[int(outputIndex)] = next.GeneratedOutputPkscript
				err := silentPaymentOutputVerify(
					tx,
					int(outputIndex),
					next.SilentPaymentDleqProof,
					next.GeneratedOutputPkscript,
				)
				if err != nil {
					return nil, err
				}
			}
		case messages.BTCSignNextResponse_PAYMENT_REQUEST:
			paymentRequestIndex := next.Index
			if int(paymentRequestIndex) >= len(tx.PaymentRequests) {
				return nil, errp.New("payment request index out of bounds")
			}
			paymentRequest := tx.PaymentRequests[paymentRequestIndex]
			next, err = device.nonAtomicNestedQueryBtcSign(
				&messages.BTCRequest{
					Request: &messages.BTCRequest_PaymentRequest{
						PaymentRequest: paymentRequest,
					},
				},
			)
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_DONE:
			return &BTCSignResult{
				Signatures:       signatures,
				GeneratedOutputs: generatedOutputs,
			}, nil
		}
	}
}

// BTCSign signs a bitcoin or bitcoin-like transaction. The previous transactions of the inputs
// need to be provided if `BTCSignNeedsPrevTxs()` returns true.
func (device *Device) BTCSign(
	coin messages.BTCCoin,
	scriptConfigs []*messages.BTCScriptConfigWithKeypath,
	outputScriptConfigs []*messages.BTCScriptConfigWithKeypath,
	tx *BTCTx,
	formatUnit messages.BTCSignInitRequest_FormatUnit,
) (*BTCSignResult, error) {
	return atomicQueriesValue(device, func() (*BTCSignResult, error) {
		return device.nonAtomicBTCSign(
			coin,
			scriptConfigs,
			outputScriptConfigs,
			tx,
			formatUnit,
		)
	})
}

// BTCIsScriptConfigRegistered returns true if the script config / account is already registered.
func (device *Device) BTCIsScriptConfigRegistered(
	coin messages.BTCCoin,
	scriptConfig *messages.BTCScriptConfig,
	keypathAccount []uint32,
) (bool, error) {
	request := &messages.BTCRequest{
		Request: &messages.BTCRequest_IsScriptConfigRegistered{
			IsScriptConfigRegistered: &messages.BTCIsScriptConfigRegisteredRequest{
				Registration: &messages.BTCScriptConfigRegistration{
					Coin:         coin,
					ScriptConfig: scriptConfig,
					Keypath:      keypathAccount,
				},
			},
		},
	}
	response, err := device.queryBTC(request)
	if err != nil {
		return false, err
	}
	r, ok := response.Response.(*messages.BTCResponse_IsScriptConfigRegistered)
	if !ok {
		return false, errp.New("unexpected response")
	}
	return r.IsScriptConfigRegistered.IsRegistered, nil
}

// BTCRegisterScriptConfig returns true if the script config / account is already registered.
func (device *Device) BTCRegisterScriptConfig(
	coin messages.BTCCoin,
	scriptConfig *messages.BTCScriptConfig,
	keypathAccount []uint32,
	name string,
) error {
	name = strings.TrimSpace(name)
	if len(name) > multisigNameMaxLen {
		return fmt.Errorf("name must be %d chars or less", multisigNameMaxLen)
	}
	request := &messages.BTCRequest{
		Request: &messages.BTCRequest_RegisterScriptConfig{
			RegisterScriptConfig: &messages.BTCRegisterScriptConfigRequest{
				Registration: &messages.BTCScriptConfigRegistration{
					Coin:         coin,
					ScriptConfig: scriptConfig,
					Keypath:      keypathAccount,
				},
				Name: name,
			},
		},
	}
	response, err := device.queryBTC(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.BTCResponse_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}

// BTCSignMessageResult is the result of `BTCSignMessage()`.
type BTCSignMessageResult struct {
	// Signature is the 64 byte raw signature.
	Signature []byte
	// RecID is the recoverable ID.
	RecID byte
	// ElectrumSig65 is the 65 byte signature in Electrum format.
	ElectrumSig65 []byte
}

func (device *Device) nonAtomicBTCSignMessage(
	coin messages.BTCCoin,
	scriptConfig *messages.BTCScriptConfigWithKeypath,
	message []byte,
) (*BTCSignMessageResult, error) {
	if isTaproot(scriptConfig) {
		return nil, errp.New("taproot not supported")
	}
	if !device.version.AtLeast(semver.NewSemVer(9, 2, 0)) {
		return nil, UnsupportedError("9.2.0")
	}

	supportsAntiklepto := device.version.AtLeast(semver.NewSemVer(9, 5, 0))
	var hostNonceCommitment *messages.AntiKleptoHostNonceCommitment
	var hostNonce []byte

	if supportsAntiklepto {
		var err error
		hostNonce, err = generateHostNonce()
		if err != nil {
			return nil, err
		}
		hostNonceCommitment = &messages.AntiKleptoHostNonceCommitment{
			Commitment: antikleptoHostCommit(hostNonce),
		}
	}

	request := &messages.BTCRequest{
		Request: &messages.BTCRequest_SignMessage{
			SignMessage: &messages.BTCSignMessageRequest{
				Coin:                coin,
				ScriptConfig:        scriptConfig,
				Msg:                 message,
				HostNonceCommitment: hostNonceCommitment,
			},
		},
	}
	response, err := device.nonAtomicQueryBTC(request)
	if err != nil {
		return nil, err
	}

	var signature []byte
	if supportsAntiklepto {
		signerCommitment, ok := response.Response.(*messages.BTCResponse_AntikleptoSignerCommitment)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		response, err := device.nonAtomicQueryBTC(&messages.BTCRequest{
			Request: &messages.BTCRequest_AntikleptoSignature{
				AntikleptoSignature: &messages.AntiKleptoSignatureRequest{
					HostNonce: hostNonce,
				},
			},
		})
		if err != nil {
			return nil, err
		}

		signResponse, ok := response.Response.(*messages.BTCResponse_SignMessage)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		signature = signResponse.SignMessage.Signature
		err = antikleptoVerify(
			hostNonce,
			signerCommitment.AntikleptoSignerCommitment.Commitment,
			signature[:64],
		)
		if err != nil {
			return nil, err
		}
	} else {
		signResponse, ok := response.Response.(*messages.BTCResponse_SignMessage)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		signature = signResponse.SignMessage.Signature
	}

	sig, recID := signature[:64], signature[64]
	// See https://github.com/spesmilo/electrum/blob/84dc181b6e7bb20e88ef6b98fb8925c5f645a765/electrum/ecc.py#L521-L523
	const compressed = 4 // BitBox02 uses only compressed pubkeys
	electrumSig65 := append([]byte{27 + compressed + recID}, sig...)
	return &BTCSignMessageResult{
		Signature:     sig,
		RecID:         recID,
		ElectrumSig65: electrumSig65,
	}, nil
}

// BTCSignMessage signs a Bitcoin message.
func (device *Device) BTCSignMessage(
	coin messages.BTCCoin,
	scriptConfig *messages.BTCScriptConfigWithKeypath,
	message []byte,
) (*BTCSignMessageResult, error) {
	return atomicQueriesValue(device, func() (*BTCSignMessageResult, error) {
		return device.nonAtomicBTCSignMessage(coin, scriptConfig, message)
	})
}
