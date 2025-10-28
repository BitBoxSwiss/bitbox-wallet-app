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

//go:embed assets/firmware-bitbox02-btconly.v9.24.0.signed.bin.gz
var firmwareBinaryBTCOnly []byte
var firmwareVersionBTCOnly = semver.NewSemVer(9, 24, 0)
var firmwareMonotonicVersionBtcOnly uint32 = 47

//go:embed assets/firmware-bitbox02-multi.v9.24.0.signed.bin.gz
var firmwareBinaryMulti []byte
var firmwareVersionMulti = semver.NewSemVer(9, 24, 0)
var firmwareMonotonicVersionMulti uint32 = 47

// BitBox02 Nova.

//go:embed assets/firmware-bitbox02nova-btconly.v9.24.0.signed.bin.gz
var firmwareBB02PlusBinaryBTCOnly []byte
var firmwareBB02PlusVersionBTCOnly = semver.NewSemVer(9, 24, 0)
var firmwareBB02PlusMonotonicVersionBtcOnly uint32 = 47

//go:embed assets/firmware-bitbox02nova-multi.v9.24.0.signed.bin.gz
var firmwareBB02PlusBinaryMulti []byte
var firmwareBB02PlusVersionMulti = semver.NewSemVer(9, 24, 0)
var firmwareBB02PlusMonotonicVersionMulti uint32 = 47

type firmwareInfo struct {
	version          *semver.SemVer
	monotonicVersion uint32
	binaryGzip       []byte
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
// The intermediate upgrades, when run, bump the monotonic version by one so we know whether it has
// booted/run at least once.
var bundledFirmwares = map[bitbox02common.Product][]firmwareInfo{
	// BitBox02
	bitbox02common.ProductBitBox02Multi: {
		{
			version:          semver.NewSemVer(9, 17, 1),
			monotonicVersion: 36,
			binaryGzip:       intermediateFirmwareBinaryMulti_9_17_1,
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
			version:          firmwareVersionBTCOnly,
			monotonicVersion: firmwareMonotonicVersionBtcOnly,
			binaryGzip:       firmwareBinaryBTCOnly,
		},
	},
	// BitBox02 Plus.
	bitbox02common.ProductBitBox02PlusMulti: {
		{
			version:          firmwareBB02PlusVersionMulti,
			monotonicVersion: firmwareBB02PlusMonotonicVersionMulti,
			binaryGzip:       firmwareBB02PlusBinaryMulti,
		},
	},
	bitbox02common.ProductBitBox02PlusBTCOnly: {
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
