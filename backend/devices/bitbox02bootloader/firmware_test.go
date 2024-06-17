// Copyright 2021 Shift Crypto AG
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
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
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
	require.Equal(t, string(expectedHash), hex.EncodeToString(hash[:]))
}

func TestBundledFirmware(t *testing.T) {
	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02Multi] {
		testHash(t, fw, bitbox02common.ProductBitBox02Multi, fmt.Sprintf("assets/firmware.v%s.signed.bin.sha256", fw.version))
	}

	for _, fw := range bundledFirmwares[bitbox02common.ProductBitBox02BTCOnly] {
		testHash(t, fw, bitbox02common.ProductBitBox02BTCOnly, fmt.Sprintf("assets/firmware-btc.v%s.signed.bin.sha256", fw.version))
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
		fwInfo, err := nextFirmware(product, 1)
		require.NoError(t, err)
		require.Equal(t, uint32(36), fwInfo.monotonicVersion)

		fwInfo, err = nextFirmware(product, 36)
		require.NoError(t, err)
		require.Equal(t, &firmwares[len(firmwares)-1], fwInfo)
	}
}
