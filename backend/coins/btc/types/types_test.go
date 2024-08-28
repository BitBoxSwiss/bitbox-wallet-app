// Copyright 2022 Shift Crypto AG
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

package types

import (
	"math/big"
	"testing"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/stretchr/testify/require"
)

func TestSignatureDER(t *testing.T) {
	ecdsaSk, _ := btcec.PrivKeyFromBytes(
		[]byte("\xda\xfc\x5b\x9b\x48\x2e\x5c\x5c\xd0\x6b\xe6\x73\xde\x62\x97\xe5\xd5\x25\x9a\x4f\xab\x18\x51\x2a\x93\xfe\x00\x9b\xef\xb1\xeb\xc0"),
	)
	dummyMsg := make([]byte, 32)
	sig := ecdsa.SignCompact(ecdsaSk, dummyMsg, true)
	require.NotNil(t, sig)
	require.Equal(t,
		(&Signature{R: new(big.Int).SetBytes(sig[1:33]), S: new(big.Int).SetBytes(sig[33:])}).SerializeDER(),
		[]byte("\x30\x45\x02\x21\x00\xe6\x21\xa7\x68\x6d\x51\xfb\x23\xe7\x61\xad\xff\x43\x67\x88\x1a\x6f\xb1\x6b\xc5\x63\x5f\xf3\x4e\xea\x39\xaf\xda\xf0\x33\xe4\xd7\x02\x20\x79\x98\x51\x2f\x52\xbd\x3d\xae\x10\x09\x51\xa6\xdf\x9e\x66\xbc\xb7\x8c\x19\x4d\xca\xa3\xc7\xfd\x24\x51\x18\x0b\x5c\xc9\x4d\x4e"),
	)
}

func TestSignatureCompact(t *testing.T) {
	sigBytes := []byte("\xc8\xad\xb1\x9b\x6b\x03\xe1\x5e\xc9\xae\xb3\x4d\x44\x45\x1a\xed\x34\xba\x02\x13\xe4\xe8\xb5\xcd\x68\xfe\xce\x7d\x56\x77\x22\x58\xaa\xd3\xdb\xb9\xc4\xef\x11\x61\x0b\xeb\x56\x88\xcc\x2c\xfb\xa3\x13\xc6\xcc\x33\xeb\x32\x24\x4b\xa3\x50\xed\x97\x86\xc3\xf4\x6d")
	sig := &Signature{R: big.NewInt(0).SetBytes(sigBytes[:32]), S: big.NewInt(0).SetBytes(sigBytes[32:])}
	require.Equal(t, sig.SerializeCompact(), sigBytes)

	// Check that padding is preserved
	sigBytes = []byte("\x00\x00\x00\x00\x01\xaf\xaa\x37\x73\x8a\x19\xcd\xf0\x10\xe4\xcf\xb9\x8e\xc8\x5a\x92\x84\x5d\x05\x9d\xd7\xf3\x8b\x53\xd8\x01\x1c\x00\x00\x00\x00\xca\x28\xcc\xf3\x25\x8f\xb8\xf7\xd2\xe4\xf7\x0e\x1c\x7b\x7b\xe7\x11\xf8\x17\x4b\x30\x48\x61\x58\x7a\xa2\x00\x00")
	sig = &Signature{R: big.NewInt(0).SetBytes(sigBytes[:32]), S: big.NewInt(0).SetBytes(sigBytes[32:])}
	require.Equal(t, sig.SerializeCompact(), sigBytes)

}
