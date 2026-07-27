// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/stretchr/testify/require"
)

func testHash(t *testing.T, info firmwareInfo, expectedProduct bitbox02common.Product, hashFile string) {
	t.Helper()

	signedBinary, err := info.signedBinary()
	require.NoError(t, err)
	product, _, binary, err := bootloader.ParseSignedFirmware(signedBinary)
	require.NoError(t, err)
	require.Equal(t, expectedProduct, product)
	hash := sha256.Sum256(binary)
	expectedHash, err := os.ReadFile(hashFile)
	require.NoError(t, err)
	require.Equal(t, strings.TrimSpace(string(expectedHash)), hex.EncodeToString(hash[:]), hashFile)
}

func TestBundledFirmware(t *testing.T) {
	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02Multi] {
		t.Run("bitbox02-multi/"+fw.version.String(), func(t *testing.T) {
			filename := fmt.Sprintf("assets/firmware-bitbox02-multi.v%s.signed.bin.sha256", fw.version)
			if fw.version.String() == "9.17.1" {
				filename = fmt.Sprintf("assets/firmware.v%s.signed.bin.sha256", fw.version)
			}
			testHash(t, fw, bitbox02common.ProductBitBox02Multi, filename)
		})
	}

	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02BTCOnly] {
		t.Run("bitbox02-btconly/"+fw.version.String(), func(t *testing.T) {
			filename := fmt.Sprintf("assets/firmware-bitbox02-btconly.v%s.signed.bin.sha256", fw.version)
			if fw.version.String() == "9.17.1" {
				filename = fmt.Sprintf("assets/firmware-btc.v%s.signed.bin.sha256", fw.version)
			}
			testHash(t, fw, bitbox02common.ProductBitBox02BTCOnly, filename)
		})
	}

	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02PlusMulti] {
		t.Run("bitbox02nova-multi/"+fw.version.String(), func(t *testing.T) {
			testHash(t, fw, bitbox02common.ProductBitBox02PlusMulti, fmt.Sprintf("assets/firmware-bitbox02nova-multi.v%s.signed.bin.sha256", fw.version))
		})
	}

	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02PlusBTCOnly] {
		t.Run("bitbox02nova-btconly/"+fw.version.String(), func(t *testing.T) {
			testHash(t, fw, bitbox02common.ProductBitBox02PlusBTCOnly, fmt.Sprintf("assets/firmware-bitbox02nova-btconly.v%s.signed.bin.sha256", fw.version))
		})
	}
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
			require.Equal(t, &firmwares[len(firmwares)-1], fwInfo)
		case bitbox02common.ProductBitBox02PlusMulti, bitbox02common.ProductBitBox02PlusBTCOnly:
			fwInfo, err := nextFirmware(product, 1)
			require.NoError(t, err)
			require.Equal(t, uint32(50), fwInfo.monotonicVersion)

			fwInfo, err = nextFirmware(product, fwInfo.monotonicVersion)
			require.NoError(t, err)
			require.Equal(t, &firmwares[len(firmwares)-1], fwInfo)
		default:
			require.Fail(t, "unknown product")
		}
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
