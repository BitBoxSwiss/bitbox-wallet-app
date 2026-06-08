// SPDX-License-Identifier: Apache-2.0

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
	// edition firmware. It appears in the HID descriptor.
	FirmwareDeviceProductStringBitBox02PlusMulti = "BitBox02 Nova Multi"
	// FirmwareDeviceProductStringBitBox02PlusBTCOnly is the product string of the "BitBox02 Plus"
	// btc-only edition firmware. It appears in the HID descriptor.
	FirmwareDeviceProductStringBitBox02PlusBTCOnly = "BitBox02 Nova BTC-only"

	// BootloaderDeviceProductStringBitBox02PlusMulti is the product string of the "BitBox02 Plus" multi
	// edition bootloader. It appears in the HID descriptor.
	BootloaderDeviceProductStringBitBox02PlusMulti = "BitBox02 Nova Multi bl"
	// BootloaderDeviceProductStringBitBox02PlusBTCOnly is the product string of the "BitBox02 Plus"
	// btc-only edition bootloader. It appears in the HID descriptor and the Bluetooth
	// characteristic.
	BootloaderDeviceProductStringBitBox02PlusBTCOnly = "BitBox02 Nova BTC-only bl"
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
