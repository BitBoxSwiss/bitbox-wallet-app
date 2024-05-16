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
	"bytes"
	"compress/gzip"
	_ "embed" // Needed for the go:embed directives below.
	"io"

	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

//go:embed assets/firmware.deterministic.7.1.0.signed.bin.gz
var firmwareBinary []byte

var bundledFirmwareVersion = semver.NewSemVer(7, 1, 0)

// BundledFirmwareVersion returns the version of the bundled firmware.
func BundledFirmwareVersion() *semver.SemVer {
	return bundledFirmwareVersion
}

// BundledFirmware returns the binary of the bundled firmware.
func BundledFirmware() ([]byte, error) {
	gz, err := gzip.NewReader(bytes.NewBuffer(firmwareBinary))
	if err != nil {
		return nil, err
	}
	return io.ReadAll(gz)
}
