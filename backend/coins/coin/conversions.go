package coin

import (
	"math/big"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
)

// Btc2Sat is the sat equivalent of 1 BTC.
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
func FormatAsPlainCurrency(amount *big.Rat, fiatUnit string, formatBtcAsSats bool) string {
	var formatted string
	if fiatUnit == rates.BTC.String() {
		if formatBtcAsSats {
			amount = Btc2Sat(amount)
			formatted = amount.FloatString(0)
		} else {
			formatted = amount.FloatString(8)
		}
	} else {
		formatted = amount.FloatString(2)
	}
	return formatted
}

// FormatAsCurrency handles formatting for currencies.
func FormatAsCurrency(amount *big.Rat, fiatUnit string, formatBtcAsSats bool) string {
	formatted := FormatAsPlainCurrency(amount, fiatUnit, formatBtcAsSats)
	position := strings.Index(formatted, ".") - 3
	for position > 0 {
		formatted = formatted[:position] + "'" + formatted[position:]
		position -= 3
	}
	return formatted
}

// Conversions handles fiat conversions.
func Conversions(amount Amount, coin Coin, isFee bool, ratesUpdater *rates.RateUpdater, formatBtcAsSats bool) map[string]string {
	conversions := map[string]string{}
	rates := ratesUpdater.LatestPrice()
	if rates != nil {
		unit := coin.Unit(isFee)

		conversions = map[string]string{}
		for key, value := range rates[unit] {
			conversion := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
			conversions[key] = FormatAsCurrency(conversion, key, formatBtcAsSats)
		}
	}
	return conversions
}

// ConversionsAtTime handles fiat conversions at a specific time.
func ConversionsAtTime(amount Amount, coin Coin, isFee bool, ratesUpdater *rates.RateUpdater, formatBtcAsSats bool, timeStamp *time.Time) map[string]string {
	conversions := map[string]string{}
	lastRates := ratesUpdater.LatestPrice()
	if lastRates != nil {
		unit := coin.Unit(isFee)
		for fiat := range lastRates[unit] {
			value := ratesUpdater.HistoricalPriceAt(string(coin.Code()), fiat, *timeStamp)
			if value == 0 {
				conversions[fiat] = ""
			} else {
				conversion := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
				conversions[fiat] = FormatAsCurrency(conversion, fiat, formatBtcAsSats)
			}
		}
	}
	return conversions
}
