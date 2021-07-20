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
)

// CheckSDCard checks whether an sd card is inserted in the device.
func (device *Device) CheckSDCard() (bool, error) {
	request := &messages.Request{
		Request: &messages.Request_CheckSdcard{
			CheckSdcard: &messages.CheckSDCardRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return false, err
	}
	sdCardInserted, ok := response.Response.(*messages.Response_CheckSdcard)
	if !ok {
		return false, errp.New("unexpected response")
	}
	return sdCardInserted.CheckSdcard.Inserted, nil
}

// InsertRemoveSDCard sends a command to the device to insert of remove the sd card based on the workflow state.
func (device *Device) InsertRemoveSDCard(action messages.InsertRemoveSDCardRequest_SDCardAction) error {
	request := &messages.Request{
		Request: &messages.Request_InsertRemoveSdcard{
			InsertRemoveSdcard: &messages.InsertRemoveSDCardRequest{
				Action: action,
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
	return nil
}
