// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"maps"
	"os"
	"slices"
	"testing"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/stretchr/testify/require"
)

// Every bundled firmware must have the expected product, and the manifest must exactly match the
// unsigned payload hashes sorted by filename, including formatting and completeness.
func TestBundledFirmware(t *testing.T) {
	manifest, err := os.ReadFile("assets/unsigned-firmware.sha256")
	require.NoError(t, err)
	checksums := map[string][sha256.Size]byte{}
	prefixes := map[bitbox02common.Product]string{
		bitbox02common.ProductBitBox02Multi:       "firmware-bitbox02-multi",
		bitbox02common.ProductBitBox02BTCOnly:     "firmware-bitbox02-btconly",
		bitbox02common.ProductBitBox02PlusMulti:   "firmware-bitbox02nova-multi",
		bitbox02common.ProductBitBox02PlusBTCOnly: "firmware-bitbox02nova-btconly",
	}
	for expectedProduct, firmwares := range bundledFirmwares {
		for _, fw := range firmwares {
			prefix := prefixes[expectedProduct]
			require.NotEmpty(t, prefix, "unknown product: %s", expectedProduct)
			if fw.version.String() == "9.17.1" {
				switch expectedProduct {
				case bitbox02common.ProductBitBox02Multi:
					prefix = "firmware"
				case bitbox02common.ProductBitBox02BTCOnly:
					prefix = "firmware-btc"
				}
			}
			filename := fmt.Sprintf("%s.v%s.bin", prefix, fw.version)
			t.Run(filename, func(t *testing.T) {
				signedBinary, err := fw.signedBinary()
				require.NoError(t, err)
				product, _, binary, err := bootloader.ParseSignedFirmware(signedBinary)
				require.NoError(t, err)
				require.Equal(t, expectedProduct, product)
				checksums[filename] = sha256.Sum256(binary)
			})
		}
	}
	generatedManifest := ""
	for _, filename := range slices.Sorted(maps.Keys(checksums)) {
		generatedManifest += fmt.Sprintf("%x  %s\n", checksums[filename], filename)
	}
	require.Equal(t, string(manifest), generatedManifest)
}

func TestMontonicVersions(t *testing.T) {
	for product, binaries := range bundledFirmwares {
		for _, fwInfo := range binaries {
			signedBinary, err := fwInfo.signedBinary()
			require.NoError(t, err)

			// TODO: replace magic numbers with parsing functions from the bitbox02-api-go lib,
			// which first have to be exposed.
			fwVersion := binary.LittleEndian.Uint32(signedBinary[392:396])

			require.Equal(t, fwInfo.monotonicVersion, fwVersion, "%s; %s", product, fwInfo.version)
		}
	}
}

func TestFirmwaresOrdered(t *testing.T) {
	for product, binaries := range bundledFirmwares {
		var current uint32
		for _, fwInfo := range binaries {
			if fwInfo.monotonicVersion <= current {
				require.Fail(t, fmt.Sprintf("firmwares of %s are not ordered", product))
			}
			current = fwInfo.monotonicVersion
		}

	}
}

func TestNextFirmware(t *testing.T) {
	for product, firmwares := range bundledFirmwares {
		switch product {
		case bitbox02common.ProductBitBox02Multi, bitbox02common.ProductBitBox02BTCOnly:
			fwInfo, err := nextFirmware(product, 1)
			require.NoError(t, err)
			require.Equal(t, uint32(36), fwInfo.monotonicVersion)

			// The legacy intermediate signals completion by incrementing the monotonic version.
			fwInfo, err = nextFirmware(product, fwInfo.monotonicVersion+1)
			require.NoError(t, err)
			require.Equal(t, uint32(50), fwInfo.monotonicVersion)

			fwInfo, err = nextFirmware(product, fwInfo.monotonicVersion)
			require.NoError(t, err)
			require.Equal(t, uint32(56), fwInfo.monotonicVersion)
		case bitbox02common.ProductBitBox02PlusMulti, bitbox02common.ProductBitBox02PlusBTCOnly:
			fwInfo, err := nextFirmware(product, 1)
			require.NoError(t, err)
			require.Equal(t, uint32(50), fwInfo.monotonicVersion)

			fwInfo, err = nextFirmware(product, fwInfo.monotonicVersion)
			require.NoError(t, err)
			require.Equal(t, uint32(56), fwInfo.monotonicVersion)
		default:
			require.Fail(t, "unknown product")
		}
		fwInfo, err := nextFirmware(product, 56)
		require.NoError(t, err)
		require.Equal(t, &firmwares[len(firmwares)-1], fwInfo)
		require.Equal(t, uint32(57), fwInfo.monotonicVersion)
	}
}

// The v9.27.2 intermediate must finish installing bootloader v1.2.3 before continuing.
func TestStage0UpgradeIntermediate(t *testing.T) {
	for product := range bundledFirmwares {
		t.Run(string(product), func(t *testing.T) {
			intermediate, err := nextFirmware(product, 54)
			require.NoError(t, err)
			require.Equal(t, "9.27.2", intermediate.version.String())
			require.Equal(t, uint32(56), intermediate.monotonicVersion)
			for _, counter := range []uint32{55, 56, 57} {
				require.Equal(t, counter == 56, intermediate.bootRequired(counter, semver.NewSemVer(1, 2, 2)))
				require.False(t, intermediate.continuesUpgrade(counter, semver.NewSemVer(1, 2, 2)))
				require.False(t, intermediate.bootRequired(counter, semver.NewSemVer(1, 2, 3)))
				require.Equal(t, counter == 56, intermediate.continuesUpgrade(counter, semver.NewSemVer(1, 2, 3)))
			}
		})
	}
}

func TestIntermediateContinuesUpgrade(t *testing.T) {
	legacyIntermediate := firmwareInfo{monotonicVersion: 36}
	require.False(t, legacyIntermediate.continuesUpgrade(36, semver.NewSemVer(9, 9, 9)))
	require.True(t, legacyIntermediate.continuesUpgrade(37, semver.NewSemVer(0, 0, 0)))

	bootloaderIntermediate := firmwareInfo{
		monotonicVersion:            50,
		completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
	}
	require.False(t, bootloaderIntermediate.continuesUpgrade(49, semver.NewSemVer(1, 2, 2)))
	require.True(t, bootloaderIntermediate.continuesUpgrade(50, semver.NewSemVer(1, 2, 2)))
	require.False(t, bootloaderIntermediate.continuesUpgrade(51, semver.NewSemVer(1, 2, 2)))
}

func TestIntermediateBootRequired(t *testing.T) {
	legacyIntermediate := firmwareInfo{monotonicVersion: 36}
	require.True(t, legacyIntermediate.bootRequired(36, semver.NewSemVer(9, 9, 9)))
	require.False(t, legacyIntermediate.bootRequired(37, semver.NewSemVer(0, 0, 0)))

	bootloaderIntermediate := firmwareInfo{
		monotonicVersion:            50,
		completionBootloaderVersion: semver.NewSemVer(1, 2, 2),
	}
	require.True(t, bootloaderIntermediate.bootRequired(50, semver.NewSemVer(1, 1, 9)))
	require.False(t, bootloaderIntermediate.bootRequired(50, semver.NewSemVer(1, 2, 2)))
	require.False(t, bootloaderIntermediate.bootRequired(50, semver.NewSemVer(1, 3, 0)))
}
