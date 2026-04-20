package swapkit

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

var swapkitAssetByCoinCode = map[string]string{
	"btc":    "BTC.BTC",
	"tbtc":   "BTC.BTC",
	"rbtc":   "BTC.BTC",
	"ltc":    "LTC.LTC",
	"eth":    "ETH.ETH",
	"sepeth": "ETH.ETH",

	"eth-erc20-usdt":      "ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7",
	"eth-erc20-usdc":      "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
	"eth-erc20-link":      "ETH.LINK-0x514910771af9ca656af840dff83e8264ecf986ca",
	"eth-erc20-bat":       "ETH.BAT-0x0d8775f648430679a709e98d2b0cb6250d2887ef",
	"eth-erc20-mkr":       "ETH.MKR-0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
	"eth-erc20-zrx":       "ETH.ZRX-0xe41d2489571d322189246dafa5ebde1f4699f498",
	"eth-erc20-wbtc":      "ETH.WBTC-0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
	"eth-erc20-paxg":      "ETH.PAXG-0x45804880De22913dAFE09f4980848ECE6EcbAf78",
	"eth-erc20-dai0x6b17": "ETH.DAI-0x6b175474e89094c44da98b954eedeac495271d0f",
}

// ErrInvalidRequest is returned when the quote request is invalid, for example due to missing or invalid fields.
const ErrInvalidRequest errp.ErrorCode = "invalidRequest"

// assetFromCoinCode translates an internal coin code into a SwapKit asset string.
func assetFromCoinCode(coinCode string) (string, bool) {
	asset, ok := swapkitAssetByCoinCode[strings.ToLower(strings.TrimSpace(coinCode))]
	return asset, ok
}

// FormatAmount converts a user-entered amount from the coin's display unit into the decimal string
// expected by SwapKit.
func FormatAmount(coin coinpkg.Coin, amount string) (string, error) {
	parsedAmount, err := coin.ParseAmount(amount)
	if err != nil {
		return "", err
	}
	decimals := int(coin.Decimals(false))
	rat := coinpkg.ToUnitRat(parsedAmount, coin, false)
	formattedAmount := rat.FloatString(decimals)
	formattedAmount = strings.TrimRight(strings.TrimRight(formattedAmount, "0"), ".")
	if formattedAmount == "" {
		return "0", nil
	}
	return formattedAmount, nil
}

func newQuoteRequestFromCoinCodes(sellCoinCode, buyCoinCode, sellAmount string, providers []string) (*QuoteRequest, *APIError) {
	if strings.TrimSpace(sellCoinCode) == "" {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing sellCoinCode.",
		}
	}
	if strings.TrimSpace(buyCoinCode) == "" {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing buyCoinCode.",
		}
	}
	sellAsset, ok := assetFromCoinCode(sellCoinCode)
	if !ok {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Unsupported sell asset.",
		}
	}
	buyAsset, ok := assetFromCoinCode(buyCoinCode)
	if !ok {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Unsupported buy asset.",
		}
	}
	return &QuoteRequest{
		SellAsset:  sellAsset,
		BuyAsset:   buyAsset,
		SellAmount: sellAmount,
		Providers:  providers,
	}, nil
}

func newSwapRequestFromCoinCodes(
	sellCoinCode, buyCoinCode, sellAmount, routeID, sourceAddress, destinationAddress string,
) (*SwapRequest, *APIError) {
	if strings.TrimSpace(routeID) == "" {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing routeId.",
		}
	}
	if strings.TrimSpace(sourceAddress) == "" {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing sourceAddress.",
		}
	}
	if strings.TrimSpace(destinationAddress) == "" {
		return nil, &APIError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing destinationAddress.",
		}
	}
	_, apiError := newQuoteRequestFromCoinCodes(
		sellCoinCode,
		buyCoinCode,
		sellAmount,
		[]string{"NEAR"},
	)
	if apiError != nil {
		return nil, apiError
	}
	return &SwapRequest{
		RouteID:             routeID,
		SourceAddress:       sourceAddress,
		DestinationAddress:  destinationAddress,
		DisableBalanceCheck: true,
		DisableEstimate:     true,
		DisableBuildTx:      true,
	}, nil
}

// NewQuoteFromCoinCode validates the provided coin codes, fetches a quote, and maps structured API errors.
func NewQuoteFromCoinCode(ctx context.Context, httpClient *http.Client, sellCoinCode, buyCoinCode, sellAmount string) (*QuoteResponse, *APIError) {
	quoteRequest, apiError := newQuoteRequestFromCoinCodes(
		sellCoinCode,
		buyCoinCode,
		sellAmount,
		[]string{"NEAR"},
	)
	if apiError != nil {
		return nil, apiError
	}

	quoteResponse, err := NewClient(httpClient).Quote(ctx, quoteRequest)
	if err != nil {
		if apiError, ok := apiErrorFromError(err); ok {
			return nil, apiError
		}
		return nil, &APIError{
			ErrorCode: errp.ErrorCode("unexpectedError"),
			Message:   err.Error(),
		}
	}
	return quoteResponse, nil
}

// NewSwap validates the provided coin codes, creates a swap, and maps structured API errors.
func NewSwap(
	ctx context.Context,
	httpClient *http.Client,
	sellCoinCode,
	buyCoinCode,
	sellAmount,
	routeID,
	sourceAddress,
	destinationAddress string,
) (*SwapResponse, *APIError) {
	swapRequest, apiError := newSwapRequestFromCoinCodes(
		sellCoinCode,
		buyCoinCode,
		sellAmount,
		routeID,
		sourceAddress,
		destinationAddress,
	)
	if apiError != nil {
		return nil, apiError
	}
	swapResponse, err := NewClient(httpClient).Swap(ctx, swapRequest)
	if err != nil {
		if apiError, ok := apiErrorFromError(err); ok {
			return nil, apiError
		}
		return nil, &APIError{
			ErrorCode: errp.ErrorCode("unexpectedError"),
			Message:   err.Error(),
		}
	}
	return swapResponse, nil
}

// apiErrorFromError extracts a structured SwapKit API error from a client error.
func apiErrorFromError(err error) (*APIError, bool) {
	raw := err.Error()
	jsonStart := strings.Index(raw, "{")
	if jsonStart == -1 {
		return nil, false
	}
	var payload struct {
		Provider  string         `json:"provider"`
		ErrorCode errp.ErrorCode `json:"error"` // While the docs mention a field named "errorCode", the actual error response uses "error".
		Message   string         `json:"message"`
	}
	if unmarshalErr := json.Unmarshal([]byte(raw[jsonStart:]), &payload); unmarshalErr != nil {
		return nil, false
	}
	if payload.ErrorCode == "" || payload.Message == "" {
		return nil, false
	}
	return &APIError{
		Provider:  payload.Provider,
		ErrorCode: payload.ErrorCode,
		Message:   payload.Message,
	}, true
}
