// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

// Refund address and derivation survive protobuf serialization for every supported script family.
func TestPaymentRequestRefundMapping(t *testing.T) {
	path := []uint32{2147483732, 2147483648, 2147483648, 0, 3}
	for _, scriptType := range []signing.ScriptType{"", signing.ScriptTypeP2WPKHP2SH, signing.ScriptTypeP2WPKH, signing.ScriptTypeP2TR} {
		t.Run(string(scriptType), func(t *testing.T) {
			refund := &paymentrequest.RefundMemo{Address: "signed-refund-address"}
			if scriptType == "" {
				refund.EthAddressDerivation = &paymentrequest.EthAddressDerivation{Keypath: path}
			} else {
				refund.BtcAddressDerivation = &paymentrequest.BtcAddressDerivation{Keypath: path, ScriptType: scriptType}
			}
			request, err := newBTCPaymentRequest(&paymentrequest.Request{
				TotalAmount: big.NewInt(1000),
				Memos: []paymentrequest.Memo{
					{Text: &paymentrequest.TextMemo{Note: "payment"}},
					{Refund: refund},
				},
			})
			require.NoError(t, err)
			encoded, err := proto.Marshal(request)
			require.NoError(t, err)
			var decoded messages.BTCPaymentRequestRequest
			require.NoError(t, proto.Unmarshal(encoded, &decoded))
			require.True(t, proto.Equal(request, &decoded))
			require.Equal(t, "payment", decoded.Memos[0].GetTextMemo().Note)
			mappedRefund := decoded.Memos[1].GetRefundMemo()
			require.Equal(t, refund.Address, mappedRefund.Address)
			if scriptType == "" {
				require.Equal(t, path, mappedRefund.GetEth().Keypath)
				require.Nil(t, mappedRefund.GetBtc())
			} else {
				require.Equal(t, path, mappedRefund.GetBtc().ScriptConfig.Keypath)
				require.Equal(t, btcMsgScriptTypeMap[scriptType], mappedRefund.GetBtc().ScriptConfig.ScriptConfig.GetSimpleType())
				require.Nil(t, mappedRefund.GetEth())
			}
		})
	}
}

// Missing, ambiguous or unsupported refund ownership metadata must fail before device communication.
func TestPaymentRequestRejectsInvalidRefund(t *testing.T) {
	for _, refund := range []*paymentrequest.RefundMemo{
		{Address: "address"},
		{Address: "address", EthAddressDerivation: &paymentrequest.EthAddressDerivation{}, BtcAddressDerivation: &paymentrequest.BtcAddressDerivation{}},
		{Address: "address", EthAddressDerivation: &paymentrequest.EthAddressDerivation{}},
		{Address: "address", BtcAddressDerivation: &paymentrequest.BtcAddressDerivation{ScriptType: signing.ScriptTypeP2WPKH}},
		{Address: "address", BtcAddressDerivation: &paymentrequest.BtcAddressDerivation{Keypath: []uint32{1}, ScriptType: "unknown"}},
		{EthAddressDerivation: &paymentrequest.EthAddressDerivation{Keypath: []uint32{1}}},
	} {
		request, err := newBTCPaymentRequest(&paymentrequest.Request{Memos: []paymentrequest.Memo{{Refund: refund}}})
		require.Error(t, err)
		require.Nil(t, request)
	}
}

