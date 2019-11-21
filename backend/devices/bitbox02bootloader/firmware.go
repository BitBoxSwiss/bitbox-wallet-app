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
	"fmt"

	bitbox02common "github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
)

//go:generate go-bindata -pkg $GOPACKAGE -o assets.go assets

type firmwareInfo struct {
	version  *semver.SemVer
	filename string
}

var bundledFirmwares = map[bitbox02common.Product]firmwareInfo{
	bitbox02common.ProductBitBox02Multi: {
		version:  semver.NewSemVer(4, 2, 1),
		filename: "assets/firmware.v%s.signed.bin",
	},
	bitbox02common.ProductBitBox02BTCOnly: {
		version:  semver.NewSemVer(4, 2, 2),
		filename: "assets/firmware-btc.v%s.signed.bin",
	},
}

// BundledFirmwareVersion returns the version of the bundled firmware.
func BundledFirmwareVersion(product bitbox02common.Product) *semver.SemVer {
	info, ok := bundledFirmwares[product]
	if !ok {
		panic("unrecognized product")
	}
	return info.version
}

// bundledFirmware returns the binary of the bundled firmware.
func bundledFirmware(product bitbox02common.Product) []byte {
	info, ok := bundledFirmwares[product]
	if !ok {
		panic("unrecognized product")
	}
	binary, err := Asset(fmt.Sprintf(info.filename, BundledFirmwareVersion(product).String()))
	if err != nil {
		panic(err)
	}
	return binary
}
