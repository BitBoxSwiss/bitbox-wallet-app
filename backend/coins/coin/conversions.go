package coin

import (
	"math/big"
	"strings"
	"time"

	ratesPkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
)

// btc2SatUnit is the sat equivalent of 1 BTC.
const btc2SatUnit = 1e8

// Sat2Btc converts a big.Rat amount of Sat in an equivalent amount of BTC.
func Sat2Btc(amount *big.Rat) *big.Rat {
	return new(big.Rat).Quo(amount, big.NewRat(btc2SatUnit, 1))
}

// Btc2Sat converts a big.Rat amount of BTC in an equivalent amount of Sat.
func Btc2Sat(amount *big.Rat) *big.Rat {
	return new(big.Rat).Mul(amount, big.NewRat(btc2SatUnit, 1))
}

// FormatAsPlainCurrency handles formatting for currencies in a simplified way.
// This should be used when `FormatAsCurrency` can't be used because a simpler formatting is needed (e.g. to populate forms in the frontend).
func FormatAsPlainCurrency(amount *big.Rat, currency string) string {
	var formatted string
	switch currency {
	case ratesPkg.BTC.String():
		formatted = amount.FloatString(8)
	case ratesPkg.SAT.String():
		formatted = amount.FloatString(0)
	default:
		formatted = amount.FloatString(2)
	}
	return formatted
}

// FormatAsCurrency handles formatting for currencies.
func FormatAsCurrency(amount *big.Rat, currency string) string {
	formatted := FormatAsPlainCurrency(amount, currency)
	position := strings.Index(formatted, ".") - 3
	for position > 0 {
		formatted = formatted[:position] + "'" + formatted[position:]
		position -= 3
	}
	return formatted
}

// Conversions handles fiat conversions.
func Conversions(amount Amount, coin Coin, isFee bool, ratesUpdater *ratesPkg.RateUpdater) map[string]string {
	conversions := map[string]string{}
	rates := ratesUpdater.LatestPrice()
	if rates != nil {
		unit := coin.Unit(isFee)

		conversions = map[string]string{}
		for key, value := range rates[unit] {
			convertedAmount := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
			conversions[key] = FormatAsCurrency(convertedAmount, key)
		}
	}
	return conversions
}

// ConversionsAtTime handles fiat conversions at a specific time.
// It returns the map of conversions and a bool indicating if the rates have been estimated
// using the latest instead of the historical rates for recent transactions.
func ConversionsAtTime(amount Amount, coin Coin, isFee bool, ratesUpdater *ratesPkg.RateUpdater, timeStamp *time.Time) (map[string]string, bool) {
	latestRatesTime := ratesUpdater.HistoryLatestTimestampCoin(string(coin.Code()))
	historicalRatesNotAvailable := latestRatesTime.IsZero() || latestRatesTime.Before(*timeStamp)
	if historicalRatesNotAvailable && time.Since(*timeStamp) < 2*time.Hour {
		return Conversions(amount, coin, isFee, ratesUpdater), true
	}

	conversions := map[string]string{}
	lastRates := ratesUpdater.LatestPrice()
	if lastRates != nil {
		unit := coin.Unit(isFee)
		for currency := range lastRates[unit] {
			value := ratesUpdater.HistoricalPriceAt(string(coin.Code()), currency, *timeStamp)
			if value == 0 {
				conversions[currency] = ""
			} else {
				convertedAmount := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
				conversions[currency] = FormatAsCurrency(convertedAmount, currency)
			}
		}
	}
	return conversions, false
}
