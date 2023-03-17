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
	"runtime"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	hid "github.com/digitalbitbox/usb"
)

// Run functions sent to this channel in a goroutine fixed to an OS thread. We will run all hidapi
// API calls in that thread. This is needed for hidapi to work properly on macOS. The reason for
// this is not entirely clear - maybe something in the macOS SDK relies on thread-local variables
// between HID API calls. See also https://github.com/libusb/hidapi/issues/503.
var funcCalls chan func()

func init() {
	if runtime.GOOS == "darwin" {
		funcCalls = make(chan func())
		go func() {
			runtime.LockOSThread()
			for {
				f := <-funcCalls
				f()
			}
		}()
	}
}

type funcCallResult[T any] struct {
	value T
	err   error
}

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

// singleThreadedDevice runs all hidapi functions in the same OS thread. See the docs of the
// `funcCalls` variable for more info. Implements io.ReadWriteCloser, like `hid.Device`.
type singleThreadedDevice struct {
	device hid.Device
}

// Write wraps hid.Device.Write to run in a dedicated OS thread.
func (s singleThreadedDevice) Write(b []byte) (int, error) {
	ch := make(chan funcCallResult[int])
	funcCalls <- func() {
		written, err := s.device.Write(b)
		ch <- funcCallResult[int]{written, err}
	}
	result := <-ch
	return result.value, result.err
}

// Read wraps hid.Device.Write to run in a dedicated OS thread.
func (s singleThreadedDevice) Read(b []byte) (int, error) {
	ch := make(chan funcCallResult[int])
	funcCalls <- func() {
		read, err := s.device.Read(b)
		ch <- funcCallResult[int]{read, err}
	}
	result := <-ch
	return result.value, result.err
}

// Close wraps hid.Device.Write to run in a dedicated OS thread.
func (s singleThreadedDevice) Close() error {
	ch := make(chan error)
	funcCalls <- func() {
		ch <- s.device.Close()
	}
	return <-ch
}

// Open implements DeviceInfo.
func (info hidDeviceInfo) Open() (io.ReadWriteCloser, error) {
	if runtime.GOOS == "darwin" {
		ch := make(chan funcCallResult[hid.Device])
		funcCalls <- func() {
			device, err := info.DeviceInfo.Open()
			ch <- funcCallResult[hid.Device]{device, err}
		}
		result := <-ch
		if result.err != nil {
			return nil, result.err
		}
		return singleThreadedDevice{device: result.value}, nil
	}
	return info.DeviceInfo.Open()
}

// DeviceInfos returns a slice of all recognized devices.
func DeviceInfos() []DeviceInfo {
	deviceInfosFiltered := []DeviceInfo{}

	var result funcCallResult[[]hid.DeviceInfo]
	ch := make(chan funcCallResult[[]hid.DeviceInfo])
	if runtime.GOOS == "darwin" {
		funcCalls <- func() {
			di, err := hid.EnumerateHid(0, 0)
			ch <- funcCallResult[[]hid.DeviceInfo]{di, err}
		}
		result = <-ch
	} else {
		di, err := hid.EnumerateHid(0, 0)
		result = funcCallResult[[]hid.DeviceInfo]{di, err}
	}
	// The library never actually returns an error in this functions.
	if result.err != nil {
		logging.Get().WithError(result.err).Error("EnumerateHid() returned an error")
		return deviceInfosFiltered
	}

	for idx := range result.value {
		di := hidDeviceInfo{result.value[idx]}
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
