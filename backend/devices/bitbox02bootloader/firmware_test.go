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
	"encoding/hex"
	"os"
	"testing"

	bitbox02common "github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/stretchr/testify/require"
)

func testHash(t *testing.T, info firmwareInfo, expectedMagic []byte, hashFile string) {
	t.Helper()

	const sigDataLen = 584
	const magicLen = 4

	binary, err := info.binary()
	require.NoError(t, err)
	require.True(t, len(binary) >= 4+sigDataLen)
	require.Equal(t, expectedMagic, binary[:magicLen])
	hash := sha256.Sum256(binary[magicLen+sigDataLen:])
	expectedHash, err := os.ReadFile(hashFile)
	require.NoError(t, err)
	require.Equal(t, string(expectedHash), hex.EncodeToString(hash[:]))
}

func TestBundledFirmware(t *testing.T) {
	magicMulti := []byte{0x65, 0x3f, 0x36, 0x2b}
	magicBTCOnly := []byte{0x11, 0x23, 0x3b, 0x0b}
	testHash(t, bundledFirmwares[bitbox02common.ProductBitBox02Multi], magicMulti, "assets/firmware.v9.15.0.signed.bin.sha256")
	testHash(t, bundledFirmwares[bitbox02common.ProductBitBox02BTCOnly], magicBTCOnly, "assets/firmware-btc.v9.15.0.signed.bin.sha256")
}
