package swapkit

import (
	"encoding/json"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// QuoteRequest represents a request to the /quote endpoint of the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote
type QuoteRequest struct {
	SellAsset        string   `json:"sellAsset"`
	BuyAsset         string   `json:"buyAsset"`
	SellAmount       string   `json:"sellAmount"`
	Providers        []string `json:"providers,omitempty"`
	Slippage         *string  `json:"slippage,omitempty"`
	AffiliateFee     *int     `json:"affiliateFee,omitempty"`
	CfBoost          *bool    `json:"cfBoost,omitempty"`
	MaxExecutionTime *int     `json:"maxExecutionTime,omitempty"`
}

// SwapRequest represents a request to the /swap endpoint of the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type SwapRequest struct {
	RouteID             string   `json:"routeId"`
	SellAsset           string   `json:"sellAsset,omitempty"`
	BuyAsset            string   `json:"buyAsset,omitempty"`
	SellAmount          string   `json:"sellAmount,omitempty"`
	Providers           []string `json:"providers,omitempty"`
	SourceAddress       string   `json:"sourceAddress"`
	DestinationAddress  string   `json:"destinationAddress"`
	DisableBalanceCheck bool     `json:"disableBalanceCheck"`
	DisableEstimate     bool     `json:"disableEstimate"`
	DisableBuildTx      bool     `json:"disableBuildTx"`
}

// QuoteResponse represents a response from the /quote endpoint of the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote
type QuoteResponse struct {
	QuoteID        string       `json:"quoteId"`
	Routes         []QuoteRoute `json:"routes"`
	ProviderErrors []APIError   `json:"providerErrors,omitempty"`
	Error          string       `json:"error,omitempty"`
}

// QuoteRoute represents a single route for a quote returned by the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote
type QuoteRoute struct {
	RouteID                      string   `json:"routeId"`
	Providers                    []string `json:"providers"`
	SellAsset                    string   `json:"sellAsset"`
	BuyAsset                     string   `json:"buyAsset"`
	SellAmount                   string   `json:"sellAmount"`
	ExpectedBuyAmount            string   `json:"expectedBuyAmount"`
	ExpectedBuyAmountMaxSlippage string   `json:"expectedBuyAmountMaxSlippage"`

	// tx object varies by chain:
	// - EVM     → Ethers v6 transaction
	// - UTXO    → base64 PSBT
	Tx json.RawMessage `json:"tx"`

	ApprovalTx json.RawMessage `json:"approvalTx,omitempty"`

	TargetAddress    string          `json:"targetAddress"`
	Memo             string          `json:"memo,omitempty"`
	Fees             []Fee           `json:"fees"`
	EstimatedTime    json.RawMessage `json:"estimatedTime,omitempty"`
	TotalSlippageBps float64         `json:"totalSlippageBps"`
	Legs             json.RawMessage `json:"legs,omitempty"`
	Warnings         json.RawMessage `json:"warnings,omitempty"`
	Meta             json.RawMessage `json:"meta,omitempty"`

	NextActions []NextAction `json:"nextActions,omitempty"`
}

// Fee represents a fee associated with a quote route returned by the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote and
// https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type Fee struct {
	Type     string `json:"type"`
	Amount   string `json:"amount"`
	Asset    string `json:"asset"`
	Chain    string `json:"chain"`
	Protocol string `json:"protocol"`
}

// NextAction represents an action that the user must take to complete a quote or swap flow returned
// by the SwapKit API. See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote and
// https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type NextAction struct {
	Method  string          `json:"method"`
	URL     string          `json:"url"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// APIError represents a structured error returned by the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-quote-request-a-swap-quote and
// https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type APIError struct {
	Provider  string         `json:"provider"`
	ErrorCode errp.ErrorCode `json:"errorCode"`
	Message   string         `json:"message"`
	Data      *APIErrorData  `json:"data,omitempty"`
}

// APIErrorData contains structured values the frontend can translate into an error message.
type APIErrorData struct {
	SellCoin string `json:"sellCoin,omitempty"`
	BuyCoin  string `json:"buyCoin,omitempty"`
}

// SwapMeta models the subset of SwapKit metadata currently needed by the app.
// See https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type SwapMeta struct {
	Slip24 *paymentrequest.Slip24 `json:"slip24,omitempty"`
}

// SwapResponse represents a response from the /swap endpoint of the SwapKit API.
// See https://docs.swapkit.dev/swapkit-api/v3-swap-obtain-swap-transaction-details
type SwapResponse struct {
	SellAsset         string          `json:"sellAsset"`
	SellAmount        string          `json:"sellAmount"`
	BuyAsset          string          `json:"buyAsset"`
	ExpectedBuyAmount string          `json:"expectedBuyAmount"`
	RouteID           string          `json:"routeId"`
	Providers         []string        `json:"providers"`
	TargetAddress     string          `json:"targetAddress"`
	Memo              string          `json:"memo,omitempty"`
	Fees              []Fee           `json:"fees"`
	EstimatedTime     json.RawMessage `json:"estimatedTime,omitempty"`
	SourceAddress     string          `json:"sourceAddress"`
	DestinationAddr   string          `json:"destinationAddress"`
	InboundAddress    string          `json:"inboundAddress"`
	Meta              SwapMeta        `json:"meta,omitempty"`
	SwapID            string          `json:"swapId"`
	Error             string          `json:"error,omitempty"`
}

// PaymentRequest returns the signed payment request from the documented SwapKit response shape.
func (response *SwapResponse) PaymentRequest() *paymentrequest.Slip24 {
	if response == nil {
		return nil
	}
	return response.Meta.Slip24
}
