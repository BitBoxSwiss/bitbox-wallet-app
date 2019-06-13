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

package bitbox

import (
	"fmt"

	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
)

//go:generate go-bindata -pkg $GOPACKAGE -o assets.go assets

var bundledFirmwareVersion = semver.NewSemVer(6, 1, 1)

// BundledFirmwareVersion returns the version of the bundled firmware.
func BundledFirmwareVersion() *semver.SemVer {
	return bundledFirmwareVersion
}

// BundledFirmware returns the binary of the bundled firmware.
func BundledFirmware() []byte {
	binary, err := Asset(fmt.Sprintf(
		"assets/firmware.deterministic.%s.signed.bin",
		bundledFirmwareVersion.String()))
	if err != nil {
		panic(err)
	}
	return binary
}
