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
	"github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

// queryBitBoxBase is like query, but nested one level deeper for BitBoxBase.
func (device *Device) queryBitBoxBase(request *messages.BitBoxBaseRequest) (
	*messages.Response, error) {
	if *device.product != common.ProductBitBoxBaseStandard {
		return nil, errp.New("not supported for this product")
	}
	return device.query(&messages.Request{
		Request: &messages.Request_Bitboxbase{
			Bitboxbase: request,
		},
	})
}

// BitBoxBaseHeartbeat sends a heartbeat request with the given state and description codes.
func (device *Device) BitBoxBaseHeartbeat(
	stateCode messages.BitBoxBaseHeartbeatRequest_StateCode,
	descriptionCode messages.BitBoxBaseHeartbeatRequest_DescriptionCode,
) error {
	request := &messages.BitBoxBaseRequest{
		Request: &messages.BitBoxBaseRequest_Heartbeat{
			Heartbeat: &messages.BitBoxBaseHeartbeatRequest{
				StateCode:       stateCode,
				DescriptionCode: descriptionCode,
			},
		},
	}
	response, err := device.queryBitBoxBase(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil

}

// BitBoxBaseConfirmPairing sends a pairing hash preimage to the BitBoxBase HSM, which displays it
// as a pairing code: 20 chars of the base32 encoding of `hash(msg)`. Intended use is to pass the
// BitBoxApp<->BitBoxBase (middleware) noise handshake hash as `msg` (32 bytes).
// If the user accepts, on error is returned.
// If the user rejects, `firmware.IsErrorAbort(err)` is true.
func (device *Device) BitBoxBaseConfirmPairing(
	msg []byte,
) error {
	if len(msg) != 32 {
		panic("pairing message must be 32 bytes")
	}
	request := &messages.BitBoxBaseRequest{
		Request: &messages.BitBoxBaseRequest_ConfirmPairing{
			ConfirmPairing: &messages.BitBoxBaseConfirmPairingRequest{
				Msg: msg,
			},
		},
	}
	response, err := device.queryBitBoxBase(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil

}

// BitBoxBaseSetConfig sets the transient config values in the BitBoxBase. ip is optional.
func (device *Device) BitBoxBaseSetConfig(
	statusLedMode messages.BitBoxBaseSetConfigRequest_StatusLedMode,
	statusScreenMode messages.BitBoxBaseSetConfigRequest_StatusScreenMode,
	ip *[4]uint8,
	hostname string,
) error {
	if len(hostname) > 64 {
		return errp.New("hostname too long")
	}
	var ipOption *messages.BitBoxBaseSetConfigRequest_Ip
	if ip != nil {
		ipOption = &messages.BitBoxBaseSetConfigRequest_Ip{
			Ip: (*ip)[:],
		}
	}
	request := &messages.BitBoxBaseRequest{
		Request: &messages.BitBoxBaseRequest_SetConfig{
			SetConfig: &messages.BitBoxBaseSetConfigRequest{
				StatusLedMode:    statusLedMode,
				StatusScreenMode: statusScreenMode,
				IpOption:         ipOption,
				Hostname:         hostname,
			},
		},
	}
	response, err := device.queryBitBoxBase(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}
