// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import (
	"encoding/base64"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// ToRequest converts a signed slip-0024 payload into the internal validated representation used
// for transaction signing.
func (slip24 *Slip24) ToRequest() (*Request, error) {
	if slip24 == nil {
		return nil, nil
	}
	if len(slip24.Outputs) != 1 {
		return nil, errp.New("Missing or multiple payment request output unsupported")
	}

	if slip24.Nonce != nil && len(*slip24.Nonce) > 0 {
		return nil, errp.New("Nonce value unsupported")
	}
	totalAmount, err := slip24.Outputs[0].AmountBigInt()
	if err != nil {
		return nil, err
	}

	sigBytes, err := base64.StdEncoding.DecodeString(slip24.Signature)
	if err != nil {
		return nil, errp.Wrap(err, "decoding slip24 signature")
	}

	memos := []Memo{}
	purchaseCount, refundCount := 0, 0
	for _, memo := range slip24.Memos {
		switch memo.Type {
		case "text":
			memos = append(memos, Memo{
				Text: &TextMemo{Note: memo.Text},
			})
		case "coinPurchase":
			purchaseCount++
			if memo.CoinPurchase == nil {
				return nil, errp.New("Payment request coinPurchase memo missing payload")
			}
			coinPurchaseMemo := &CoinPurchaseMemo{
				CoinType: memo.CoinPurchase.CoinType,
				Amount:   memo.CoinPurchase.Amount,
				Address:  memo.CoinPurchase.Address,
			}
			if memo.CoinPurchase.AddressDerivation != nil && memo.CoinPurchase.AddressDerivation.Eth != nil {
				coinPurchaseMemo.EthAddressDerivation = &EthAddressDerivation{
					Keypath: memo.CoinPurchase.AddressDerivation.Eth.Keypath,
				}
			}
			if memo.CoinPurchase.AddressDerivation != nil && memo.CoinPurchase.AddressDerivation.Btc != nil {
				coinPurchaseMemo.BtcAddressDerivation = &BtcAddressDerivation{
					Keypath:    memo.CoinPurchase.AddressDerivation.Btc.Keypath,
					ScriptType: signing.ScriptType(memo.CoinPurchase.AddressDerivation.Btc.ScriptType),
				}
			}
			memos = append(memos, Memo{
				CoinPurchase: coinPurchaseMemo,
			})
		case "refund":
			refundCount++
			if memo.Refund == nil {
				return nil, errp.New("Payment request refund memo missing payload")
			}
			if strings.TrimSpace(memo.Refund.Address) == "" {
				return nil, errp.New("Payment request refund memo missing address")
			}
			refund := &RefundMemo{Address: memo.Refund.Address}
			if derivation := memo.Refund.AddressDerivation; derivation != nil {
				if derivation.Eth != nil && derivation.Btc != nil {
					return nil, errp.New("Payment request refund derivation is ambiguous")
				}
				if derivation.Eth != nil {
					refund.EthAddressDerivation = &EthAddressDerivation{Keypath: derivation.Eth.Keypath}
				}
				if derivation.Btc != nil {
					refund.BtcAddressDerivation = &BtcAddressDerivation{
						Keypath:    derivation.Btc.Keypath,
						ScriptType: signing.ScriptType(derivation.Btc.ScriptType),
					}
				}
			}
			memos = append(memos, Memo{Refund: refund})
		default:
			return nil, errp.New("Payment request memo unsupported")
		}
	}
	// Shared payment requests may omit refunds, but coin purchases must not contain duplicate memos.
	if purchaseCount > 0 && (purchaseCount != 1 || refundCount > 1) {
		return nil, errp.New("Payment request contains duplicate coinPurchase or refund memos")
	}

	return &Request{
		RecipientName: slip24.RecipientName,
		Nonce:         nil,
		Signature:     sigBytes,
		TotalAmount:   totalAmount,
		Memos:         memos,
	}, nil
}
