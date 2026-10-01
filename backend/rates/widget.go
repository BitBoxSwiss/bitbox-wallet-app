// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// WidgetData is a market quote and its preceding 24 hours of prices.
type WidgetData struct {
	CoinCode    string    `json:"coinCode"`
	Currency    string    `json:"currency"`
	Price       float64   `json:"price"`
	Change24h   float64   `json:"change24h"`
	ChartPrices []float64 `json:"chartPrices"`
}

// WidgetCoinCode maps supported mainnet and testnet accounts to market symbols.
func WidgetCoinCode(code string) string {
	switch strings.ToLower(code) {
	case "btc", "tbtc", "rbtc":
		return "btc"
	case "eth", "sepeth":
		return "eth"
	case "ltc", "tltc":
		return "ltc"
	default:
		return ""
	}
}

// WidgetCurrency selects a supported fiat quote currency, defaulting to USD.
func WidgetCurrency(currency string) string {
	currency = strings.ToUpper(currency)
	if currency == "BTC" || toGeckoFiat[currency] == "" {
		return "USD"
	}
	return currency
}

// FetchWidgetData fetches a chart and a fresh quote without starting a rates updater.
func FetchWidgetData(ctx context.Context, client *http.Client, coinCode, currency string) (WidgetData, error) {
	return fetchWidgetData(ctx, client, shiftGeckoMirrorAPIV3, coinCode, currency, time.Now())
}

func fetchWidgetData(ctx context.Context, client *http.Client, baseURL, coinCode, currency string, now time.Time) (WidgetData, error) {
	coinCode = WidgetCoinCode(coinCode)
	if coinCode == "" {
		return WidgetData{}, errp.New("unsupported widget coin")
	}
	currency = WidgetCurrency(currency)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	current := make(chan *float64, 1)
	go func() {
		ctx, cancel := context.WithTimeout(ctx, time.Second)
		defer cancel()
		query := url.Values{"ids": {geckoCoin[coinCode]}, "vs_currencies": {toGeckoFiat[currency]}}
		var result map[string]map[string]float64
		if err := widgetJSON(ctx, client, baseURL+"/simple/price?"+query.Encode(), &result); err == nil {
			if price, ok := result[geckoCoin[coinCode]][toGeckoFiat[currency]]; ok && validWidgetPrice(price) {
				current <- &price
				return
			}
		}
		current <- nil
	}()

	query := url.Values{
		"vs_currency": {toGeckoFiat[currency]},
		"from":        {strconv.FormatInt(now.Add(-24*time.Hour).Unix(), 10)},
		"to":          {strconv.FormatInt(now.Unix(), 10)},
	}
	var chart struct {
		Prices [][]float64 `json:"prices"`
	}
	if err := widgetJSON(ctx, client, baseURL+"/coins/"+geckoCoin[coinCode]+"/market_chart/range?"+query.Encode(), &chart); err != nil {
		return WidgetData{}, err
	}
	var prices []float64
	for _, point := range chart.Prices {
		if len(point) >= 2 && validWidgetPrice(point[1]) {
			prices = append(prices, point[1])
		}
	}
	if len(prices) < 2 {
		return WidgetData{}, errp.New("widget chart contains insufficient prices")
	}
	select {
	case price := <-current:
		if price != nil {
			prices = append(prices, *price)
		}
	case <-ctx.Done():
		// The chart remains usable if the current-price request times out.
	}
	price := prices[len(prices)-1]
	change := (price - prices[0]) / prices[0] * 100
	if math.IsInf(change, 0) || math.IsNaN(change) {
		return WidgetData{}, errp.New("invalid widget price change")
	}
	return WidgetData{CoinCode: coinCode, Currency: currency, Price: price, Change24h: change, ChartPrices: prices}, nil
}

func validWidgetPrice(price float64) bool {
	return price > 0 && !math.IsNaN(price) && !math.IsInf(price, 0)
}

func widgetJSON(ctx context.Context, client *http.Client, endpoint string, result interface{}) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return errp.Newf("widget price request returned HTTP %d", response.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(result)
}
