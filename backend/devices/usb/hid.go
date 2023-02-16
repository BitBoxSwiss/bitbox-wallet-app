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

package usb

import (
	"encoding/hex"
	"io"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	hid "github.com/digitalbitbox/usb"
)

type hidDeviceInfo struct {
	hid.DeviceInfo
}

// VendorID implements DeviceInfo.
func (info hidDeviceInfo) VendorID() int {
	return int(info.DeviceInfo.VendorID)
}

// ProductID implements DeviceInfo.
func (info hidDeviceInfo) ProductID() int {
	return int(info.DeviceInfo.ProductID)
}

// UsagePage implements DeviceInfo.
func (info hidDeviceInfo) UsagePage() int {
	return int(info.DeviceInfo.UsagePage)
}

// Interface implements DeviceInfo.
func (info hidDeviceInfo) Interface() int {
	return info.DeviceInfo.Interface
}

// Serial implements DeviceInfo.
func (info hidDeviceInfo) Serial() string {
	return info.DeviceInfo.Serial
}

// Manufacturer implements DeviceInfo.
func (info hidDeviceInfo) Manufacturer() string {
	return info.DeviceInfo.Manufacturer
}

// Product implements DeviceInfo.
func (info hidDeviceInfo) Product() string {
	return info.DeviceInfo.Product
}

// Identifier implements DeviceInfo.
func (info hidDeviceInfo) Identifier() string {
	return hex.EncodeToString([]byte(info.DeviceInfo.Path))
}

// Open implements DeviceInfo.
func (info hidDeviceInfo) Open() (io.ReadWriteCloser, error) {
	device, err := info.DeviceInfo.Open()
	if err != nil {
		return nil, err
	}
	return device, nil
}

// DeviceInfos returns a slice of all recognized devices.
func DeviceInfos() []DeviceInfo {
	deviceInfosFiltered := []DeviceInfo{}

	// The library never actually returns an error in this function.
	deviceInfos, err := hid.EnumerateHid(0, 0)
	if err != nil {
		logging.Get().WithError(err).Error("EnumerateHid() returned an error")
		return deviceInfosFiltered
	}

	for idx := range deviceInfos {
		di := hidDeviceInfo{deviceInfos[idx]}
		// If Enumerate() is called too quickly after a device is inserted, the HID device input
		// report is not yet ready.
		if di.Serial() == "" || di.Product() == "" {
			continue
		}
		if isBitBox(di) || isBitBox02(di) || isBitBox02Bootloader(di) {
			deviceInfosFiltered = append(deviceInfosFiltered, di)
		}
	}
	return deviceInfosFiltered
}
