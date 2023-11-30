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

// Package common contains common functionality to firmware and bootloader of the bitbox02.
package common

import "github.com/digitalbitbox/bitbox02-api-go/util/errp"

// Product enumerates the BitBox-based products. A product is a "platform"-"edition" tuple. Together
// with the firmware version, it determines the device API.
type Product string

const (
	// ProductBitBox02Multi is the multi (previously: standard) edition of the BitBox02.
	ProductBitBox02Multi Product = "bitbox02-multi"
	// ProductBitBox02BTCOnly is the btc-only edition of the BitBox02, restricting functionality to
	// Bitcoin.
	ProductBitBox02BTCOnly Product = "bitbox02-btconly"
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

// ProductFromHIDProductString returns the firmware or bootloader product based on the usb HID
// product string. Returns an error for an invalid/unrecognized product string.
func ProductFromHIDProductString(productString string) (Product, error) {
	switch productString {
	case FirmwareHIDProductStringStandard, BootloaderHIDProductStringStandard:
		return ProductBitBox02Multi, nil
	case FirmwareHIDProductStringBTCOnly, BootloaderHIDProductStringBTCOnly:
		return ProductBitBox02BTCOnly, nil
	default:
		return "", errp.New("unrecognized product")
	}
}
