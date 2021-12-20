// Copyright 2021 Shift Crypto AG
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
)

// queryCardano is like query, but nested one level deeper for Cardano.
func (device *Device) queryCardano(request *messages.CardanoRequest) (*messages.CardanoResponse, error) {
	response, err := device.query(&messages.Request{
		Request: &messages.Request_Cardano{
			Cardano: request,
		},
	})
	if err != nil {
		return nil, err
	}
	cardanoResponse, ok := response.Response.(*messages.Response_Cardano)
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	return cardanoResponse.Cardano, nil
}

// CardanoXPubs queries the device for Cardano account xpubs.
func (device *Device) CardanoXPubs(
	keypaths [][]uint32,
) ([][]byte, error) {
	pbKeypaths := make([]*messages.Keypath, len(keypaths))
	for i, keypath := range keypaths {
		pbKeypaths[i] = &messages.Keypath{Keypath: keypath}
	}
	request := &messages.CardanoRequest{
		Request: &messages.CardanoRequest_Xpubs{
			Xpubs: &messages.CardanoXpubsRequest{
				Keypaths: pbKeypaths,
			},
		},
	}
	response, err := device.queryCardano(request)
	if err != nil {
		return nil, err
	}
	pubResponse, ok := response.Response.(*messages.CardanoResponse_Xpubs)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return pubResponse.Xpubs.Xpubs, nil
}

// CardanoAddress queries the device for a Cardano address.
func (device *Device) CardanoAddress(
	network messages.CardanoNetwork,
	scriptConfig *messages.CardanoScriptConfig,
	display bool,
) (string, error) {
	request := &messages.CardanoRequest{
		Request: &messages.CardanoRequest_Address{
			Address: &messages.CardanoAddressRequest{
				Network:      network,
				Display:      display,
				ScriptConfig: scriptConfig,
			},
		},
	}
	response, err := device.queryCardano(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.CardanoResponse_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

// CardanoSignTransaction signs a Cardano transaction.
func (device *Device) CardanoSignTransaction(
	transaction *messages.CardanoSignTransactionRequest,
) (*messages.CardanoSignTransactionResponse, error) {
	request := &messages.CardanoRequest{
		Request: &messages.CardanoRequest_SignTransaction{
			SignTransaction: transaction,
		},
	}
	response, err := device.queryCardano(request)
	if err != nil {
		return nil, err
	}
	signResponse, ok := response.Response.(*messages.CardanoResponse_SignTransaction)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return signResponse.SignTransaction, nil
}
