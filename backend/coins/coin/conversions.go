package coin

import (
	"strconv"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
)

func formatAsCurrency(amount float64) string {
	formatted := strconv.FormatFloat(amount, 'f', 2, 64)
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
		float := coin.ToUnit(amount, isFee)
		conversions = map[string]string{}
		for key, value := range rates[unit] {
			conversions[key] = formatAsCurrency(float * value)
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
		float := coin.ToUnit(amount, isFee)
		conversions = map[string]string{}
		for fiat := range rates[unit] {
			value := ratesUpdater.HistoricalPriceAt(string(coin.Code()), fiat, *timeStamp)
			if value == 0 {
				conversions[fiat] = ""
			} else {
				conversions[fiat] = formatAsCurrency(float * value)
			}
		}
	}
	return conversions
}
