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

// Package bitbox02bootloader contains the API to the physical device.
package bitbox02bootloader

import (
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device/event"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/sirupsen/logrus"
)

// ProductName is the name of the BitBox02 bootloader product.
const ProductName = "bitbox02-bootloader"

// Device provides the API to communicate with the BitBox02 bootloader.
type Device struct {
	bootloader.Device
	deviceID string

	mu      sync.RWMutex
	onEvent func(event.Event, interface{})

	log *logrus.Entry

	observable.Implementation
}

// EventStatusChanged is fired when the status changes. Check the status using Status().
const EventStatusChanged event.Event = "statusChanged"

// NewDevice creates a new instance of Device.
func NewDevice(
	deviceID string,
	version *semver.SemVer,
	product bitbox02common.Product,
	communication bootloader.Communication,
) *Device {
	log := logging.Get().
		WithGroup("device").
		WithField("deviceID", deviceID).
		WithField("productName", ProductName).
		WithField("product", product)
	log.Info("Plugged in device")
	device := &Device{
		deviceID: deviceID,
		log:      log,
	}
	device.Device = *bootloader.NewDevice(
		version,
		product,
		communication,
		func(*bootloader.Status) {
			device.fireEvent()
		},
	)

	firmwareHash, signingKeysHash, err := device.Device.GetHashes(false, false)
	if err != nil {
		log.WithError(err).Error("Could not get hashes from bootloader")
	} else {
		log.Infof("firmwareHash=%x, signingKeysHash=%x", firmwareHash, signingKeysHash)
	}
	return device
}

// Init implements device.Device.
func (device *Device) Init(testing bool) error {
	return nil
}

// ProductName implements device.Device.
func (device *Device) ProductName() string {
	return ProductName
}

// Identifier implements device.Device.
func (device *Device) Identifier() string {
	return device.deviceID
}

// Keystore implements device.Device.
func (device *Device) Keystore() keystoreInterface.Keystore {
	panic("not supported")
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(event.Event, interface{})) {
	device.mu.Lock()
	defer device.mu.Unlock()
	device.onEvent = onEvent
}

func (device *Device) fireEvent() {
	device.mu.RLock()
	f := device.onEvent
	device.mu.RUnlock()
	if f != nil {
		f(EventStatusChanged, nil)
	}
}

// UpgradeFirmware uploads a signed bitbox02 firmware release to the device.
func (device *Device) UpgradeFirmware() error {
	product := device.Device.Product()
	device.log.Infof("upgrading firmware: %s, %s", product, BundledFirmwareVersion(product))
	return device.Device.UpgradeFirmware(bundledFirmware(product))
}
