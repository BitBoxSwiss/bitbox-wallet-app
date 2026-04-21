// SPDX-License-Identifier: Apache-2.0

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

// ComputePaymentRequestSighashBytes returns the sighash to be signed for a SLIP-24 payment
// request using the normalized output value bytes as-is.
func ComputePaymentRequestSighashBytes(
	paymentRequest *messages.BTCPaymentRequestRequest,
	slip44 uint32,
	outputValueBytes []byte,
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
		case *messages.BTCPaymentRequestRequest_Memo_CoinPurchaseMemo_:
			_ = binary.Write(sighash, binary.LittleEndian, uint32(3))
			_ = binary.Write(sighash, binary.LittleEndian, m.CoinPurchaseMemo.CoinType)
			hashDataLenPrefixed(sighash, []byte(m.CoinPurchaseMemo.Amount))
			hashDataLenPrefixed(sighash, []byte(m.CoinPurchaseMemo.Address))
		default:
			return nil, errors.New("unsupported memo type")
		}
	}

	// coinType
	_ = binary.Write(sighash, binary.LittleEndian, slip44)

	// outputsHash (only one output for now)
	outputHasher := sha256.New()
	_, _ = outputHasher.Write(outputValueBytes)
	hashDataLenPrefixed(outputHasher, []byte(outputAddress))
	_, _ = sighash.Write(outputHasher.Sum(nil))

	return sighash.Sum(nil), nil
}

// ComputePaymentRequestSighash returns the sighash to be signed for a SLIP-24 payment request.
// It is kept for backwards compatibility.
// It is a BTC-oriented convenience wrapper that normalizes the output value as 8-byte
// little-endian before delegating to ComputePaymentRequestSighashBytes.
func ComputePaymentRequestSighash(
	paymentRequest *messages.BTCPaymentRequestRequest,
	slip44 uint32,
	outputValue uint64,
	outputAddress string,
) ([]byte, error) {
	outputValueBytes := binary.LittleEndian.AppendUint64(nil, outputValue)
	return ComputePaymentRequestSighashBytes(paymentRequest, slip44, outputValueBytes, outputAddress)
}
