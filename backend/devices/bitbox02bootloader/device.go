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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader/api"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02common"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device/event"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

// ProductName is the name of the BitBox02 bootloader product.
const ProductName = "bitbox02-bootloader"

// Device provides the API to communicate with the BitBox02 bootloader.
type Device struct {
	api.Device
	deviceID string
	log      *logrus.Entry
}

// NewDevice creates a new instance of Device.
func NewDevice(
	deviceID string,
	version *semver.SemVer,
	edition bitbox02common.Edition,
	communication api.Communication,
) *Device {
	log := logging.Get().
		WithGroup("device").
		WithField("deviceID", deviceID).
		WithField("productName", ProductName)
	log.Info("Plugged in device")
	device := &Device{
		Device:   *api.NewDevice(version, edition, communication),
		deviceID: deviceID,
		log:      log,
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

// KeystoreForConfiguration implements device.Device.
func (device *Device) KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystoreInterface.Keystore {
	panic("not supported")
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(event.Event, interface{})) {
	device.Device.SetOnEvent(func(ev event.Event, meta interface{}) {
		onEvent(event.Event(ev), meta)
	})
}

// UpgradeFirmware uploads a signed bitbox02 firmware release to the device.
func (device *Device) UpgradeFirmware() error {
	device.log.Info("upgrading firmware")
	return device.Device.UpgradeFirmware()
}
