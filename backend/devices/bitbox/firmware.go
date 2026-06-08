// SPDX-License-Identifier: Apache-2.0

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
