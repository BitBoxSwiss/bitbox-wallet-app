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
		58: "df6bde6c393ec6e887354a82a6433afe5fa8032b3763ed3de0bfe3aed303b939",
	},
	bitbox02common.ProductBitBox02BTCOnly: {
		56: "88992c7882a99de3058298a07e768f1dfc7fe79d71f59379f8d19f7ccd85239b",
		58: "09d981626c3858b37a29add954506cfac8915bc16ee89a23468ea7541e84b039",
	},
	bitbox02common.ProductBitBox02PlusMulti: {
		56: "7e2b9b9cc9bf28102c56cdb131df7af1252a13dfeea6d3647ae1d160ad150a74",
		58: "41c09591e29b9dec890d81df0a6ea835466956758f10f53e8d43437df6bd5f74",
	},
	bitbox02common.ProductBitBox02PlusBTCOnly: {
		56: "aef2f6dfe2f6ae1fc012d90511cdc2142e8cc24e1fe428445a88fedd3216eb0d",
		58: "289bb8e58590b71ed0b2b0966a50601ca818b19904c176a5c4c722e01827a626",
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
