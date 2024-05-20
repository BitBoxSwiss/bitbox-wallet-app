// Copyright 2023 Shift Crypto AG
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
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"google.golang.org/protobuf/types/known/emptypb"
)

// BIP85AppBip39 invokes the BIP85-BIP39 workflow on the device, letting the user select the number of
// words (12, 28, 24) and an index and display a derived BIP-39 mnemonic.
func (device *Device) BIP85AppBip39() error {
	if !device.version.AtLeast(semver.NewSemVer(9, 17, 0)) {
		return UnsupportedError("9.17.0")
	}

	request := &messages.Request{
		Request: &messages.Request_Bip85{
			Bip85: &messages.BIP85Request{
				App: &messages.BIP85Request_Bip39{
					Bip39: &emptypb.Empty{},
				},
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	bip85Response, ok := response.Response.(*messages.Response_Bip85)
	if !ok {
		return errp.New("unexpected response")
	}
	_, ok = bip85Response.Bip85.App.(*messages.BIP85Response_Bip39)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}

// BIP85AppLN invokes the BIP85-LN workflow on the device, returning 16 bytes of derived entropy for
// use with Breez-SDK.
func (device *Device) BIP85AppLN() ([]byte, error) {
	if !device.version.AtLeast(semver.NewSemVer(9, 17, 0)) {
		return nil, UnsupportedError("9.17.0")
	}

	request := &messages.Request{
		Request: &messages.Request_Bip85{
			Bip85: &messages.BIP85Request{
				App: &messages.BIP85Request_Ln{
					Ln: &messages.BIP85Request_AppLn{
						// Only account_number=0 is allowed for now.
						AccountNumber: 0,
					},
				},
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	bip85Response, ok := response.Response.(*messages.Response_Bip85)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	lnResponse, ok := bip85Response.Bip85.App.(*messages.BIP85Response_Ln)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return lnResponse.Ln, nil
}
