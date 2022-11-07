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
	"io/ioutil"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	bitbox02common "github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
)

//go:embed assets/firmware-btc.v9.13.0.signed.bin.gz
var firmwareBinaryBTCOnly []byte
var firmwareVersionBTCOnly = semver.NewSemVer(9, 13, 0)

//go:embed assets/firmware.v9.13.0.signed.bin.gz
var firmwareBinaryMulti []byte
var firmwareVersionMulti = semver.NewSemVer(9, 13, 0)

type firmwareInfo struct {
	version *semver.SemVer
	binary  []byte
}

var bundledFirmwares = map[bitbox02common.Product]firmwareInfo{
	bitbox02common.ProductBitBox02Multi: {
		version: firmwareVersionMulti,
		binary:  firmwareBinaryMulti,
	},
	bitbox02common.ProductBitBox02BTCOnly: {
		version: firmwareVersionBTCOnly,
		binary:  firmwareBinaryBTCOnly,
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
func bundledFirmware(product bitbox02common.Product) ([]byte, error) {
	info, ok := bundledFirmwares[product]
	if !ok {
		return nil, errp.New("unrecognized product")
	}
	gz, err := gzip.NewReader(bytes.NewBuffer(info.binary))
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(gz)
}
