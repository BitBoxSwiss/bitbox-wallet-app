// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"bytes"
	"compress/gzip"
	_ "embed" // Needed for the go:embed directives below.
	"io"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

//go:embed assets/firmware-btc.v9.17.1.signed.bin.gz
var intermediateFirmwareBinaryBTCOnly_9_17_1 []byte

//go:embed assets/firmware.v9.17.1.signed.bin.gz
var intermediateFirmwareBinaryMulti_9_17_1 []byte

// BitBox02

//go:embed assets/firmware-bitbox02-btconly.v9.26.2.signed.bin.gz
var intermediateFirmwareBinaryBTCOnly_9_26_2 []byte

//go:embed assets/firmware-bitbox02-multi.v9.26.2.signed.bin.gz
var intermediateFirmwareBinaryMulti_9_26_2 []byte

//go:embed assets/firmware-bitbox02-btconly.v9.26.3.signed.bin.gz
var firmwareBinaryBTCOnly []byte
var firmwareVersionBTCOnly = semver.NewSemVer(9, 26, 3)
var firmwareMonotonicVersionBtcOnly uint32 = 51

//go:embed assets/firmware-bitbox02-multi.v9.26.4.signed.bin.gz
var firmwareBinaryMulti []byte
var firmwareVersionMulti = semver.NewSemVer(9, 26, 4)
var firmwareMonotonicVersionMulti uint32 = 52

// BitBox02 Nova.

//go:embed assets/firmware-bitbox02nova-btconly.v9.26.2.signed.bin.gz
var intermediateFirmwareBB02PlusBinaryBTCOnly_9_26_2 []byte

//go:embed assets/firmware-bitbox02nova-multi.v9.26.2.signed.bin.gz
var intermediateFirmwareBB02PlusBinaryMulti_9_26_2 []byte

//go:embed assets/firmware-bitbox02nova-btconly.v9.26.3.signed.bin.gz
var firmwareBB02PlusBinaryBTCOnly []byte
var firmwareBB02PlusVersionBTCOnly = semver.NewSemVer(9, 26, 3)
var firmwareBB02PlusMonotonicVersionBtcOnly uint32 = 51

//go:embed assets/firmware-bitbox02nova-multi.v9.26.4.signed.bin.gz
var firmwareBB02PlusBinaryMulti []byte
var firmwareBB02PlusVersionMulti = semver.NewSemVer(9, 26, 4)
var firmwareBB02PlusMonotonicVersionMulti uint32 = 52

type firmwareInfo struct {
	version                     *semver.SemVer
	monotonicVersion            uint32
	completionBootloaderVersion *semver.SemVer
	binaryGzip                  []byte
}

func (fi firmwareInfo) signedBinary() ([]byte, error) {
	gz, err := gzip.NewReader(bytes.NewBuffer(fi.binaryGzip))
	if err != nil {
		return nil, err
	}
	return io.ReadAll(gz)
}

func (fi firmwareInfo) firmwareHash() ([]byte, error) {
	signedBinary, err := fi.signedBinary()
	if err != nil {
		return nil, err
	}

	_, _, binary, err := bootloader.ParseSignedFirmware(signedBinary)
	if err != nil {
		return nil, err
	}
	return bootloader.HashFirmware(fi.monotonicVersion, binary), nil
}

