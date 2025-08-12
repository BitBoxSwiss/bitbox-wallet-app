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

package u2fhid

import (
	"io"
	"runtime"

	"github.com/karalabe/hid"
)

// HidDevice should be used to wrap a *hid.Device when used with `Communication`.
//
// On macOS only, we want to write only 64 bytes at a time. There was a bug in the BitBox firmware
// (fixed in v9.23.1, see https://github.com/BitBoxSwiss/bitbox02-firmware/pull/1526) - when signing
// a transaction, during the second inputs pass, 128 bytes are written to the hid device in one
// shot, which results in a IOKit Timeout error. Writing only 64 bytes at a time (the HID report
// size) fixes that. Otherwise we feed as many bytes as possible, which is important especially on
// iOS, where we want to send as much as possible over Bluetooth instead of many little chunks.
// /
// From BitBox02 v9.23.1 onwards, this fix is not required, but we also saw some cases of firmware
// upgrades failing on macOS, and we suspect the same bug in the bootloader <v1.1.2 might be causing
// it, and writing 64 bytes at a time might fix it.
type HidDevice struct {
	io.ReadWriteCloser
}

// NewHidDevice wraps a hid device to write only 64 bytes at a time on macOS.
func NewHidDevice(device hid.Device) *HidDevice {
	return &HidDevice{ReadWriteCloser: device}
}

func (d *HidDevice) Write(data []byte) (int, error) {
	if runtime.GOOS == "darwin" && len(data) > 64 {
		data = data[:64]
	}
	return d.ReadWriteCloser.Write(data)
}
