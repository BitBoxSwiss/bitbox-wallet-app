// Copyright 2018-2019 Shift Cryptosecurity AG
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

package firmware

import (
	"crypto/rand"

	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

// bytesOrPanic returns random bytes of the given length or panics in case of an error.
func bytesOrPanic(length int) []byte {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return bytes
}

func randomBytes(length int) ([]byte, error) {
	result := make([]byte, length)
	n, err := rand.Read(result)
	if err != nil {
		return nil, err
	}
	if n != length {
		return nil, errp.Newf("did not read %d bytes", length)
	}
	return result, nil
}