// The last entry in the slice is the latest firmware update to which one can upgrade.
// The other entries are intermediate upgrades that are required before upgrading to the latest one.
// Each one has to be flashed and booted before being able to continue upgrading.
// By default, an intermediate upgrade signals that it booted by bumping the monotonic firmware
// version by one. Bootloader-upgrade intermediates can instead set completionBootloaderVersion to
// signal completion through the bootloader version.
var bundledFirmwares = map[bitbox02common.Product][]firmwareInfo{
	// BitBox02
	bitbox02common.ProductBitBox02Multi: {
		{
			version:          semver.NewSemVer(9, 17, 1),
			monotonicVersion: 36,
			binaryGzip:       intermediateFirmwareBinaryMulti_9_17_1,
		},
		{
			version:                     semver.NewSemVer(9, 26, 2),
			monotonicVersion:            50,
			completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
			binaryGzip:                  intermediateFirmwareBinaryMulti_9_26_2,
		},
		{
			version:          firmwareVersionMulti,
			monotonicVersion: firmwareMonotonicVersionMulti,
			binaryGzip:       firmwareBinaryMulti,
		},
	},
	bitbox02common.ProductBitBox02BTCOnly: {
		{
			version:          semver.NewSemVer(9, 17, 1),
			monotonicVersion: 36,
			binaryGzip:       intermediateFirmwareBinaryBTCOnly_9_17_1,
		},
		{
			version:                     semver.NewSemVer(9, 26, 2),
			monotonicVersion:            50,
			completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
			binaryGzip:                  intermediateFirmwareBinaryBTCOnly_9_26_2,
		},
		{
			version:          firmwareVersionBTCOnly,
			monotonicVersion: firmwareMonotonicVersionBtcOnly,
			binaryGzip:       firmwareBinaryBTCOnly,
		},
	},
	// BitBox02 Plus.
	bitbox02common.ProductBitBox02PlusMulti: {
		{
			version:                     semver.NewSemVer(9, 26, 2),
			monotonicVersion:            50,
			completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
			binaryGzip:                  intermediateFirmwareBB02PlusBinaryMulti_9_26_2,
		},
		{
			version:          firmwareBB02PlusVersionMulti,
			monotonicVersion: firmwareBB02PlusMonotonicVersionMulti,
			binaryGzip:       firmwareBB02PlusBinaryMulti,
		},
	},
	bitbox02common.ProductBitBox02PlusBTCOnly: {
		{
			version:                     semver.NewSemVer(9, 26, 2),
			monotonicVersion:            50,
			completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
			binaryGzip:                  intermediateFirmwareBB02PlusBinaryBTCOnly_9_26_2,
		},
		{
			version:          firmwareBB02PlusVersionBTCOnly,
			monotonicVersion: firmwareBB02PlusMonotonicVersionBtcOnly,
			binaryGzip:       firmwareBB02PlusBinaryBTCOnly,
		},
	},
}

// BundledFirmwareVersion returns the version of newest bundled firmware. Returns nil if none is
// available.
func BundledFirmwareVersion(product bitbox02common.Product) *semver.SemVer {
	firmwares, ok := bundledFirmwares[product]
	if !ok {
		return nil
	}

	return firmwares[len(firmwares)-1].version
}

// bundledFirmware returns the binary of the newest bundled firmware.
func bundledFirmware(product bitbox02common.Product) (*firmwareInfo, error) {
	firmwares, ok := bundledFirmwares[product]
	if !ok {
		return nil, errp.New("unrecognized product")
	}
	return &firmwares[len(firmwares)-1], nil
}

// nextFirmware returns the info of the next available firmware uprade, e.g. the next intermediate
// upgrade if there is one, or the latest bundled firmware.
func nextFirmware(product bitbox02common.Product, currentFirmwareVersion uint32) (*firmwareInfo, error) {
	firmwares, ok := bundledFirmwares[product]
	if !ok {
		return nil, errp.New("unrecognized product")
	}

	for _, fwInfo := range firmwares {
		if fwInfo.monotonicVersion > currentFirmwareVersion {
			return &fwInfo, nil
		}
	}
	return &firmwares[len(firmwares)-1], nil
}

// continuesUpgrade reports whether this intermediate upgrade completed and the
// upgrade flow should continue with the next bundled firmware.
//
// Legacy intermediates signal completion by incrementing the monotonic firmware
// version. Bootloader intermediates keep the same firmware version and signal
// completion through the bootloader version.
func (fi firmwareInfo) continuesUpgrade(
	currentFirmwareVersion uint32,
	bootloaderVersion *semver.SemVer,
) bool {
	if fi.completionBootloaderVersion != nil {
		return currentFirmwareVersion == fi.monotonicVersion &&
			bootloaderVersion.AtLeast(fi.completionBootloaderVersion)
	}
	return currentFirmwareVersion == fi.monotonicVersion+1
}

// bootRequired reports whether this intermediate firmware is installed but has
// not completed yet, so the device must boot once before upgrading further.
//
// Legacy intermediates require a boot while currentFirmwareVersion still equals
// fi.monotonicVersion, as legacy intermediates increment the montonic counter. Bootloader
// intermediates require a boot until the bootloader version reaches completionBootloaderVersion.
func (fi firmwareInfo) bootRequired(
	currentFirmwareVersion uint32,
	bootloaderVersion *semver.SemVer,
) bool {
	if currentFirmwareVersion != fi.monotonicVersion {
		return false
	}
	if fi.completionBootloaderVersion != nil {
		return !bootloaderVersion.AtLeast(fi.completionBootloaderVersion)
	}
	return true
}
