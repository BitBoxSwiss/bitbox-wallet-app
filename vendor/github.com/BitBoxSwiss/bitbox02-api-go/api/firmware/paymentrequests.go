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

package firmware

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"hash"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/btcsuite/btcd/wire"
)

func hashDataLenPrefixed(hasher hash.Hash, data []byte) {
	_ = wire.WriteVarInt(hasher, 0, uint64(len(data)))
	_, _ = hasher.Write(data)
}

// ComputePaymentRequestSighash returns the sighash to be signed for a SLIP-24 payment request.
func ComputePaymentRequestSighash(
	paymentRequest *messages.BTCPaymentRequestRequest,
	slip44 uint32,
	outputValue uint64,
	outputAddress string,
) ([]byte, error) {
	// The write results are ignored because sighash.Write cannot fail.

	sighash := sha256.New()

	// versionMagic
	_, _ = sighash.Write([]byte("SL\x00\x24"))

	// nonce
	hashDataLenPrefixed(sighash, paymentRequest.Nonce)

	// recipientName
	hashDataLenPrefixed(sighash, []byte(paymentRequest.RecipientName))

	// memos
	_ = wire.WriteVarInt(sighash, 0, uint64(len(paymentRequest.Memos)))
	for _, memo := range paymentRequest.Memos {
		switch m := memo.Memo.(type) {
		case *messages.BTCPaymentRequestRequest_Memo_TextMemo_:
			_ = binary.Write(sighash, binary.LittleEndian, uint32(1))
			hashDataLenPrefixed(sighash, []byte(m.TextMemo.Note))
		default:
			return nil, errors.New("unsupported memo type")
		}
	}

	// coinType
	_ = binary.Write(sighash, binary.LittleEndian, slip44)

	// outputsHash (only one output for now)
	outputHasher := sha256.New()
	_ = binary.Write(outputHasher, binary.LittleEndian, outputValue)
	hashDataLenPrefixed(outputHasher, []byte(outputAddress))
	_, _ = sighash.Write(outputHasher.Sum(nil))

	return sighash.Sum(nil), nil
}
