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
	"fmt"
	"math/big"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
)

type attestationPubkey struct {
	// pubKeyHex is the uncompressed SECP256k1 attestation pubkey, hex-encoded.
	pubkeyHex string
	// acceptedBootloaderHashHex, if non-empty, is a hex-encoded bootloader hashes (of the padded
	// bootloader binary, i.e. the device bootloader area), for which this attestation pubkey is
	// valid. If empty, any bootloader will be accepted.
	acceptedBootloaderHashHex string
}

// attestationPubkeys is a map of attestation pubkey identifier to attestation pubkey.
// The identifier is sha256(pubkey).
var attestationPubkeys = map[string]attestationPubkey{
	"f36581299c784acfe26d735c1f937f7e397ee471a02983906a29660f3eee2004": {
		pubkeyHex: "04074ff1273b36c24e80fe3d59e0e897a81732d3f8e9cd07e17e9fc06319cd16b25cf74255674477b3ac9cbac2d12f0dc27a662681fcbc12955b0bccdcbbdcfd01",
	},
	"4c2b7ec9399038da906633173db24f017cdba1a63fe2a84548319701a0b42039": {
		pubkeyHex: "044c53a84f41fa7301b378bb3c260fc9b2ff1cbea7a78181279a8566797a736f12cea25fa2b1c27a844392fe9b37547dc6fbd00a2676b816e7d2d3562be2a0cbbd",
	},
	"f24b6ffaae3cd4905ab07734afeb4d179a6b6954d28e710c98ddab9a53b91f44": {
		pubkeyHex: "04e9c8dc929796aac65af5084eb54dc1ee482d5e0b5c58e2c93f243c5b70b21523324bdb78d7395317da165ef1138826c3ca3c91ca95e6f490c340cf5508a4a3ec",
	},
	"0d39866fb5b0f81cdd559447ef3378a1f3e3e45e40b307a5fcbc5e02c67a967c": {
		pubkeyHex: "04c2fb05889b9dff5a9fb22a59ee1d16bfc2863f0400ddcb69566e2abe8a15fa0ba1240254ca45aa310d170e724e1310ce5f611cada76c12e3c24a926a390ca4be",
	},
	"10cecd28b7ed38fd08406728d149762007abd694a358f06448d3ee1dcd9d908a": {
		pubkeyHex: "04c4e82d6d1b91e7853eba96a871ad31fc62620b826b0b8acf815c03de31b792a98e05bb34d3b9e0df1040eac485f03ff8bbbf7a857ef1cf2a49a60ac084efb88f",
	},
	"62a321078b3d0affb6b6b4dace9333b89263c85052c63dc6570294f9994bf105": {
		pubkeyHex:                 "040526f5b8348a8d55e7b1cac043ce98c55bbdb3311b4d1bb2d654281edf8aeb21f018fb027a6b08e4ddc62c919e648690722d00c6f54c668c9bd8224a1d82423a",
		acceptedBootloaderHashHex: "e8fa0bd5fc80b86b9f1ea983664df33b27f6f95855d79fb43248ee4c3d3e6be6",
	},
	"bc1b9b196839e029458b86456c222641a2a681570a52a5637f8d34ad6ab8b643": {
		pubkeyHex: "0422491e19766bd96a56e3f2f3926a6c57b89209ff47bd10e523b223ff65ab9af11c0a5f62c187514f2117ce772de90f9901ee122af78e69bbc4d29eec811be8ec",
	},
	"fa077dc3d0caea63d8a2a7ba0392560b76041001e3ba3af9655423ff457b9d1e": {
		pubkeyHex: "049f1b7180014b6de60d41f16a3c0a37b20146585e4884960249d30f3cd68c74d04420d0cedef5719d6b1529b085ecd534fa6c1690be5eb1b3331bc57b5db224dc",
	},
	"e00da42fea5ae884fcfb351b62b6ca4e64a94cde155164fad83f44732c51a844": {
		pubkeyHex: "04adaa011a4ced11310728abb64f09636267ce0b05782da6d3eeaf987cec7c64f279ad55327184f9e5b4a1e53089b31bcc65032dad7205325f41ed3d9fdfba1f88",
	},
	"e1295cbb22e3ab5479b2be728f9b6899b509295beecab93c42b24f8f0a620c9c": {
		pubkeyHex: "044a70e663d7fe5fe0d4cbbb752883e35222b8d7d7bffdaa8d591995d1252528a4e9a3e4d5220d485021728b3cdad4fccc681a6ddeea8e2f7c55b4acde8d53573d",
	},
}

