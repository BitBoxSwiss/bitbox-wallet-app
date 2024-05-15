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
	"encoding/hex"
	"encoding/json"
	"math/big"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
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

// ethCoin the deprecated `coin` enum value for a given chain_id. Only ETH, Ropsten and Rinkeby are
// converted, as these were the only supported networks up to v9.10.0. With v9.10.0, the chain ID is
// passed directly, and the `coin` field is ignored.
func (device *Device) ethCoin(chainID uint64) (messages.ETHCoin, error) {
	if !device.version.AtLeast(semver.NewSemVer(9, 10, 0)) {
		switch chainID {
		case 1:
			return messages.ETHCoin_ETH, nil
		case 3:
			return messages.ETHCoin_RopstenETH, nil
		case 4:
			return messages.ETHCoin_RinkebyETH, nil
		default:
			return 0, errp.New("unsupported chain ID")
		}
	}
	return messages.ETHCoin_ETH, nil
}

// ETHPub queries the device for an ethereum address or publickey.
func (device *Device) ETHPub(
	chainID uint64,
	keypath []uint32,
	outputType messages.ETHPubRequest_OutputType,
	display bool,
	contractAddress []byte,
) (string, error) {
	coin, err := device.ethCoin(chainID)
	if err != nil {
		return "", err
	}
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_Pub{
			Pub: &messages.ETHPubRequest{
				Coin:            coin,
				ChainId:         chainID,
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

func handleHostNonceCommitment() (*messages.AntiKleptoHostNonceCommitment, []byte, error) {
	hostNonce, err := generateHostNonce()
	if err != nil {
		return nil, nil, err
	}
	hostNonceCommitment := &messages.AntiKleptoHostNonceCommitment{
		Commitment: antikleptoHostCommit(hostNonce),
	}

	return hostNonceCommitment, hostNonce, nil
}

func (device *Device) handleSignerNonceCommitment(response *messages.ETHResponse, hostNonce []byte) ([]byte, error) {
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

// ETHSign signs an ethereum transaction. It returns a 65 byte signature (R, S, and 1 byte recID).
func (device *Device) ETHSign(
	chainID uint64,
	keypath []uint32,
	nonce uint64,
	gasPrice *big.Int,
	gasLimit uint64,
	recipient [20]byte,
	value *big.Int,
	data []byte) ([]byte, error) {
	supportsAntiklepto := device.version.AtLeast(semver.NewSemVer(9, 5, 0))

	var hostNonceCommitment *messages.AntiKleptoHostNonceCommitment
	var err error
	var hostNonce []byte

	if supportsAntiklepto {
		hostNonceCommitment, hostNonce, err = handleHostNonceCommitment()
		if err != nil {
			return nil, err
		}
	}

	coin, err := device.ethCoin(chainID)
	if err != nil {
		return nil, err
	}
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_Sign{
			Sign: &messages.ETHSignRequest{
				Coin:                coin,
				ChainId:             chainID,
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
		signature, err := device.handleSignerNonceCommitment(response, hostNonce)
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

// ETHSignEIP1559 signs an ethereum EIP1559 transaction. It returns a 65 byte signature (R, S, and 1 byte recID).
func (device *Device) ETHSignEIP1559(
	chainID uint64,
	keypath []uint32,
	nonce uint64,
	maxPriorityFeePerGas *big.Int,
	maxFeePerGas *big.Int,
	gasLimit uint64,
	recipient [20]byte,
	value *big.Int,
	data []byte) ([]byte, error) {

	if !device.version.AtLeast(semver.NewSemVer(9, 16, 0)) {
		return nil, UnsupportedError("9.16.0")
	}

	hostNonceCommitment, hostNonce, err := handleHostNonceCommitment()
	if err != nil {
		return nil, err
	}

	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_SignEip1559{
			SignEip1559: &messages.ETHSignEIP1559Request{
				ChainId:              chainID,
				Keypath:              keypath,
				Nonce:                new(big.Int).SetUint64(nonce).Bytes(),
				MaxPriorityFeePerGas: maxPriorityFeePerGas.Bytes(),
				MaxFeePerGas:         maxFeePerGas.Bytes(),
				GasLimit:             new(big.Int).SetUint64(gasLimit).Bytes(),
				Recipient:            recipient[:],
				Value:                value.Bytes(),
				Data:                 data,
				HostNonceCommitment:  hostNonceCommitment,
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return nil, err
	}

	signature, err := device.handleSignerNonceCommitment(response, hostNonce)
	if err != nil {
		return nil, err
	}
	return signature, nil
}

// ETHSignMessage signs an Ethereum message. The provided msg will be prefixed with "\x19Ethereum
// message\n" + len(msg) in the hardware, e.g. "\x19Ethereum\n5hello" (yes, the len prefix is the
// ascii representation with no fixed size or delimiter, WTF).
// 27 is added to the recID to denote an uncompressed pubkey.
func (device *Device) ETHSignMessage(
	chainID uint64,
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

	coin, err := device.ethCoin(chainID)
	if err != nil {
		return nil, err
	}
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_SignMsg{
			SignMsg: &messages.ETHSignMessageRequest{
				Coin:                coin,
				ChainId:             chainID,
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

func parseType(typ string, types map[string]interface{}) (*messages.ETHSignTypedMessageRequest_MemberType, error) {
	if strings.HasSuffix(typ, "]") {
		index := strings.LastIndexByte(typ, '[')
		typ = typ[:len(typ)-1]
		rest, size := typ[:index], typ[index+1:]
		var sizeInt uint32
		if size != "" {
			i, err := strconv.ParseUint(size, 10, 32)
			if err != nil {
				return nil, errp.WithStack(err)
			}
			sizeInt = uint32(i)
		}
		arrayType, err := parseType(rest, types)
		if err != nil {
			return nil, err
		}
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type:      messages.ETHSignTypedMessageRequest_ARRAY,
			Size:      sizeInt,
			ArrayType: arrayType,
		}, nil
	}
	if strings.HasPrefix(typ, "bytes") {
		size := typ[5:]
		var sizeInt uint32
		if size != "" {
			i, err := strconv.ParseUint(size, 10, 32)
			if err != nil {
				return nil, errp.WithStack(err)
			}
			sizeInt = uint32(i)
		}
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_BYTES,
			Size: sizeInt,
		}, nil
	}

	if strings.HasPrefix(typ, "uint") {
		size := typ[4:]
		if size == "" {
			return nil, errp.New("uint must be sized")
		}
		sizeInt, err := strconv.ParseUint(size, 10, 32)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_UINT,
			Size: uint32(sizeInt) / 8,
		}, nil
	}
	if strings.HasPrefix(typ, "int") {
		size := typ[3:]
		if size == "" {
			return nil, errp.New("int must be sized")
		}
		sizeInt, err := strconv.ParseUint(size, 10, 32)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_INT,
			Size: uint32(sizeInt) / 8,
		}, nil
	}
	if typ == "bool" {
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_BOOL,
		}, nil
	}
	if typ == "address" {
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_ADDRESS,
		}, nil
	}
	if typ == "string" {
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type: messages.ETHSignTypedMessageRequest_STRING,
		}, nil
	}
	if _, ok := types[typ]; ok {
		return &messages.ETHSignTypedMessageRequest_MemberType{
			Type:       messages.ETHSignTypedMessageRequest_STRUCT,
			StructName: typ,
		}, nil
	}
	return nil, errp.Newf("Can't recognize type: %s", typ)
}

// Golang's stdlib doesn't support serializing signed integers in big endian (two's complement).
// -x = ~x+1.
func bigendianInt(integer *big.Int) []byte {
	if integer.Sign() >= 0 {
		return integer.Bytes()
	}
	bytes := append([]byte{0}, integer.Bytes()...)
	for i, v := range bytes {
		bytes[i] = ^v
	}
	return new(big.Int).Add(new(big.Int).SetBytes(bytes), big.NewInt(1)).Bytes()
}

// encodeValue encodes a json decoded typed data value to send to the BitBox02 as part of the
// SignTypedData signing process. There is no strict error checking (e.g. that the size is correct
// according to the type) as the BitBox02 checks for bad input.
func encodeValue(typ *messages.ETHSignTypedMessageRequest_MemberType, value interface{}) ([]byte, error) {
	switch typ.Type {
	case messages.ETHSignTypedMessageRequest_BYTES:
		v := value.(string)
		if strings.HasPrefix(v, "0x") || strings.HasPrefix(v, "0X") {
			return hex.DecodeString(v[2:])
		}
		return []byte(v), nil
	case messages.ETHSignTypedMessageRequest_UINT:
		bigint := new(big.Int)
		switch v := value.(type) {
		case string:
			if strings.HasPrefix(v, "0x") || strings.HasPrefix(v, "0X") {
				_, ok := bigint.SetString(v[2:], 16)
				if !ok {
					return nil, errp.Newf("couldn't parse uint: %s", v)
				}
			} else {
				_, ok := bigint.SetString(v, 10)
				if !ok {
					return nil, errp.Newf("couldn't parse uint: %s", v)
				}
			}
		case float64:
			v64 := uint64(v)
			if float64(v64) != v {
				return nil, errp.Newf("float64 is not an uint: %v", v)
			}
			bigint.SetUint64(v64)
		default:
			return nil, errp.New("wrong type for uint")
		}
		return bigint.Bytes(), nil
	case messages.ETHSignTypedMessageRequest_INT:
		bigint := new(big.Int)
		switch v := value.(type) {
		case string:
			_, ok := bigint.SetString(v, 10)
			if !ok {
				return nil, errp.Newf("couldn't parse int: %s", v)
			}
		case float64:
			v64 := int64(v)
			if float64(v64) != v {
				return nil, errp.Newf("float64 is not an int: %v", v)
			}
			bigint.SetInt64(v64)
		default:
			return nil, errp.New("wrong type for int")
		}
		return bigendianInt(bigint), nil
	case messages.ETHSignTypedMessageRequest_BOOL:
		if value.(bool) {
			return []byte{1}, nil
		}
		return []byte{0}, nil
	case messages.ETHSignTypedMessageRequest_ADDRESS, messages.ETHSignTypedMessageRequest_STRING:
		return []byte(value.(string)), nil
	case messages.ETHSignTypedMessageRequest_ARRAY:
		size := uint32(len(value.([]interface{})))
		result := make([]byte, 4)
		binary.BigEndian.PutUint32(result, size)
		return result, nil
	}

	return nil, errp.New("couldn't encode value")
}

func getValue(what *messages.ETHTypedMessageValueResponse, msg map[string]interface{}) ([]byte, error) {
	types := msg["types"].(map[string]interface{})

	var value interface{}
	var typ *messages.ETHSignTypedMessageRequest_MemberType

	switch what.RootObject {
	case messages.ETHTypedMessageValueResponse_DOMAIN:
		value = msg["domain"]
		var err error
		typ, err = parseType("EIP712Domain", types)
		if err != nil {
			return nil, err
		}
	case messages.ETHTypedMessageValueResponse_MESSAGE:
		value = msg["message"]
		var err error
		typ, err = parseType(msg["primaryType"].(string), types)
		if err != nil {
			return nil, err
		}
	default:
		return nil, errp.Newf("unknown root: %v", what.RootObject)
	}
	for _, element := range what.Path {
		switch typ.Type {
		case messages.ETHSignTypedMessageRequest_STRUCT:
			structMember := types[typ.StructName].([]interface{})[element].(map[string]interface{})
			value = value.(map[string]interface{})[structMember["name"].(string)]
			var err error
			typ, err = parseType(structMember["type"].(string), types)
			if err != nil {
				return nil, err
			}
		case messages.ETHSignTypedMessageRequest_ARRAY:
			value = value.([]interface{})[element]
			typ = typ.ArrayType
		default:
			return nil, errp.New("path element does not point to struct or array")
		}
	}
	return encodeValue(typ, value)
}

// ETHSignTypedMessage signs an Ethereum EIP-712 typed message. 27 is added to the recID to denote
// an uncompressed pubkey.
func (device *Device) ETHSignTypedMessage(
	chainID uint64,
	keypath []uint32,
	jsonMsg []byte,
) ([]byte, error) {
	if !device.version.AtLeast(semver.NewSemVer(9, 12, 0)) {
		return nil, UnsupportedError("9.12.0")
	}

	var msg map[string]interface{}
	if err := json.Unmarshal(jsonMsg, &msg); err != nil {
		return nil, errp.WithStack(err)
	}

	hostNonce, err := generateHostNonce()
	if err != nil {
		return nil, err
	}

	types := msg["types"].(map[string]interface{})
	var parsedTypes []*messages.ETHSignTypedMessageRequest_StructType
	for key, value := range types {
		var members []*messages.ETHSignTypedMessageRequest_Member
		for _, member := range value.([]interface{}) {
			memberS := member.(map[string]interface{})
			parsedType, err := parseType(memberS["type"].(string), types)
			if err != nil {
				return nil, err
			}
			members = append(members, &messages.ETHSignTypedMessageRequest_Member{
				Name: memberS["name"].(string),
				Type: parsedType,
			})
		}
		parsedTypes = append(parsedTypes, &messages.ETHSignTypedMessageRequest_StructType{
			Name:    key,
			Members: members,
		})
	}
	request := &messages.ETHRequest{
		Request: &messages.ETHRequest_SignTypedMsg{
			SignTypedMsg: &messages.ETHSignTypedMessageRequest{
				ChainId:     chainID,
				Keypath:     keypath,
				Types:       parsedTypes,
				PrimaryType: msg["primaryType"].(string),
				HostNonceCommitment: &messages.AntiKleptoHostNonceCommitment{
					Commitment: antikleptoHostCommit(hostNonce),
				},
			},
		},
	}
	response, err := device.queryETH(request)
	if err != nil {
		return nil, err
	}

	typedMsgValueResponse, ok := response.Response.(*messages.ETHResponse_TypedMsgValue)
	for ok {
		value, err := getValue(typedMsgValueResponse.TypedMsgValue, msg)
		if err != nil {
			return nil, err
		}
		response, err = device.queryETH(&messages.ETHRequest{
			Request: &messages.ETHRequest_TypedMsgValue{
				TypedMsgValue: &messages.ETHTypedMessageValueRequest{
					Value: value,
				},
			},
		})
		if err != nil {
			return nil, err
		}
		typedMsgValueResponse, ok = response.Response.(*messages.ETHResponse_TypedMsgValue)
	}

	signerCommitment, ok := response.Response.(*messages.ETHResponse_AntikleptoSignerCommitment)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	response, err = device.queryETH(&messages.ETHRequest{
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
