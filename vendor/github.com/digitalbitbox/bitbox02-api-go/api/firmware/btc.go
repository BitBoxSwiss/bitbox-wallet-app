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
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/golang/protobuf/proto"
)

// NewBTCScriptConfigSimple is a helper to construct the correct script config for simple script
// types.
func NewBTCScriptConfigSimple(typ messages.BTCScriptConfig_SimpleType) *messages.BTCScriptConfig {
	return &messages.BTCScriptConfig{
		Config: &messages.BTCScriptConfig_SimpleType_{
			SimpleType: typ,
		},
	}
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
