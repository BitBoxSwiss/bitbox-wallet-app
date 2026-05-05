package swapkit

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

var swapkitAssetByCoinCode = map[string]string{
	"btc":                 "BTC.BTC",
	"tbtc":                "BTC.BTC",
	"rbtc":                "BTC.BTC",
	"ltc":                 "LTC.LTC",
	"eth":                 "ETH.ETH",
	"sepeth":              "ETH.ETH",
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

var swapkitChainIDByCoinCode = map[string]string{
	"btc":    "bitcoin",
	"tbtc":   "bitcoin",
	"rbtc":   "bitcoin",
	"ltc":    "litecoin",
	"tltc":   "litecoin",
	"eth":    "1",
	"sepeth": "1",
}

const (
	// ErrInvalidRequest is returned when the quote request is invalid, for example due to missing or invalid fields.
	ErrInvalidRequest errp.ErrorCode = "invalidRequest"
	// ErrNoRoutesFound is returned when SwapKit cannot route the selected pair.
	ErrNoRoutesFound errp.ErrorCode = "NoRoutesFoundError"
	// ErrProvidersUnavailable is returned when SwapKit supports a requested pair, but no route is available while all relevant providers are unavailable.
	ErrProvidersUnavailable errp.ErrorCode = "ProvidersUnavailableError"
)

const (
	noRoutesFoundMessage        = "No routes found"
	providersUnavailableMessage = "Providers unavailable"
)

// assetFromCoinCode translates an internal coin code into a SwapKit asset identifier.
func assetFromCoinCode(coinCode string) (string, bool) {
	asset, ok := swapkitAssetByCoinCode[strings.ToLower(strings.TrimSpace(coinCode))]
	return asset, ok
}

func chainIDFromCoinCode(coinCode string) (string, bool) {
	normalizedCoinCode := strings.ToLower(strings.TrimSpace(coinCode))
	if strings.HasPrefix(normalizedCoinCode, "eth-erc20-") {
		return "1", true
	}
	chainID, ok := swapkitChainIDByCoinCode[normalizedCoinCode]
	return chainID, ok
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

// ValidateSwapSellAmount checks that sell amount fits into available balance.
func ValidateSwapSellAmount(account accounts.Interface, sellAmount coinpkg.Amount) error {
	balance, err := account.Balance()
	if err != nil {
		return err
	}
	if sellAmount.BigInt().Cmp(balance.Available().BigInt()) > 0 {
		return errp.WithStack(accountErrors.ErrInsufficientFunds)
	}
	return nil
}

func newQuoteRequestFromCoinCodes(sellCoinCode, buyCoinCode, sellAmount string) (*QuoteRequest, *APIError) {
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

func noRoutesQuoteError(ctx context.Context, client *Client, sellCoin, buyCoin coinpkg.Coin, data *APIErrorData) *APIError {
	providers, err := client.Providers(ctx)
	if err == nil && allRelevantProvidersUnavailable(providers, quoteChainIDs(sellCoin, buyCoin)) {
		return &APIError{
			ErrorCode: ErrProvidersUnavailable,
			Message:   providersUnavailableMessage,
			Data:      data,
		}
	}
	return &APIError{
		ErrorCode: ErrNoRoutesFound,
		Message:   noRoutesFoundMessage,
		Data:      data,
	}
}

func quoteChainIDs(sellCoin, buyCoin coinpkg.Coin) []string {
	seenChainIDs := map[string]bool{}
	var chainIDs []string
	for _, coin := range []coinpkg.Coin{sellCoin, buyCoin} {
		chainID, ok := chainIDFromCoinCode(string(coin.Code()))
		if !ok || seenChainIDs[chainID] {
			continue
		}
		seenChainIDs[chainID] = true
		chainIDs = append(chainIDs, chainID)
	}
	return chainIDs
}

func allRelevantProvidersUnavailable(providers []Provider, chainIDs []string) bool {
	if len(chainIDs) == 0 {
		return false
	}
	relevantProviders := 0
	for _, provider := range providers {
		if !slices.Contains(provider.SupportedActions, "swap") {
			continue
		}
		supportsPair := true
		for _, chainID := range chainIDs {
			if !slices.Contains(provider.SupportedChainIDs, chainID) {
				supportsPair = false
				break
			}
		}
		if !supportsPair {
			continue
		}
		relevantProviders++
		enabledForPair := true
		for _, chainID := range chainIDs {
			if !slices.Contains(provider.EnabledChainIDs, chainID) {
				enabledForPair = false
				break
			}
		}
		if enabledForPair {
			return false
		}
	}
	return relevantProviders > 0
}

// NewQuoteFromCoinCode validates the provided coins, fetches a quote, and maps structured API errors.
func NewQuoteFromCoinCode(ctx context.Context, httpClient *http.Client, sellCoin, buyCoin coinpkg.Coin, sellAmount string) (*QuoteResponse, *APIError) {
	quoteErrorData := &APIErrorData{
		SellCoin: sellCoin.Unit(false),
		BuyCoin:  buyCoin.Unit(false),
	}
	quoteRequest, apiError := newQuoteRequestFromCoinCodes(
		string(sellCoin.Code()),
		string(buyCoin.Code()),
		sellAmount,
	)
	if apiError != nil {
		return nil, apiError
	}

	client := NewClient(httpClient)
	quoteResponse, err := client.Quote(ctx, quoteRequest)
	if err != nil {
		if apiError, ok := apiErrorFromError(err); ok {
			if strings.Contains(apiError.Message, noRoutesFoundMessage) {
				return nil, noRoutesQuoteError(ctx, client, sellCoin, buyCoin, quoteErrorData)
			}
			return nil, apiError
		}
		return nil, &APIError{
			ErrorCode: errp.ErrorCode("unexpectedError"),
			Message:   err.Error(),
		}
	}
	if len(quoteResponse.Routes) == 0 {
		return nil, noRoutesQuoteError(ctx, client, sellCoin, buyCoin, quoteErrorData)
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
