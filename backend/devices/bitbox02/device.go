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

// Package bitbox02 implements the Device and Keystore interfaces to integrate the bitbox02 into the
// app.
package bitbox02

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/api"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02common"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

// ProductName is the name of the BitBox02 product.
// If you change this, be sure to check the frontend and other places which assume this is a
// constant.
const ProductName = "bitbox02"

// Device implements device.Device.
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
	config api.ConfigInterface,
	communication api.Communication,
) *Device {
	log := logging.Get().
		WithGroup("device").
		WithField("deviceID", deviceID).
		WithField("productName", ProductName)

	log.Info("Plugged in device")
	return &Device{
		Device:   *api.NewDevice(version, edition, config, communication, logger{log}),
		deviceID: deviceID,
		log:      log,
	}
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
	if device.Status() != api.StatusInitialized {
		return nil
	}
	return &keystore{
		device:        device,
		configuration: configuration,
		cosignerIndex: cosignerIndex,
		log:           device.log,
	}
}
