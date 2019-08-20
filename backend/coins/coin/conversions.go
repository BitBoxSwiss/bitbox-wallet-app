package coin

import (
	"strconv"
	"strings"

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

// Conversions handles fiat conversions
func Conversions(amount Amount, coin Coin, isFee bool, ratesUpdater *rates.RateUpdater) map[string]string {
	var conversions map[string]string
	rates := ratesUpdater.Last()
	if rates != nil {
		unit := coin.Unit(isFee)
		if len(unit) == 4 && strings.HasPrefix(unit, "T") || unit == "RETH" {
			unit = unit[1:]
		}
		float := coin.ToUnit(amount, isFee)
		conversions = map[string]string{}
		for key, value := range rates[unit] {
			conversions[key] = formatAsCurrency(float * value)
		}
	}
	return conversions
}
