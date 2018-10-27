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
	"os"
	"regexp"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/karalabe/hid"
	"github.com/sirupsen/logrus"
)

const (
	bitboxVendorID  = 0x03eb
	bitboxProductID = 0x2402
)

func isBitBox(deviceInfo hid.DeviceInfo) bool {
	return deviceInfo.VendorID == bitboxVendorID && deviceInfo.ProductID == bitboxProductID && (deviceInfo.UsagePage == 0xffff || deviceInfo.Interface == 0)
}

// DeviceInfos returns a slice of all found bitbox devices.
func DeviceInfos() []hid.DeviceInfo {
	deviceInfos := []hid.DeviceInfo{}
	for _, deviceInfo := range hid.Enumerate(0, 0) {
		// If Enumerate() is called too quickly after a device is inserted, the HID device input
		// report is not yet ready.
		if deviceInfo.Serial == "" || deviceInfo.Product == "" {
			continue
		}
		if isBitBox(deviceInfo) {
			deviceInfos = append(deviceInfos, deviceInfo)
		}
	}
	return deviceInfos
}

// Manager listens for devices and notifies when a device has been inserted or removed.
type Manager struct {
	devices          map[string]device.Interface
	channelConfigDir string // passed to each device during initialization

	onRegister   func(device.Interface) error
	onUnregister func(string)

	log *logrus.Entry
}

// NewManager creates a new Manager. onRegister is called when a device has been
// inserted. onUnregister is called when the device has been removed.
//
// The channelConfigDir argument is passed to each device during initialization,
// before onRegister is called.
func NewManager(
	channelConfigDir string,
	onRegister func(device.Interface) error,
	onUnregister func(string),
) *Manager {
	return &Manager{
		devices:          map[string]device.Interface{},
		channelConfigDir: channelConfigDir,
		onRegister:       onRegister,
		onUnregister:     onUnregister,

		log: logging.Get().WithGroup("manager"),
	}
}

func deviceIdentifier(deviceInfo hid.DeviceInfo) string {
	return hex.EncodeToString([]byte(deviceInfo.Path))
}

func (manager *Manager) makeBitBox(deviceInfo hid.DeviceInfo) (*bitbox.Device, error) {
	deviceID := deviceIdentifier(deviceInfo)
	manager.log.WithField("device-id", deviceID).Info("Registering BitBox")
	bootloader := deviceInfo.Product == "bootloader" || deviceInfo.Product == "Digital Bitbox bootloader"
	match := regexp.MustCompile(`v([0-9]+\.[0-9]+\.[0-9]+)`).FindStringSubmatch(deviceInfo.Serial)
	if len(match) != 2 {
		manager.log.WithField("serial", deviceInfo.Serial).Error("Serial number is malformed")
		return nil, errp.Newf("Could not find the firmware version in '%s'.", deviceInfo.Serial)
	}
	firmwareVersion, err := semver.NewSemVerFromString(match[1])
	if err != nil {
		return nil, errp.WithContext(errp.WithMessage(err, "Failed to read version from serial number"),
			errp.Context{"serial": deviceInfo.Serial})
	}

	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to open device")
	}

	usbWriteReportSize := 64
	usbReadReportSize := 64
	if bootloader && !firmwareVersion.AtLeast(semver.NewSemVer(3, 0, 0)) {
		// Bootloader 3.0.0 changed to composite USB. Since then, the report lengths are 65/65,
		// not 4099/256 (including report ID).  See dev->output_report_length at
		// https://github.com/signal11/hidapi/blob/a6a622ffb680c55da0de787ff93b80280498330f/windows/hid.c#L626
		usbWriteReportSize = 4098
		usbReadReportSize = 256
	}
	manager.log.Infof("usbWriteReportSize=%d, usbReadReportSize=%d", usbWriteReportSize, usbReadReportSize)
	device, err := bitbox.NewDevice(
		deviceID,
		bootloader,
		firmwareVersion,
		manager.channelConfigDir,
		NewCommunication(hidDevice, usbWriteReportSize, usbReadReportSize),
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

// checkIfRemoved returns true if a device was plugged in, but is not plugged in anymore.
func (manager *Manager) checkIfRemoved(deviceID string) bool {
	// In edge cases, device enumeration hangs waiting for the device, and can be empty for a very
	// short amount of time even though the device is still plugged in. The workaround is to check
	// multiple times.
	for i := 0; i < 5; i++ {
		for _, deviceInfo := range DeviceInfos() {
			if deviceIdentifier(deviceInfo) == deviceID {
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
		deviceInfos := DeviceInfos()
		for _, deviceInfo := range deviceInfos {
			deviceID := deviceIdentifier(deviceInfo)
			// Skip if already registered.
			if _, ok := manager.devices[deviceID]; ok {
				continue
			}
			var device device.Interface
			if isBitBox(deviceInfo) {
				var err error
				device, err = manager.makeBitBox(deviceInfo)
				if err != nil {
					manager.log.WithError(err).Error("Failed to register bitbox")
					continue
				}
			} else {
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

// Start listens for inserted/removed devices forever. Run this in a goroutine.
func (manager *Manager) Start() {
	go manager.listen()
}
