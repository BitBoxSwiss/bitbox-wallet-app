// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// BTCSatAmount returns a BTC amount in sats with fiat conversions.
func (backend *Backend) BTCSatAmount(source string, amount string) (*coinpkg.FormattedAmountWithConversions, error) {
	const isFee = false
	btcCoin, err := backend.Coin(coinpkg.CodeBTC)
	if err != nil {
		return nil, err
	}

	var coinAmount coinpkg.Amount
	switch source {
	case "sat":
		satsInt, valid := new(big.Int).SetString(amount, 10)
		if !valid {
			return nil, errp.New("invalid amount")
		}
		if satsInt.Sign() < 0 {
			return nil, errp.New("amount must be non-negative")
		}
		coinAmount = coinpkg.NewAmount(satsInt)
	case "fiat":
		fiatRat, valid := new(big.Rat).SetString(amount)
		if !valid {
			return nil, errp.New("invalid amount")
		}
		if fiatRat.Sign() < 0 {
			return nil, errp.New("amount must be non-negative")
		}
		rate := backend.ratesUpdater.LatestPrice()[btcCoin.Unit(isFee)][backend.config.AppConfig().Backend.MainFiat]
		if rate == 0.0 {
			return nil, errp.New("exchange rate not available")
		}
		btcAmount := new(big.Rat).Quo(fiatRat, new(big.Rat).SetFloat64(rate))
		coinAmount = btcCoin.SetAmount(btcAmount, isFee)
	default:
		return nil, errp.New("invalid source")
	}

	return &coinpkg.FormattedAmountWithConversions{
		Amount:                 coinAmount.BigInt().String(),
		Unit:                   string(coinpkg.BtcUnitSats),
		UnformattedConversions: coinpkg.UnformattedConversions(coinAmount, btcCoin, isFee, backend.ratesUpdater),
		Conversions:            coinpkg.Conversions(coinAmount, btcCoin, isFee, backend.ratesUpdater),
	}, nil
}
