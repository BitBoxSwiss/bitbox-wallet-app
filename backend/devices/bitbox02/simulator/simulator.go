// Copyright 2025 Shift Devices AG
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

package simulator

import (
	"fmt"
	"io"
	"net"
	"os/exec"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	bitbox02firmware "github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/communication/u2fhid"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

var testDeviceInfo *deviceInfo

// Init processes the simulator flags, and starts a goroutine to monitor the simulator process
// and update the testDeviceInfo accordingly.
func Init(simulatorPort int) {
	go func() {
		log := logging.Get().WithGroup("simulator")
		for {
			if !isRunning(simulatorPort) {
				// Simulator not running. Unset test device info.
				testDeviceInfo = nil
				continue
			}
			// If the testdevice info is already set, do nothing.
			if testDeviceInfo != nil {
				continue
			}

			var err error
			// Otherwise, set the test device info.
			testDeviceInfo, err = newDeviceInfo(simulatorPort)
			if err != nil {
				log.WithError(err).Error("Failed to get simulator device info")
				testDeviceInfo = nil
			}
			time.Sleep(50 * time.Millisecond)
		}
	}()
}

// isRunning checks if a process is listening at the provided port.
func isRunning(port int) bool {
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN")
	if err := cmd.Run(); err != nil {
		return false // No process listening on the port
	}
	return true
}

// TestDeviceInfo returns the deviceInfo of the running simulator, or nil if no simulator is running.
func TestDeviceInfo() *deviceInfo {
	return testDeviceInfo
}

// deviceInfo implements usb.deviceInfo for the simulator.
type deviceInfo struct {
	port    int
	version semver.SemVer
	product bitbox02common.Product
}

func newDeviceInfo(simulatorPort int) (*deviceInfo, error) {
	info := deviceInfo{
		port: simulatorPort,
	}
	hidDevice, err := info.Open()
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := hidDevice.Close(); err != nil {
			logging.Get().WithError(err).Error("Failed to close hidDevice")
		}
	}()

	bitboxCMD := 0x80 + 0x40 + 0x01
	version, product, _, err := bitbox02firmware.Info(u2fhid.NewCommunication(hidDevice, byte(bitboxCMD)))
	if err != nil {
		return nil, err
	}
	info.version = *version
	info.product = product
	return &info, nil
}

// IsBluetooth implements usb.DeviceInfo.
func (d deviceInfo) IsBluetooth() bool {
	return false
}

// VendorID implements usb.DeviceInfo.
func (d deviceInfo) VendorID() int {
	return 0x03eb
}

// ProductID implements usb.DeviceInfo.
func (d deviceInfo) ProductID() int {
	return 0x2403
}

// UsagePage implements usb.DeviceInfo.
func (d deviceInfo) UsagePage() int {
	return 0xfffff
}

// Interface implements usb.DeviceInfo.
func (d deviceInfo) Interface() int {
	return 0
}

// Serial implements usb.DeviceInfo.
func (d deviceInfo) Serial() string {
	return fmt.Sprintf("v%s", d.version.String())
}

// Product implements usb.DeviceInfo.
func (d deviceInfo) Product() string {
	switch d.product {
	case bitbox02common.ProductBitBox02Multi:
		return bitbox02common.FirmwareDeviceProductStringBitBox02Multi
	case bitbox02common.ProductBitBox02BTCOnly:
		return bitbox02common.FirmwareDeviceProductStringBitBox02BTCOnly
	case bitbox02common.ProductBitBox02PlusMulti:
		return bitbox02common.FirmwareDeviceProductStringBitBox02PlusMulti
	case bitbox02common.ProductBitBox02PlusBTCOnly:
		return bitbox02common.FirmwareDeviceProductStringBitBox02PlusBTCOnly
	default:
		panic("unrecognized product")
	}
}

// Identifier implements usb.DeviceInfo.
func (d deviceInfo) Identifier() string {
	return "bitbox02-simulator"
}

// Open implements usb.DeviceInfo.
func (d deviceInfo) Open() (io.ReadWriteCloser, error) {
	var err error
	var conn net.Conn
	for range 200 {
		conn, err = net.Dial("tcp", fmt.Sprintf("localhost:%d", d.port))
		if err == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		return nil, err
	}
	return conn, nil
}
