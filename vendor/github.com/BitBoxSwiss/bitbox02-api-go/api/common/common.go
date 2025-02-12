// Copyright 2018-2019 Shift Cryptosecurity AG
// Copyright 2025 Shift Crypto AG
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

import "github.com/BitBoxSwiss/bitbox02-api-go/util/errp"

// Product enumerates the BitBox-based products. A product is a "platform"-"edition" tuple. Together
// with the firmware version, it determines the device API.
type Product string

const (
	// ProductBitBox02Multi is the multi (previously: standard) edition of the BitBox02.
	ProductBitBox02Multi Product = "bitbox02-multi"
	// ProductBitBox02BTCOnly is the btc-only edition of the BitBox02, restricting functionality to
	// Bitcoin.
	ProductBitBox02BTCOnly Product = "bitbox02-btconly"

	// ProductBitBox02PlusMulti is the multi edition of the BitBox02 Plus.
	ProductBitBox02PlusMulti Product = "bitbox02-plus-multi"
	// ProductBitBox02PlusBTCOnly is the btc-only edition of the BitBox02 Plus, restricting
	// functionality to Bitcoin.
	ProductBitBox02PlusBTCOnly Product = "bitbox02-plus-btconly"
)

const (
	// FirmwareDeviceProductStringBitBox02Multi is the product string of the BitBox02 multi edition
	// firmware. It appears in the HID descriptor.
	FirmwareDeviceProductStringBitBox02Multi = "BitBox02"
	// FirmwareDeviceProductStringBitBox02BTCOnly is the product string of the BitBox02 btc-only
	// edition firmware. It appears in the HID descriptor.
	FirmwareDeviceProductStringBitBox02BTCOnly = "BitBox02BTC"

	// BootloaderDeviceProductStringBitBox02Multi is the product string of the BitBox02 multi
	// edition bootloader. It appears in the HID descriptor.
	BootloaderDeviceProductStringBitBox02Multi = "bb02-bootloader"
	// BootloaderDeviceProductStringBitBox02BTCOnly is the product string of the BitBox02 btc-only
	// edition bootloader. It appears in the HID descriptor.
	BootloaderDeviceProductStringBitBox02BTCOnly = "bb02btc-bootloader"

	// FirmwareDeviceProductStringBitBox02PlusMulti the product string of the "BitBox02 Plus" multi
	// edition firmware. It appears in the HID descriptor and the Bluetooth characteristic.
	FirmwareDeviceProductStringBitBox02PlusMulti = "bb02p-multi"
	// FirmwareDeviceProductStringBitBox02PlusBTCOnly is the product string of the "BitBox02 Plus"
	// btc-only edition firmware. It appears in the HID descriptor and the Bluetooth characteristic.
	FirmwareDeviceProductStringBitBox02PlusBTCOnly = "bb02p-btconly"

	// BootloaderDeviceProductStringBitBox02Multi is the product string of the "BitBox02 Plus" multi
	// edition bootloader. It appears in the HID descriptor and the Bluetooth characteristic.
	BootloaderDeviceProductStringBitBox02PlusMulti = "bb02p-bl-multi"
	// BootloaderDeviceProductStringBitBox02BTCOnly is the product string of the "BitBox02 Plus"
	// btc-only edition bootloader. It appears in the HID descriptor and the Bluetooth
	// characteristic.
	BootloaderDeviceProductStringBitBox02PlusBTCOnly = "bb02p-bl-btconly"
)

// ProductFromDeviceProductString returns the firmware or bootloader product based on the usb Device
// product string. Returns an error for an invalid/unrecognized product string.
func ProductFromDeviceProductString(productString string) (Product, error) {
	switch productString {
	case FirmwareDeviceProductStringBitBox02Multi, BootloaderDeviceProductStringBitBox02Multi:
		return ProductBitBox02Multi, nil
	case FirmwareDeviceProductStringBitBox02BTCOnly, BootloaderDeviceProductStringBitBox02BTCOnly:
		return ProductBitBox02BTCOnly, nil
	case FirmwareDeviceProductStringBitBox02PlusMulti, BootloaderDeviceProductStringBitBox02PlusMulti:
		return ProductBitBox02PlusMulti, nil
	case FirmwareDeviceProductStringBitBox02PlusBTCOnly, BootloaderDeviceProductStringBitBox02PlusBTCOnly:
		return ProductBitBox02PlusBTCOnly, nil
	default:
		return "", errp.New("unrecognized product")
	}
}
