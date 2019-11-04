// Copyright 2018-2019 Shift Cryptosecurity AG
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

// Package common contains common functionality to bitbox02 firmware and bitbox02 bootloader.
package common

import "github.com/digitalbitbox/bitbox02-api-go/util/errp"

// Edition enumerates the device editions, which (together with the firmware version) determines the
// device API.
type Edition string

const (
	// EditionStandard is the standard/full edition.
	EditionStandard Edition = "standard"
	// EditionBTCOnly is the btc-only edition, restricting functionality to Bitcoin.
	EditionBTCOnly Edition = "btconly"
)

const (
	// FirmwareHIDProductStringStandard is the hid product string of the standard edition firmware.
	FirmwareHIDProductStringStandard = "BitBox02"
	// FirmwareHIDProductStringBTCOnly is the hid product string of the btc-only edition firmware.
	FirmwareHIDProductStringBTCOnly = "BitBox02BTC"

	// BootloaderHIDProductStringStandard is the hid product string of the standard edition bootloader.
	BootloaderHIDProductStringStandard = "bb02-bootloader"
	// BootloaderHIDProductStringBTCOnly is the hid product string of the btc-only edition bootloader.
	BootloaderHIDProductStringBTCOnly = "bb02btc-bootloader"
)

// EditionFromHIDProductString returns the firmware or bootloader edition based on the usb HID
// product string. Returns an error for an invalid/unrecognized product string.
func EditionFromHIDProductString(productString string) (Edition, error) {
	switch productString {
	case FirmwareHIDProductStringStandard, BootloaderHIDProductStringStandard:
		return EditionStandard, nil
	case FirmwareHIDProductStringBTCOnly, BootloaderHIDProductStringBTCOnly:
		return EditionBTCOnly, nil
	default:
		return "", errp.New("unrecognized edition")
	}
}
