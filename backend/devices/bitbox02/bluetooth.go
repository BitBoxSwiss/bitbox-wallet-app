// Copyright 2025 Shift Crypto AG
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

package bitbox02

import (
	"crypto/sha256"
	_ "embed" // Needed for the go:embed directive below.
)

//go:embed assets/da14531-firmware.bin
var bluetoothFirmware []byte

func bundledBluetoothFirmwareHash() []byte {
	hash := sha256.Sum256(bluetoothFirmware)
	return hash[:]
}
