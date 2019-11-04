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
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

// attestationPubkeys is a map of attestation pubkey identifier to attestation pubkey.
// the pubkey is an uncompressed SECP256k1 pubkey.
var attestationPubkeys = map[string]string{
	"f36581299c784acfe26d735c1f937f7e397ee471a02983906a29660f3eee2004": "04074ff1273b36c24e80fe3d59e0e897a81732d3f8e9cd07e17e9fc06319cd16b25cf74255674477b3ac9cbac2d12f0dc27a662681fcbc12955b0bccdcbbdcfd01",
	"4c2b7ec9399038da906633173db24f017cdba1a63fe2a84548319701a0b42039": "044c53a84f41fa7301b378bb3c260fc9b2ff1cbea7a78181279a8566797a736f12cea25fa2b1c27a844392fe9b37547dc6fbd00a2676b816e7d2d3562be2a0cbbd",
	"f24b6ffaae3cd4905ab07734afeb4d179a6b6954d28e710c98ddab9a53b91f44": "04e9c8dc929796aac65af5084eb54dc1ee482d5e0b5c58e2c93f243c5b70b21523324bdb78d7395317da165ef1138826c3ca3c91ca95e6f490c340cf5508a4a3ec",
	"0d39866fb5b0f81cdd559447ef3378a1f3e3e45e40b307a5fcbc5e02c67a967c": "04c2fb05889b9dff5a9fb22a59ee1d16bfc2863f0400ddcb69566e2abe8a15fa0ba1240254ca45aa310d170e724e1310ce5f611cada76c12e3c24a926a390ca4be",
	"10cecd28b7ed38fd08406728d149762007abd694a358f06448d3ee1dcd9d908a": "04c4e82d6d1b91e7853eba96a871ad31fc62620b826b0b8acf815c03de31b792a98e05bb34d3b9e0df1040eac485f03ff8bbbf7a857ef1cf2a49a60ac084efb88f",
}

// performAttestation sends a random challenge and verifies that the response can be verified with
// Shift's root attestation pubkeys. Returns true if the verification is successful.
func (device *Device) performAttestation() (bool, error) {
	challenge := bytesOrPanic(32)
	response, err := device.communication.Query(append([]byte(opAttestation), challenge...))
	if err != nil {
		return false, err
	}
	if string(response[:1]) != responseSuccess {
		return false, nil
	}
	response = response[1:]
	var bootloaderHash, devicePubkeyBytes, certificate, rootPubkeyIdentifier, challengeSignature []byte
	bootloaderHash, response = response[:32], response[32:]
	devicePubkeyBytes, response = response[:64], response[64:]
	certificate, response = response[:64], response[64:]
	rootPubkeyIdentifier, response = response[:32], response[32:]
	challengeSignature = response[:64]

	rootPubkeyHex, ok := attestationPubkeys[hex.EncodeToString(rootPubkeyIdentifier)]
	if !ok {
		return false, nil
	}
	rootPubkeyBytes, err := hex.DecodeString(rootPubkeyHex)
	if err != nil {
		panic(errp.WithStack(err))
	}
	rootPubkey, err := btcec.ParsePubKey(rootPubkeyBytes, btcec.S256())
	if err != nil {
		panic(errp.WithStack(err))
	}
	devicePubkey := ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(devicePubkeyBytes[:32]),
		Y:     new(big.Int).SetBytes(devicePubkeyBytes[32:]),
	}

	verify := func(pubkey *ecdsa.PublicKey, message []byte, signature []byte) bool {
		sigR := new(big.Int).SetBytes(signature[:32])
		sigS := new(big.Int).SetBytes(signature[32:])
		sigHash := sha256.Sum256(message)
		return ecdsa.Verify(pubkey, sigHash[:], sigR, sigS)
	}

	// Verify certificate
	var certMsg bytes.Buffer
	certMsg.Write(bootloaderHash)
	certMsg.Write(devicePubkeyBytes)
	if !verify(rootPubkey.ToECDSA(), certMsg.Bytes(), certificate) {
		return false, nil
	}
	// Verify challenge
	if !verify(&devicePubkey, challenge, challengeSignature) {
		return false, nil
	}
	return true, nil
}

// Attestation returns the result of the automatic attestation check.
func (device *Device) Attestation() bool {
	return device.attestation
}
