// SPDX-License-Identifier: Apache-2.0

// Package bitbox02bootloader contains the API to the physical device.
package bitbox02bootloader

import (
	"bytes"
	"encoding/hex"
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
	deviceID          string
	bootloaderVersion *semver.SemVer

	operationLock                     sync.RWMutex
	operationErased                   bool
	operationAdditionalUpgradeFollows bool

	log *logrus.Entry

	observable.Implementation
}

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
		deviceID:          deviceID,
		bootloaderVersion: version,
		log:               log,
	}
	device.Device = *bootloader.NewDevice(
		version,
		product,
		communication,
		func(_ *bootloader.Status) {
			device.Notify(observable.Event{
				Subject: "status",
				Action:  action.Replace,
				Object:  device.Status(),
			})
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
		if fwInfo.continuesUpgrade(currentFirmwareVersion, device.bootloaderVersion) {
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

// PlatformName implements device.Device.
func (device *Device) PlatformName() string {
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
}

// Status contains the bootloader status plus app-level context about the current operation.
type Status struct {
	*bootloader.Status
	Product bitbox02common.Product `json:"product"`
	Erased  bool                   `json:"erased"`
	// AdditionalUpgradeFollows is true if there is more than one upgrade to be performed
	// (intermediate and final).
	AdditionalUpgradeFollows bool `json:"additionalUpgradeFollows"`
}

// Status returns the progress of a firmware upgrade.
func (device *Device) Status() *Status {
	device.operationLock.RLock()
	erased := device.operationErased
	additionalUpgradeFollows := device.operationAdditionalUpgradeFollows
	device.operationLock.RUnlock()
	return &Status{
		Status:                   device.Device.Status(),
		Product:                  device.Device.Product(),
		Erased:                   erased,
		AdditionalUpgradeFollows: additionalUpgradeFollows,
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
		if fwInfo.bootRequired(currentFirmwareVersion, device.bootloaderVersion) {
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

	erased, err := device.Device.Erased()
	if err != nil {
		return err
	}

	nextFirmware, err := device.nextFirmware()
	if err != nil {
		return err
	}
	latestFirmware, err := bundledFirmware(product)
	if err != nil {
		return err
	}
	device.operationLock.Lock()
	device.operationErased = erased
	device.operationAdditionalUpgradeFollows = nextFirmware.monotonicVersion < latestFirmware.monotonicVersion
	device.operationLock.Unlock()

	device.log.Infof("upgrading firmware: %s, %s", product, nextFirmware.version)

	signedBinary, err := nextFirmware.signedBinary()
	if err != nil {
		return err
	}
	if err := device.Device.UpgradeFirmware(signedBinary); err != nil {
		return err
	}
	return nil
}

// Info contains version information about device and the firmware upgrade.
type Info struct {
	Erased     bool `json:"erased"`
	CanUpgrade bool `json:"canUpgrade"`
}

// Info returns info about the device and the firmware upgrade to the bundled firmware.
func (device *Device) Info() (*Info, error) {
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
	device.log.
		WithField("latestFirmwareVersion", latestFirmwareVersion).
		WithField("currentFirmwareVersion", currentFirmwareVersion).
		WithField("currentFirmwareHash", hex.EncodeToString(currentFirmwareHash)).
		WithField("erased", erased).
		WithField("brokenInstall", brokenInstall).
		WithField("canUpgrade", canUpgrade).
		Info("Info")
	return &Info{
		Erased:     erased,
		CanUpgrade: canUpgrade,
	}, nil
}
