package bitbox

import (
	"fmt"

	"github.com/shiftdevices/godbb/util/semver"
)

//go:generate go-bindata -pkg $GOPACKAGE -o assets.go assets

var bundledFirmwareVersion = semver.NewSemVer(3, 0, 0)

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
