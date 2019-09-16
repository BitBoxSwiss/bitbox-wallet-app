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

package bitbox02

import (
	"math/big"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// queryETH is like query, but nested one level deeper for Ethereum.
func (device *Device) queryETH(request *messages.ETHRequest) (*messages.ETHResponse, error) {
	response, err := device.query(&messages.Request{
		Request: &messages.Request_Eth{
			Eth: request,
		},
	})
	if err != nil {
		return nil, err
	}
	ethResponse, ok := response.Response.(*messages.Response_Eth)
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	return ethResponse.Eth, nil
}

// ETHPub queries the device for an ethereum address or publickey.
func (device *Device) ETHPub(
	coin messages.ETHCoin,
	keypath []uint32,
	outputType messages.ETHPubRequest_OutputType,
	display bool,
	contractAddress []byte,
) (string, error) {
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_Pub{
			Pub: &messages.ETHPubRequest{
				Coin:            coin,
				Keypath:         keypath,
				OutputType:      outputType,
				Display:         display,
				ContractAddress: contractAddress,
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.ETHResponse_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

// ETHSign signs an ethereum transaction. It returns a 65 byte signature (R, S, and 1 byte recID).
func (device *Device) ETHSign(
	coin messages.ETHCoin,
	keypath []uint32,
	nonce uint64,
	gasPrice *big.Int,
	gasLimit uint64,
	recipient [20]byte,
	value *big.Int,
	data []byte) ([]byte, error) {
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_Sign{
			Sign: &messages.ETHSignRequest{
				Coin:      coin,
				Keypath:   keypath,
				Nonce:     new(big.Int).SetUint64(nonce).Bytes(),
				GasPrice:  gasPrice.Bytes(),
				GasLimit:  new(big.Int).SetUint64(gasLimit).Bytes(),
				Recipient: recipient[:],
				Value:     value.Bytes(),
				Data:      data,
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return nil, err
	}
	signResponse, ok := response.Response.(*messages.ETHResponse_Sign)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return signResponse.Sign.Signature, nil
}
