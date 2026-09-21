// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// ParseExternalBTCAmount formats a BTC-denominated amount in the selected display unit.
func (backend *Backend) ParseExternalBTCAmount(amount string) (string, error) {
	amountRat, valid := new(big.Rat).SetString(amount)
	if !valid {
		return "", errp.New("invalid amount")
	}
	btcCoin, err := backend.Coin(coinpkg.CodeBTC)
	if err != nil {
		return "", err
	}
	coinAmount := coinpkg.NewAmountFromRat(amountRat, coinpkg.DecimalsExp(btcCoin, false))
	return btcCoin.FormatAmount(coinAmount, false), nil
}

// ConvertToCurrency converts an amount in the coin's selected display unit to a plain currency amount.
func (backend *Backend) ConvertToCurrency(coinCode coinpkg.Code, currency, amount string) (string, error) {
	currentCoin, err := backend.Coin(coinCode)
	if err != nil {
		return "", err
	}
	coinAmount, err := currentCoin.ParseAmount(amount)
	if err != nil {
		return "", err
	}
	rate := backend.ratesUpdater.LatestPrice()[currentCoin.Unit(false)][currency]
	converted := new(big.Rat).Mul(coinpkg.ToUnitRat(coinAmount, currentCoin, false), new(big.Rat).SetFloat64(rate))
	return coinpkg.FormatAsPlainCurrency(converted, currency), nil
}

// ConvertFromCurrency converts a currency amount to the coin's selected display unit.
func (backend *Backend) ConvertFromCurrency(coinCode coinpkg.Code, currency, amount string) (string, error) {
	currentCoin, err := backend.Coin(coinCode)
	if err != nil {
		return "", errp.New("internal error")
	}
	amountRat, valid := new(big.Rat).SetString(amount)
	if !valid {
		return "", errp.New("invalid amount")
	}
	coinAmount, _ := backend.amountFromCurrency(currentCoin, currency, amountRat)
	return currentCoin.FormatAmount(coinAmount, false), nil
}

// amountFromCurrency returns the amount in smallest units and whether an exchange rate is available.
// An unavailable rate produces a zero amount.
func (backend *Backend) amountFromCurrency(currentCoin coinpkg.Coin, currency string, amount *big.Rat) (coinpkg.Amount, bool) {
	rate := backend.ratesUpdater.LatestPrice()[currentCoin.Unit(false)][currency]
	if rate == 0 {
		return coinpkg.NewAmountFromInt64(0), false
	}
	converted := new(big.Rat).Quo(amount, new(big.Rat).SetFloat64(rate))
	return coinpkg.NewAmountFromRat(converted, coinpkg.DecimalsExp(currentCoin, false)), true
}

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
		var rateAvailable bool
		coinAmount, rateAvailable = backend.amountFromCurrency(btcCoin, backend.config.AppConfig().Backend.MainFiat, fiatRat)
		if !rateAvailable {
			return nil, errp.New("exchange rate not available")
		}
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