// The app mapping matches the firmware refund digest vector; only the address, not derivation metadata, is signed.
func TestPaymentRequestRefundSighash(t *testing.T) {
	refund := &paymentrequest.RefundMemo{
		Address: "bc1qaff6ey7a8nztdl8ufluu5eagpwy6sntmaf53pf",
		BtcAddressDerivation: &paymentrequest.BtcAddressDerivation{
			Keypath: []uint32{2147483732, 2147483648, 2147483648, 0, 0}, ScriptType: signing.ScriptTypeP2WPKH,
		},
	}
	request := &paymentrequest.Request{
		RecipientName: "Test Swap", TotalAmount: big.NewInt(100000),
		Memos: []paymentrequest.Memo{
			{CoinPurchase: &paymentrequest.CoinPurchaseMemo{
				CoinType: 60, Amount: "0.25 ETH", Address: "0x773A77b9D32589be03f9132AF759e294f7851be9",
			}},
			{Refund: refund},
		},
	}
	const outputAddress = "bc1qkkweqa5vk942jgevs0x0h8hsmqgfr08n6l7tu9"
	digest := func() []byte {
		mapped, err := newBTCPaymentRequest(request)
		require.NoError(t, err)
		hash, err := firmware.ComputePaymentRequestSighash(mapped, 0, 100000, outputAddress)
		require.NoError(t, err)
		return hash
	}
	original := digest()
	require.Equal(t, "eda7a0a2a0f1e24227e58add144371008744d6fbc14aca0a415f0b1281e10863", hex.EncodeToString(original))
	refund.BtcAddressDerivation.Keypath[4]++
	require.Equal(t, original, digest())
	refund.Address = outputAddress
	require.NotEqual(t, original, digest())
}

// Ordinary signed merchant payments retain their text, amount and signature without a refund memo.
func TestPaymentRequestPreservesTextMemo(t *testing.T) {
	request, err := newBTCPaymentRequest(&paymentrequest.Request{
		RecipientName: "merchant",
		TotalAmount:   big.NewInt(1000),
		Signature:     []byte("signature"),
		Memos:         []paymentrequest.Memo{{Text: &paymentrequest.TextMemo{Note: "payment"}}},
	})
	require.NoError(t, err)
	require.Equal(t, uint64(1000), request.TotalAmount)
	require.Equal(t, []byte("signature"), request.Signature)
	require.Equal(t, "payment", request.Memos[0].GetTextMemo().Note)
}

// A coin purchase without a refund reaches the device mapper with its signed fields and derivation intact.
func TestPaymentRequestCoinPurchaseWithoutRefund(t *testing.T) {
	path := []uint32{2147483692, 2147483708, 2147483648, 0, 0}
	request, err := (&paymentrequest.Slip24{
		RecipientName: "merchant",
		Outputs:       []paymentrequest.Slip24Out{{Amount: "1000", Address: "deposit"}},
		Signature:     "c2ln",
		Memos: []paymentrequest.Slip24Memo{{
			Type: "coinPurchase",
			CoinPurchase: &paymentrequest.Slip24CoinPurchase{
				CoinType: 60, Amount: "0.25 ETH", Address: "0x773A77b9D32589be03f9132AF759e294f7851be9",
				AddressDerivation: &paymentrequest.Slip24AddressDerivation{
					Eth: &paymentrequest.Slip24EthAddressDerivation{Keypath: path},
				},
			},
		}},
	}).ToRequest()
	require.NoError(t, err)
	mapped, err := newBTCPaymentRequest(request)
	require.NoError(t, err)
	require.Equal(t, uint64(1000), mapped.TotalAmount)
	require.Equal(t, []byte("sig"), mapped.Signature)
	require.Len(t, mapped.Memos, 1)
	require.Nil(t, mapped.Memos[0].GetRefundMemo())
	purchase := mapped.Memos[0].GetCoinPurchaseMemo()
	require.Equal(t, request.Memos[0].CoinPurchase.Address, purchase.Address)
	require.Equal(t, uint32(60), purchase.CoinType)
	require.Equal(t, "0.25 ETH", purchase.Amount)
	require.Equal(t, path, purchase.GetEth().Keypath)
}

// Reject unknown internal memo variants instead of silently changing the signed memo sequence.
func TestPaymentRequestRejectsUnknownMemo(t *testing.T) {
	request, err := newBTCPaymentRequest(&paymentrequest.Request{Memos: []paymentrequest.Memo{{}}})
	require.EqualError(t, err, "Payment request memo unsupported")
	require.Nil(t, request)
}
