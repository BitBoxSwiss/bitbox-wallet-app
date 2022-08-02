package coin

import (
	"math/big"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
)

// FormatAsCurrency handles formatting for currencies.
func FormatAsCurrency(amount *big.Rat, coinUnit string) string {
	var formatted string
	if coinUnit == "BTC" {
		formatted = strings.TrimRight(strings.TrimRight(amount.FloatString(8), "0"), ".")
	} else {
		formatted = amount.FloatString(2)
	}
	position := strings.Index(formatted, ".") - 3
	for position > 0 {
		formatted = formatted[:position] + "'" + formatted[position:]
		position -= 3
	}
	return formatted
}

// Conversions handles fiat conversions.
func Conversions(amount Amount, coin Coin, isFee bool, ratesUpdater *rates.RateUpdater) map[string]string {
	var conversions map[string]string
	rates := ratesUpdater.LatestPrice()
	if rates != nil {
		unit := coin.Unit(isFee)
		conversions = map[string]string{}
		for key, value := range rates[unit] {
			conversion := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
			conversions[key] = FormatAsCurrency(conversion, key)
		}
	}
	return conversions
}

// ConversionsAtTime handles fiat conversions at a specific time.
func ConversionsAtTime(amount Amount, coin Coin, isFee bool, ratesUpdater *rates.RateUpdater, timeStamp *time.Time) map[string]string {
	var conversions map[string]string
	rates := ratesUpdater.LatestPrice()
	if rates != nil {
		unit := coin.Unit(isFee)
		conversions = map[string]string{}
		for fiat := range rates[unit] {
			value := ratesUpdater.HistoricalPriceAt(string(coin.Code()), fiat, *timeStamp)
			if value == 0 {
				conversions[fiat] = ""
			} else {
				conversion := new(big.Rat).Mul(new(big.Rat).SetFloat64(coin.ToUnit(amount, isFee)), new(big.Rat).SetFloat64(value))
				conversions[fiat] = FormatAsCurrency(conversion, fiat)
			}
		}
	}
	return conversions
}
