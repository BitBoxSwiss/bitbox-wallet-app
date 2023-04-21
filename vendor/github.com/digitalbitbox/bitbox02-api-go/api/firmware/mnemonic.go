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
	"fmt"
	"time"

	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

// ShowMnemonic lets the user export the bip39 mnemonic phrase on the device.
func (device *Device) ShowMnemonic() error {
	request := &messages.Request{
		Request: &messages.Request_ShowMnemonic{
			ShowMnemonic: &messages.ShowMnemonicRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	if device.status == StatusSeeded {
		device.changeStatus(StatusInitialized)
	}
	return nil
}

// RestoreFromMnemonic invokes the mnemonic phrase import workflow.
func (device *Device) RestoreFromMnemonic() error {
	now := time.Now()
	_, offset := now.Zone()
	request := &messages.Request{
		Request: &messages.Request_RestoreFromMnemonic{
			RestoreFromMnemonic: &messages.RestoreFromMnemonicRequest{
				Timestamp:      uint32(now.Unix()),
				TimezoneOffset: int32(offset),
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.changeStatus(StatusInitialized)
	return nil
}

// SetMnemonicPassphraseEnabled enables or disables entering a mnemonic passphrase after the normal
// unlock.
func (device *Device) SetMnemonicPassphraseEnabled(enabled bool) error {
	request := &messages.Request{
		Request: &messages.Request_SetMnemonicPassphraseEnabled{
			SetMnemonicPassphraseEnabled: &messages.SetMnemonicPassphraseEnabledRequest{
				Enabled: enabled,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.log.Info(fmt.Sprintf("SetMnemonicPassphraseEnabled=%v successfully finished", enabled))
	return nil
}