// performAttestation sends a random challenge and verifies that the response can be verified with
// Shift's root attestation pubkeys. Returns true if the verification is successful.
func (device *Device) performAttestation() (bool, error) {
	if !device.version.AtLeast(semver.NewSemVer(2, 0, 0)) {
		// skip warning for v1.0.0, where attestation was not supported.
		return true, nil
	}
	challenge := bytesOrPanic(32)
	response, err := device.rawQuery(append([]byte(opAttestation), challenge...))
	if err != nil {
		device.log.Error(fmt.Sprintf("attestation: could not perform request. challenge=%x", challenge), err)
		return false, err
	}

	// See parsing below for what the sizes mean.
	if len(response) < 1+32+64+64+32+64 {
		device.log.Error(
			fmt.Sprintf("attestation: response too short. challenge=%x, response=%x", challenge, response), nil)
		return false, nil
	}
	if string(response[:1]) != responseSuccess {
		device.log.Error(
			fmt.Sprintf("attestation: expected success. challenge=%x, response=%x", challenge, response), nil)
		return false, nil
	}
	rsp := response[1:]
	var bootloaderHash, devicePubkeyBytes, certificate, rootPubkeyIdentifier, challengeSignature []byte
	bootloaderHash, rsp = rsp[:32], rsp[32:]
	devicePubkeyBytes, rsp = rsp[:64], rsp[64:]
	certificate, rsp = rsp[:64], rsp[64:]
	rootPubkeyIdentifier, rsp = rsp[:32], rsp[32:]
	challengeSignature = rsp[:64]

	rootPubkeyInfo, ok := attestationPubkeys[hex.EncodeToString(rootPubkeyIdentifier)]
	if !ok {
		device.log.Error(fmt.Sprintf(
			"could not find root pubkey. challenge=%x, response=%x, identifier=%x",
			challenge,
			response,
			rootPubkeyIdentifier), nil)
		return false, nil
	}
	if rootPubkeyInfo.acceptedBootloaderHashHex != "" {
		if rootPubkeyInfo.acceptedBootloaderHashHex != hex.EncodeToString(bootloaderHash) {
			device.log.Error(
				fmt.Sprintf(
					"attestation: bootloader not accepted. challenge=%x, response=%x, bootloaderHash=%x, acceptedBootloaderHashHex=%s",
					challenge, response, bootloaderHash, rootPubkeyInfo.acceptedBootloaderHashHex), nil)
			return false, nil
		}
	}
	rootPubkeyBytes, err := hex.DecodeString(rootPubkeyInfo.pubkeyHex)
	if err != nil {
		panic(errp.WithStack(err))
	}
	rootPubkey, err := btcec.ParsePubKey(rootPubkeyBytes)
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
		device.log.Error(
			fmt.Sprintf("attestation: could not verify certificate. challenge=%x, response=%x", challenge, response), nil)
		return false, nil
	}
	// Verify challenge
	if !verify(&devicePubkey, challenge, challengeSignature) {
		device.log.Error(
			fmt.Sprintf("attestation: could not verify challgege signature. challenge=%x, response=%x", challenge, response), nil)
		return false, nil
	}
	return true, nil
}

// Attestation returns the result of the automatic attestation check. If nil, the check has not been
// completed yet.
func (device *Device) Attestation() *bool {
	return device.attestation
}
