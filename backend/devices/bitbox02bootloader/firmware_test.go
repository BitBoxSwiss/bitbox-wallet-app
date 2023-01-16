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

func TestBundledFirmware(t *testing.T) {
	const sigDataLen = 584
	const magicLen = 4

	binary, err := bundledFirmware(bitbox02common.ProductBitBox02Multi)
	require.NoError(t, err)
	require.True(t, len(binary) >= magicLen+sigDataLen)
	require.Equal(t, []byte{0x65, 0x3f, 0x36, 0x2b}, binary[:magicLen])
	hash := sha256.Sum256(binary[magicLen+sigDataLen:])
	expectedHash, err := os.ReadFile("assets/firmware.sha256")
	require.NoError(t, err)
	require.Equal(t, string(expectedHash), hex.EncodeToString(hash[:]))

	binary, err = bundledFirmware(bitbox02common.ProductBitBox02BTCOnly)
	require.NoError(t, err)
	require.True(t, len(binary) >= 4+sigDataLen)
	require.Equal(t, []byte{0x11, 0x23, 0x3b, 0x0b}, binary[:magicLen])
	hash = sha256.Sum256(binary[magicLen+sigDataLen:])
	expectedHash, err = os.ReadFile("assets/firmware-btc.sha256")
	require.NoError(t, err)
	require.Equal(t, string(expectedHash), hex.EncodeToString(hash[:]))
}
