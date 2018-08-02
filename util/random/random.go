// Copyright 2018 Shift Devices AG
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

package random

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// HexString returns a random hex-encoded string of the given length in bytes.
func HexString(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", errp.WithStack(err)
	}
	return hex.EncodeToString(bytes), nil
}

// BytesOrPanic returns random bytes of the given length or panics in case of an error.
func BytesOrPanic(length int) []byte {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return bytes
}
