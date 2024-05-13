// Copyright 2018 Shift Devices AG
// Copyright 2024 Shift Crypto AG
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
	"bytes"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device/event"
	keystoreInterface "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
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
	// Automatically continue upgrading if the previous upgrade was an intermediate upgrade.

	currentFirmwareVersion, _, err := device.Device.Versions()
	if err != nil {
		return err
	}

	firmwares, ok := bundledFirmwares[device.Device.Product()]
	if !ok {
		return errp.New("unrecognized product")
	}

	// Loop all but the last firmware.
	for i := 0; i < len(firmwares)-1; i++ {
		fwInfo := firmwares[i]
		if fwInfo.monotonicVersion+1 == currentFirmwareVersion {
			device.log.Infof("continuing upgrade on %d", currentFirmwareVersion)
			go func() {
				if err := device.UpgradeFirmware(); err != nil {
					device.log.WithError(err).Error("upgrade continuation failed")
				}
			}()
		}
	}
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
		// Old-school
		f(EventStatusChanged, nil)

		// New-school
		device.Notify(observable.Event{
			Subject: fmt.Sprintf("devices/bitbox02-bootloader/%s/status", device.deviceID),
			Action:  action.Replace,
			Object:  device.Status(),
		})
	}
}

// firmwareBootRequired returns true if the currently flashed firmware has to be booted/run before
// being able to upgrade. This is currently the case for intermediate firmware upgrades, which means
// all bundled firmwares except the latest.
func (device *Device) firmwareBootRequired() (bool, error) {
	currentFirmwareVersion, _, err := device.Device.Versions()
	if err != nil {
		return false, err
	}
	firmwares, ok := bundledFirmwares[device.Device.Product()]
	if !ok {
		return false, errp.New("unrecognized product")
	}

	// Loop all but the last firmware.
	for i := 0; i < len(firmwares)-1; i++ {
		fwInfo := firmwares[i]
		if fwInfo.monotonicVersion == currentFirmwareVersion {
			return true, nil
		}
	}
	return false, nil
}

// nextFirmware returns the info of the next available firmware uprade, e.g. the next intermediate
// upgrade if there is one, or the latest bundled firmware.
func (device *Device) nextFirmware() (*firmwareInfo, error) {
	currentFirmwareVersion, _, err := device.Device.Versions()
	if err != nil {
		return nil, err
	}
	return nextFirmware(device.Device.Product(), currentFirmwareVersion)
}

// UpgradeFirmware uploads the next available firmware release to the device. If the previous
// upgrade was an intermdiate upgrade, booting/running it once is required beforehand, so the device
// is booted in that case.
func (device *Device) UpgradeFirmware() error {
	product := device.Device.Product()

	firmwareBootRequired, err := device.firmwareBootRequired()
	if err != nil {
		return err
	}

	if firmwareBootRequired {
		currentFirmwareVersion, _, err := device.Device.Versions()
		if err != nil {
			device.log.WithError(err).Errorf("firmware boot required before upgrade. product: %s. Could not determine current version", product)
		} else {
			device.log.Infof("firmware boot required before upgrade. product: %s, currentVersion: %d", product, currentFirmwareVersion)
		}
		return device.Reboot()
	}

	nextFirmware, err := device.nextFirmware()
	if err != nil {
		return err
	}
	device.log.Infof("upgrading firmware: %s, %s", product, nextFirmware.version)

	signedBinary, err := nextFirmware.signedBinary()
	if err != nil {
		return err
	}
	return device.Device.UpgradeFirmware(signedBinary)
}

// VersionInfo contains version information about the upgrade.
type VersionInfo struct {
	Erased     bool `json:"erased"`
	CanUpgrade bool `json:"canUpgrade"`
	// AdditionalUpgradeFollows is true if there is more than one upgrade to be performed
	// (intermediate and final).
	AdditionalUpgradeFollows bool `json:"additionalUpgradeFollows"`
}

// VersionInfo returns info about the upgrade to the bundled firmware.
func (device *Device) VersionInfo() (*VersionInfo, error) {
	erased, err := device.Device.Erased()
	if err != nil {
		return nil, err
	}
	currentFirmwareVersion, _, err := device.Device.Versions()
	if err != nil {
		return nil, err
	}
	currentFirmwareHash, _, err := device.Device.GetHashes(false, false)
	if err != nil {
		return nil, err
	}

	latestFw, err := bundledFirmware(device.Device.Product())
	if err != nil {
		return nil, err
	}
	latestFirmwareVersion := latestFw.monotonicVersion
	nextFw, err := nextFirmware(device.Device.Product(), currentFirmwareVersion)
	if err != nil {
		return nil, err
	}

	latestFirmwareHash, err := latestFw.firmwareHash()
	if err != nil {
		return nil, err
	}

	// If the device firmware version is at the latest version but the installed firmware is
	// different, we assume it's a broken/interrupted install. This can happen for example when a
	// new device is shipped with the latest monotonic version pre-set, and the user interrupts
	// their first install.
	brokenInstall := latestFirmwareVersion == currentFirmwareVersion &&
		!bytes.Equal(currentFirmwareHash, latestFirmwareHash)

	canUpgrade := erased || latestFirmwareVersion > currentFirmwareVersion || brokenInstall
	additionalUpgradeFollows := nextFw.monotonicVersion < latestFirmwareVersion
	device.log.
		WithField("latestFirmwareVersion", latestFirmwareVersion).
		WithField("currentFirmwareVersion", currentFirmwareVersion).
		WithField("currentFirmwareHash", hex.EncodeToString(currentFirmwareHash)).
		WithField("erased", erased).
		WithField("brokenInstall", brokenInstall).
		WithField("canUpgrade", canUpgrade).
		WithField("additionalUpgradeFollows", additionalUpgradeFollows).
		Info("VersionInfo")
	return &VersionInfo{
		Erased:                   erased,
		CanUpgrade:               canUpgrade,
		AdditionalUpgradeFollows: additionalUpgradeFollows,
	}, nil
}
