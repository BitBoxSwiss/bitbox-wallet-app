package swapkit

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

var swapkitAssetByCoinCode = map[string]string{
	"btc":    "BTC.BTC",
	"tbtc":   "BTC.BTC",
	"rbtc":   "BTC.BTC",
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

func newQuoteRequestFromCoinCodes(sellCoinCode, buyCoinCode, sellAmount string, providers []string) (*QuoteRequest, *QuoteError) {
	if strings.TrimSpace(sellCoinCode) == "" {
		return nil, &QuoteError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing sellCoinCode.",
		}
	}
	if strings.TrimSpace(buyCoinCode) == "" {
		return nil, &QuoteError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Missing buyCoinCode.",
		}
	}
	sellAsset, ok := assetFromCoinCode(sellCoinCode)
	if !ok {
		return nil, &QuoteError{
			ErrorCode: ErrInvalidRequest,
			Message:   "Unsupported sell asset.",
		}
	}
	buyAsset, ok := assetFromCoinCode(buyCoinCode)
	if !ok {
		return nil, &QuoteError{
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

// NewQuoteFromCoinCode validates the provided coin codes, fetches a quote, and maps structured API errors.
func NewQuoteFromCoinCode(ctx context.Context, sellCoinCode, buyCoinCode, sellAmount string) (*QuoteResponse, *QuoteError) {
	quoteRequest, quoteError := newQuoteRequestFromCoinCodes(
		sellCoinCode,
		buyCoinCode,
		sellAmount,
		[]string{"NEAR"},
	)
	if quoteError != nil {
		return nil, quoteError
	}

	quoteResponse, err := NewClient().Quote(ctx, quoteRequest)
	if err != nil {
		if quoteError, ok := quoteErrorFromError(err); ok {
			return nil, quoteError
		}
		return nil, &QuoteError{
			ErrorCode: errp.ErrorCode("unexpectedError"),
			Message:   err.Error(),
		}
	}
	return quoteResponse, nil
}

// quoteErrorFromError extracts a structured quote error from a SwapKit client error.
// It parses the json payload from the error message and returns a QuoteError if successful.
// These are the valid errors returned:
// https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote#quote-error-schema
func quoteErrorFromError(err error) (*QuoteError, bool) {
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
	return &QuoteError{
		Provider:  payload.Provider,
		ErrorCode: payload.ErrorCode,
		Message:   payload.Message,
	}, true
}
