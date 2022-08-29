// Copyright 2019 Shift Cryptosecurity AG
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

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
)

// GapLimits holds the gap limits for receive and change addresses.
type GapLimits struct {
	// Receive is the gap limit for receive addresses.
	Receive uint16
	// Change is the gap limit for change addresses.
	Change uint16
}

// Signature is a type represending an ECDSA signature, or a BIP-340 Schnorr signature.
type Signature struct {
	R *big.Int
	S *big.Int
}

// SerializeDER encodes the ECDSA signature in the DER format.  Note that the serialized bytes
// returned do not include the appended hash type used in Bitcoin signature scripts.
func (s *Signature) SerializeDER() []byte {
	r := new(btcec.ModNScalar)
	r.SetByteSlice(s.R.Bytes())
	ss := new(btcec.ModNScalar)
	ss.SetByteSlice(s.S.Bytes())
	return ecdsa.NewSignature(r, ss).Serialize()
}

// SerializeCompact encodes the Schnorr signature in the 64 byte compact format: <R><S>.
func (s *Signature) SerializeCompact() []byte {
	result := make([]byte, 64)
	s.R.FillBytes(result[:32])
	s.S.FillBytes(result[32:])
	return result
}
