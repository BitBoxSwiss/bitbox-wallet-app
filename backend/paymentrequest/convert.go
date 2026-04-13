// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import (
	"encoding/base64"

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

	sigBytes, err := base64.StdEncoding.DecodeString(slip24.Signature)
	if err != nil {
		return nil, err
	}

	memos := []Memo{}
	for _, memo := range slip24.Memos {
		switch memo.Type {
		case "text":
			memos = append(memos, Memo{
				Text: &TextMemo{Note: memo.Text},
			})
		case "coinPurchase":
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
		default:
			return nil, errp.New("Payment request memo unsupported")
		}
	}

	return &Request{
		RecipientName: slip24.RecipientName,
		Nonce:         nil,
		Signature:     sigBytes,
		TotalAmount:   slip24.Outputs[0].Amount,
		Memos:         memos,
	}, nil
}
