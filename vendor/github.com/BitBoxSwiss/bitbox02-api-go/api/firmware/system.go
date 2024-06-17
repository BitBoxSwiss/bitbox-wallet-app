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
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

// SetDeviceName sends a request to the device using protobuf to set the device name.
func (device *Device) SetDeviceName(deviceName string) error {
	if len(deviceName) > 64 {
		return errp.New("device name too long")
	}
	request := &messages.Request{
		Request: &messages.Request_DeviceName{
			DeviceName: &messages.SetDeviceNameRequest{
				Name: deviceName,
			},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return err
	}

	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("Failed to set device name")
	}

	return nil
}

// DeviceInfo retrieves the current device info from the bitbox.
func (device *Device) DeviceInfo() (*DeviceInfo, error) {
	request := &messages.Request{
		Request: &messages.Request_DeviceInfo{
			DeviceInfo: &messages.DeviceInfoRequest{},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return nil, err
	}

	deviceInfoResponse, ok := response.Response.(*messages.Response_DeviceInfo)
	if !ok {
		return nil, errp.New("Failed to retrieve device info")
	}

	deviceInfo := &DeviceInfo{
		Name:                      deviceInfoResponse.DeviceInfo.Name,
		Version:                   deviceInfoResponse.DeviceInfo.Version,
		Initialized:               deviceInfoResponse.DeviceInfo.Initialized,
		MnemonicPassphraseEnabled: deviceInfoResponse.DeviceInfo.MnemonicPassphraseEnabled,
		SecurechipModel:           deviceInfoResponse.DeviceInfo.SecurechipModel,
	}

	return deviceInfo, nil
}

// SetPassword invokes the set password workflow on the device. Should be called only if
// deviceInfo.Initialized is false.
//
// `seed_len` must be exactly 16 or 32, creating a 16-byte or a 32-byte seed, corresponding to 12
// resp. 24 BIP39 recovery words.
func (device *Device) SetPassword(seedLen int) error {
	if seedLen != 16 && seedLen != 32 {
		return errp.New("invalid seedLen")
	}
	if seedLen == 16 && !device.version.AtLeast(semver.NewSemVer(9, 6, 0)) {
		return UnsupportedError("9.6.0")
	}
	if device.status == StatusInitialized {
		return errp.New("invalid status")
	}
	request := &messages.Request{
		Request: &messages.Request_SetPassword{
			SetPassword: &messages.SetPasswordRequest{
				Entropy: bytesOrPanic(seedLen),
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
	device.changeStatus(StatusSeeded)
	return nil
}

func (device *Device) reboot(purpose messages.RebootRequest_Purpose) error {
	request := &messages.Request{
		Request: &messages.Request_Reboot{
			Reboot: &messages.RebootRequest{Purpose: purpose},
		},
	}

	_, err := device.query(request)
	// We only return bb02 errors. Otherwise we assume it's an IO error (read failed) due to the
	// reboot.
	if _, ok := errp.Cause(err).(*Error); ok {
		return err
	}
	return nil
}

// UpgradeFirmware reboots into the bootloader so a firmware can be flashed.
func (device *Device) UpgradeFirmware() error {
	return device.reboot(messages.RebootRequest_UPGRADE)
}

// GotoStartupSettings reboots into the bootloader with a 'Go to startup settings?' confirmation
// dialog.
func (device *Device) GotoStartupSettings() error {
	return device.reboot(messages.RebootRequest_SETTINGS)
}

// Reset factory resets the device. You must call device.Init() afterwards.
func (device *Device) Reset() error {
	request := &messages.Request{
		Request: &messages.Request_Reset_{
			Reset_: &messages.ResetRequest{},
		},
	}
	_, err := device.query(request)
	// We only return bb02 errors. Otherwise we assume it's an IO error (read failed) due to the
	// reboot.
	if _, ok := errp.Cause(err).(*Error); ok {
		return err
	}
	return nil
}
