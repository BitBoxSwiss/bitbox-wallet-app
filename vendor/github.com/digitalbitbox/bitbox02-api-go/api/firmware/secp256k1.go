// Copyright 2020 Shift Crypto AG
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
	"crypto/sha256"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

func taggedSha256(tag []byte, msg []byte) []byte {
	h := sha256.New()
	tagHash := sha256.Sum256(tag)
	h.Write(tagHash[:]) //nolint:errcheck
	h.Write(tagHash[:]) //nolint:errcheck
	h.Write(msg)        //nolint:errcheck
	return h.Sum(nil)
}

func antikleptoHostCommit(hostNonce []byte) []byte {
	return taggedSha256([]byte("s2c/ecdsa/data"), hostNonce)
}

// antikleptoVerify verifies that hostNonce was used to tweak the nonce during signature
// generation according to k' = k + H(clientCommitment, hostNonce) by checking that
// k'*G = signerCommitment + H(signerCommitment, hostNonce)*G.
func antikleptoVerify(hostNonce, signerCommitment, signature []byte) error {
	signerCommitmentPubkey, err := btcec.ParsePubKey(signerCommitment, btcec.S256())
	if err != nil {
		return errp.WithStack(err)
	}
	curve := signerCommitmentPubkey.Curve
	// Compute R = R1 + H(R1, host_nonce)*G.
	tweak := taggedSha256([]byte("s2c/ecdsa/point"), append(signerCommitmentPubkey.SerializeCompressed(), hostNonce...))
	tx, ty := curve.ScalarBaseMult(tweak)
	x, _ := curve.Add(signerCommitmentPubkey.X, signerCommitmentPubkey.Y, tx, ty)
	x.Mod(x, curve.Params().N)
	signatureR := big.NewInt(0).SetBytes(signature[:32])
	if x.Cmp(signatureR) != 0 {
		return errp.New("Could not verify that the host nonce was contributed to the signature. " +
			"If this happens repeatedly, the device might be attempting to leak the " +
			"seed through the signature.")
	}
	return nil
}
