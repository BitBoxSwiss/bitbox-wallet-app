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

	"github.com/btcsuite/btcutil/base58"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/golang/protobuf/proto"
)

const multisigNameMaxLen = 30

// queryBTC is like query, but nested one level deeper.
func (device *Device) queryBTC(request *messages.BTCRequest) (*messages.BTCResponse, error) {
	response, err := device.query(&messages.Request{
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

func (device *Device) queryBtcSign(request proto.Message) (
	*messages.BTCSignNextResponse, error) {
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	next, ok := response.Response.(*messages.Response_BtcSignNext)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return next.BtcSignNext, nil

}

// BTCSign signs a bitcoin or bitcoin-like transaction. Returns one 64 byte signature per input.
func (device *Device) BTCSign(
	coin messages.BTCCoin,
	scriptConfig *messages.BTCScriptConfig,
	keypathAccount []uint32,
	inputs []*messages.BTCSignInputRequest,
	outputs []*messages.BTCSignOutputRequest,
	version uint32,
	locktime uint32,
) ([][]byte, error) {
	signatures := make([][]byte, len(inputs))
	next, err := device.queryBtcSign(&messages.Request{
		Request: &messages.Request_BtcSignInit{
			BtcSignInit: &messages.BTCSignInitRequest{
				Coin:           coin,
				ScriptConfig:   scriptConfig,
				KeypathAccount: keypathAccount,
				Version:        version,
				NumInputs:      uint32(len(inputs)),
				NumOutputs:     uint32(len(outputs)),
				Locktime:       locktime,
			}}})
	if err != nil {
		return nil, err
	}
	for {
		switch next.Type {
		case messages.BTCSignNextResponse_INPUT:
			inputIndex := next.Index
			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignInput{
					BtcSignInput: inputs[inputIndex],
				}})
			if err != nil {
				return nil, err
			}
			if next.HasSignature {
				signatures[inputIndex] = next.Signature
			}
		case messages.BTCSignNextResponse_OUTPUT:
			outputIndex := next.Index
			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignOutput{
					BtcSignOutput: outputs[outputIndex],
				}})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_DONE:
			return signatures, nil
		}
	}
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
