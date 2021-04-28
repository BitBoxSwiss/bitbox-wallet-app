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
	"io"
	"os"
	"regexp"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	bitbox02common "github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/communication/u2fhid"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/sirupsen/logrus"
)

const (
	bitboxVendorID  = 0x03eb
	bitboxProductID = 0x2402

	bitbox02VendorID  = 0x03eb
	bitbox02ProductID = 0x2403

	bitboxCMD             = 0x80 + 0x40 + 0x01
	bitbox02BootloaderCMD = 0x80 + 0x40 + 0x03
)

// DeviceInfo contains the usb descriptor info and a way to open the device for reading and writing.
type DeviceInfo interface {
	VendorID() int
	ProductID() int
	UsagePage() int
	Interface() int
	Serial() string
	Product() string
	Identifier() string
	Open() (io.ReadWriteCloser, error)
}

func isBitBox(deviceInfo DeviceInfo) bool {
	return deviceInfo.VendorID() == bitboxVendorID && deviceInfo.ProductID() == bitboxProductID && (deviceInfo.UsagePage() == 0xffff || deviceInfo.Interface() == 0)
}

func isBitBox02(deviceInfo DeviceInfo) bool {
	return (deviceInfo.Product() == bitbox02common.FirmwareHIDProductStringStandard ||
		deviceInfo.Product() == bitbox02common.FirmwareHIDProductStringBTCOnly) &&
		deviceInfo.VendorID() == bitbox02VendorID &&
		deviceInfo.ProductID() == bitbox02ProductID &&
		(deviceInfo.UsagePage() == 0xffff || deviceInfo.Interface() == 0)
}

func isBitBox02Bootloader(deviceInfo DeviceInfo) bool {
	return (deviceInfo.Product() == bitbox02common.BootloaderHIDProductStringStandard ||
		deviceInfo.Product() == bitbox02common.BootloaderHIDProductStringBTCOnly) &&
		deviceInfo.VendorID() == bitbox02VendorID &&
		deviceInfo.ProductID() == bitbox02ProductID &&
		(deviceInfo.UsagePage() == 0xffff || deviceInfo.Interface() == 0)
}

// Manager listens for devices and notifies when a device has been inserted or removed.
type Manager struct {
	devices           map[string]device.Interface
	channelConfigDir  string // passed to each bitbox01 device during initialization
	bitbox02ConfigDir string // passed to each bitbox02 device during initialization

	deviceInfos  func() []DeviceInfo
	onRegister   func(device.Interface) error
	onUnregister func(string)

	socksProxy socksproxy.SocksProxy

	log *logrus.Entry
}

// NewManager creates a new Manager. onRegister is called when a device has been
// inserted. onUnregister is called when the device has been removed.
//
// The channelConfigDir argument is passed to each device during initialization,
// before onRegister is called.
func NewManager(
	channelConfigDir string,
	bitbox02ConfigDir string,
	socksProxy socksproxy.SocksProxy,
	deviceInfos func() []DeviceInfo,
	onRegister func(device.Interface) error,
	onUnregister func(string),
) *Manager {
	return &Manager{
		devices:           map[string]device.Interface{},
		channelConfigDir:  channelConfigDir,
		bitbox02ConfigDir: bitbox02ConfigDir,
		deviceInfos:       deviceInfos,
		onRegister:        onRegister,
		onUnregister:      onUnregister,
		socksProxy:        socksProxy,

		log: logging.Get().WithGroup("manager"),
	}
}

func deviceInfoLogFields(deviceInfo DeviceInfo) logrus.Fields {
	return logrus.Fields{
		"identifier": deviceInfo.Identifier(),
		"vendorID":   deviceInfo.VendorID(),
		"productID":  deviceInfo.ProductID(),
		"serial":     deviceInfo.Serial(),
		"product":    deviceInfo.Product(),
		"usagePage":  deviceInfo.UsagePage(),
	}
}

func (manager *Manager) parseVersion(serial string) (*semver.SemVer, error) {
	match := regexp.MustCompile(`v([0-9]+\.[0-9]+\.[0-9]+)`).FindStringSubmatch(serial)
	if len(match) != 2 {
		manager.log.WithField("serial", serial).Error("Serial number is malformed")
		return nil, errp.Newf("Could not find the firmware version in '%s'.", serial)
	}
	version, err := semver.NewSemVerFromString(match[1])
	if err != nil {
		return nil, errp.WithContext(errp.WithMessage(err, "Failed to read version from serial number"),
			errp.Context{"serial": serial})
	}
	return version, err
}

