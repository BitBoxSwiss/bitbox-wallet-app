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
	"math/big"

	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
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

	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_Sign{
			Sign: &messages.ETHSignRequest{
				Coin:                coin,
				Keypath:             keypath,
				Nonce:               new(big.Int).SetUint64(nonce).Bytes(),
				GasPrice:            gasPrice.Bytes(),
				GasLimit:            new(big.Int).SetUint64(gasLimit).Bytes(),
				Recipient:           recipient[:],
				Value:               value.Bytes(),
				Data:                data,
				HostNonceCommitment: hostNonceCommitment,
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return nil, err
	}

	if supportsAntiklepto {
		signerCommitment, ok := response.Response.(*messages.ETHResponse_AntikleptoSignerCommitment)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		response, err := device.queryETH(&messages.ETHRequest{
			Request: &messages.ETHRequest_AntikleptoSignature{
				AntikleptoSignature: &messages.AntiKleptoSignatureRequest{
					HostNonce: hostNonce,
				},
			},
		})
		if err != nil {
			return nil, err
		}
		signResponse, ok := response.Response.(*messages.ETHResponse_Sign)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		signature := signResponse.Sign.Signature
		err = antikleptoVerify(
			hostNonce,
			signerCommitment.AntikleptoSignerCommitment.Commitment,
			signature[:64],
		)
		if err != nil {
			return nil, err
		}
		return signature, nil
	}
	signResponse, ok := response.Response.(*messages.ETHResponse_Sign)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return signResponse.Sign.Signature, nil
}

// ETHSignMessage signs an Ethereum message. The provided msg will be prefixed with "\x19Ethereum
// message\n" + len(msg) in the hardware, e.g. "\x19Ethereum\n5hello" (yes, the len prefix is the
// ascii representation with no fixed size or delimiter, WTF).
// 27 is added to the recID to denote an uncompressed pubkey.
func (device *Device) ETHSignMessage(
	coin messages.ETHCoin,
	keypath []uint32,
	msg []byte,
) ([]byte, error) {
	if len(msg) > 1024 {
		return nil, errp.New("message too large")
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

	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_SignMsg{
			SignMsg: &messages.ETHSignMessageRequest{
				Coin:                coin,
				Keypath:             keypath,
				Msg:                 msg,
				HostNonceCommitment: hostNonceCommitment,
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return nil, err
	}

	if supportsAntiklepto {
		signerCommitment, ok := response.Response.(*messages.ETHResponse_AntikleptoSignerCommitment)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		response, err := device.queryETH(&messages.ETHRequest{
			Request: &messages.ETHRequest_AntikleptoSignature{
				AntikleptoSignature: &messages.AntiKleptoSignatureRequest{
					HostNonce: hostNonce,
				},
			},
		})
		if err != nil {
			return nil, err
		}

		signResponse, ok := response.Response.(*messages.ETHResponse_Sign)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		signature := signResponse.Sign.Signature
		err = antikleptoVerify(
			hostNonce,
			signerCommitment.AntikleptoSignerCommitment.Commitment,
			signature[:64],
		)
		if err != nil {
			return nil, err
		}
		// 27 is the magic constant to add to the recoverable ID to denote an uncompressed pubkey.
		signature[64] += 27
		return signature, nil
	}

	signResponse, ok := response.Response.(*messages.ETHResponse_Sign)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	signature := signResponse.Sign.Signature
	// 27 is the magic constant to add to the recoverable ID to denote an uncompressed pubkey.
	signature[64] += 27

	return signature, nil
}
