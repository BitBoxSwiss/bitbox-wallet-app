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
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
)

// BIP85 invokes the BIP-85 workflow on the device, letting the user select the number of words (12,
// 28, 24) and an index and display a derived BIP-39 mnemonic.
func (device *Device) BIP85() error {
	if !device.version.AtLeast(semver.NewSemVer(9, 16, 0)) {
		return UnsupportedError("9.16.0")
	}

	request := &messages.Request{
		Request: &messages.Request_Bip85{
			Bip85: &messages.BIP85Request{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Bip85)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}