func (manager *Manager) makeBitBox(deviceInfo DeviceInfo) (*bitbox.Device, error) {
	deviceID := deviceInfo.Identifier()
	manager.log.
		WithField("device-id", deviceID).
		WithFields(deviceInfoLogFields(deviceInfo)).
		Info("Registering BitBox")
	bootloader := deviceInfo.Product() == "bootloader" || deviceInfo.Product() == "Digital Bitbox bootloader"
	version, err := manager.parseVersion(deviceInfo.Serial())
	if err != nil {
		return nil, err
	}
	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to open device")
	}
	device, err := bitbox.NewDevice(
		deviceID,
		bootloader,
		version,
		manager.channelConfigDir,
		bitbox.NewCommunication(
			hidDevice,
			version,
			manager.log,
		),
		manager.socksProxy,
	)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to establish communication to device")
	}

	// Unlock the device automatically if the user set the PIN as an environment variable.
	pin := os.Getenv("BITBOX_PIN")
	if pin != "" {
		if _, _, err := device.Login(pin); err != nil {
			return nil, errp.WithMessage(err, "Failed to unlock the BitBox with the provided PIN.")
		}
		manager.log.Info("Successfully unlocked the device with the PIN from the environment.")
	}

	return device, nil
}

func (manager *Manager) makeBitBox02(deviceInfo DeviceInfo) (*bitbox02.Device, error) {
	deviceID := deviceInfo.Identifier()
	manager.log.
		WithField("device-id", deviceID).
		WithFields(deviceInfoLogFields(deviceInfo)).
		Info("Registering BitBox02")
	version, err := manager.parseVersion(deviceInfo.Serial())
	if err != nil {
		return nil, err
	}
	product, err := bitbox02common.ProductFromHIDProductString(deviceInfo.Product())
	if err != nil {
		return nil, err
	}
	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to open device")
	}
	return bitbox02.NewDevice(
		deviceID,
		version,
		product,
		bitbox02.NewConfig(manager.bitbox02ConfigDir),
		u2fhid.NewCommunication(hidDevice, bitboxCMD),
	), nil
}

func (manager *Manager) makeBitBox02Bootloader(deviceInfo DeviceInfo) (
	*bitbox02bootloader.Device, error) {
	deviceID := deviceInfo.Identifier()
	manager.log.
		WithField("device-id", deviceID).
		WithFields(deviceInfoLogFields(deviceInfo)).
		Info("Registering BitBox02 bootloader")
	version, err := manager.parseVersion(deviceInfo.Serial())
	if err != nil {
		return nil, err
	}
	product, err := bitbox02common.ProductFromHIDProductString(deviceInfo.Product())
	if err != nil {
		return nil, err
	}
	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to open device")
	}
	return bitbox02bootloader.NewDevice(
		deviceID,
		version,
		product,
		u2fhid.NewCommunication(hidDevice, bitbox02BootloaderCMD),
	), nil
}

// checkIfRemoved returns true if a device was plugged in, but is not plugged in anymore.
func (manager *Manager) checkIfRemoved(deviceID string) bool {
	// In edge cases, device enumeration hangs waiting for the device, and can be empty for a very
	// short amount of time even though the device is still plugged in. The workaround is to check
	// multiple times.
	for i := 0; i < 5; i++ {
		for _, deviceInfo := range manager.deviceInfos() {
			if deviceInfo.Identifier() == deviceID {
				return false
			}
		}
		time.Sleep(5 * time.Millisecond)
	}
	return true
}

func (manager *Manager) listen() {
	for {
		for deviceID, device := range manager.devices {
			// Check if device was removed.
			if manager.checkIfRemoved(deviceID) {
				device.Close()
				delete(manager.devices, deviceID)
				manager.onUnregister(deviceID)
				manager.log.WithField("device-id", deviceID).Info("Unregistered device")
			}
		}

		// Check if device was inserted.
		deviceInfos := manager.deviceInfos()
		for _, deviceInfo := range deviceInfos {
			deviceID := deviceInfo.Identifier()
			// Skip if already registered.
			if _, ok := manager.devices[deviceID]; ok {
				continue
			}
			// Skip if we already have another device registered and we only support one device.
			if len(manager.devices) != 0 {
				continue
			}
			var device device.Interface
			switch {
			case isBitBox(deviceInfo):
				var err error
				device, err = manager.makeBitBox(deviceInfo)
				if err != nil {
					manager.log.WithError(err).Error("Failed to register bitbox")
					continue
				}
			case isBitBox02(deviceInfo):
				var err error
				device, err = manager.makeBitBox02(deviceInfo)
				if err != nil {
					manager.log.WithError(err).Error("Failed to register bitbox02")
					continue
				}
			case isBitBox02Bootloader(deviceInfo):
				var err error
				device, err = manager.makeBitBox02Bootloader(deviceInfo)
				if err != nil {
					manager.log.WithError(err).Error("Failed to register bitbox02 bootloader")
					continue
				}
			default:
				panic("unrecognized device")
			}
			manager.devices[deviceID] = device
			if err := manager.onRegister(device); err != nil {
				manager.log.WithError(err).Error("Failed to execute on-register")
			}
		}
		time.Sleep(time.Second)
	}
}

// Start listens for inserted/removed devices forever.
func (manager *Manager) Start() {
	go manager.listen()
}
