// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"encoding/hex"
	"fmt"
	"testing"

	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/stretchr/testify/require"
)

// Computed independently from the signed releases using the bootloader's hash formats.
var releaseFirmwareHashes = map[bitbox02common.Product]map[uint32]string{
	bitbox02common.ProductBitBox02Multi: {
		56: "7d2f1324ba17748184602c1b80dca892f02e558b4192f404dac7d3251ab1ccf1",
		57: "0cd8b7f0955f10242a765faf522747522ab4eff1c6019d5e226b510eff4b0dd0",
	},
	bitbox02common.ProductBitBox02BTCOnly: {
		56: "88992c7882a99de3058298a07e768f1dfc7fe79d71f59379f8d19f7ccd85239b",
		57: "53a8130d5b2e583c5adda6eb3315c846e3f69d882eeb20481f0feb3d1f4b1f07",
	},
	bitbox02common.ProductBitBox02PlusMulti: {
		56: "7e2b9b9cc9bf28102c56cdb131df7af1252a13dfeea6d3647ae1d160ad150a74",
		57: "31738b044d281f13fc22584cf9ab04a1d6c8af06ec10d6470b832d4034507f29",
	},
	bitbox02common.ProductBitBox02PlusBTCOnly: {
		56: "aef2f6dfe2f6ae1fc012d90511cdc2142e8cc24e1fe428445a88fedd3216eb0d",
		57: "cfb70710781c4be514b25b7b5b18cde5e1a53aa4133e4c3f3643461b01a7ae19",
	},
}

// Both bundled releases must match the hashes reported by their respective bootloaders.
func TestFirmwareHashes(t *testing.T) {
	for product, versions := range releaseFirmwareHashes {
		for version, expectedHash := range versions {
			t.Run(fmt.Sprintf("%s/%d", product, version), func(t *testing.T) {
				firmware, err := nextFirmware(product, version-1)
				require.NoError(t, err)
				require.Equal(t, version, firmware.monotonicVersion)
				hash, err := firmware.firmwareHash()
				require.NoError(t, err)
				require.Equal(t, expectedHash, hex.EncodeToString(hash))
			})
		}
	}
}
