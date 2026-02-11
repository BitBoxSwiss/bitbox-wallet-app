package swapkit

import "encoding/json"

// QuoteRequest represents a request to swapkit for a swap quote.
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

// SwapRequest represents a request to swakip to execute a swap.
type SwapRequest struct {
	RouteID                    string `json:"routeId"`
	SourceAddress              string `json:"sourceAddress"`
	DestinationAddress         string `json:"destinationAddress"`
	DisableBalanceCheck        *bool  `json:"disableBalanceCheck,omitempty"`
	DisableEstimate            *bool  `json:"disableEstimate,omitempty"`
	AllowSmartContractSender   *bool  `json:"allowSmartContractSender,omitempty"`
	AllowSmartContractReceiver *bool  `json:"allowSmartContractReceiver,omitempty"`
	DisableSecurityChecks      *bool  `json:"disableSecurityChecks,omitempty"`
	OverrideSlippage           *bool  `json:"overrideSlippage,omitempty"`
}

// QuoteResponse contains info about swaps' quotes.
type QuoteResponse struct {
	QuoteID        string          `json:"quoteId"`
	Routes         []QuoteRoute    `json:"routes"`
	ProviderErrors []ProviderError `json:"providerErrors,omitempty"`
	Error          string          `json:"error,omitempty"`
}

// SwapResponse is the answer provided by swapkit when asking to execute a swap.
type SwapResponse struct {
	RouteID                      string          `json:"routeId"`
	Providers                    []string        `json:"providers"`
	SellAsset                    string          `json:"sellAsset"`
	BuyAsset                     string          `json:"buyAsset"`
	SellAmount                   string          `json:"sellAmount"`
	ExpectedBuyAmount            string          `json:"expectedBuyAmount"`
	ExpectedBuyAmountMaxSlippage string          `json:"expectedBuyAmountMaxSlippage"`
	Tx                           json.RawMessage `json:"tx"`
	ApprovalTx                   json.RawMessage `json:"approvalTx,omitempty"`
	TargetAddress                string          `json:"targetAddress"`
	Memo                         string          `json:"memo,omitempty"`
	Fees                         []Fee           `json:"fees"`
	EstimatedTime                json.RawMessage `json:"estimatedTime,omitempty"`
	TotalSlippageBps             int             `json:"totalSlippageBps"`
	Legs                         json.RawMessage `json:"legs,omitempty"`
	Warnings                     json.RawMessage `json:"warnings,omitempty"`
	Meta                         json.RawMessage `json:"meta,omitempty"`
	NextActions                  []NextAction    `json:"nextActions,omitempty"`
}

// QuoteRoute represent a single route to swap coins from
// SellAsset to BuyAsset.
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

// Fee represents one of the possible fees for executing a swap.
type Fee struct {
	Type     string `json:"type"`
	Amount   string `json:"amount"`
	Asset    string `json:"asset"`
	Chain    string `json:"chain"`
	Protocol string `json:"protocol"`
}

// NextAction is provided by swap as a convenience field to suggest what
// the next step in a swap workflow could be.
type NextAction struct {
	Method  string          `json:"method"`
	URL     string          `json:"url"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ProviderError contains errors specific to a Provider
// (e.g. some provided will only provide quotes for sell amounts
// higher than a certain treshold).
type ProviderError struct {
	Provider  string `json:"provider"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

// TrackRequest is used to query swapkit fo track the status of a swap.
type TrackRequest struct {
	Hash    string `json:"hash"`
	ChainID string `json:"chainId"`
}

// TrackResponse represents SwapKit's response for a tracked transaction
type TrackResponse struct {
	ChainID        string          `json:"chainId"`
	Hash           string          `json:"hash"`
	Block          int64           `json:"block"`
	Type           string          `json:"type"`           // swap, token_transfer, etc.
	Status         string          `json:"status"`         // not_started, pending, swapping, completed, refunded, failed, unknown
	TrackingStatus string          `json:"trackingStatus"` // deprecated, status is enough
	FromAsset      string          `json:"fromAsset"`
	FromAmount     string          `json:"fromAmount"`
	FromAddress    string          `json:"fromAddress"`
	ToAsset        string          `json:"toAsset"`
	ToAmount       string          `json:"toAmount"`
	ToAddress      string          `json:"toAddress"`
	FinalisedAt    int64           `json:"finalisedAt"`       // UNIX timestamp
	Meta           json.RawMessage `json:"meta,omitempty"`    // provider, images, etc.
	Payload        json.RawMessage `json:"payload,omitempty"` // transaction-specific info
	Legs           []TrackLeg      `json:"legs,omitempty"`    // individual steps in transaction
}

// TrackLeg represents a step of the transaction
type TrackLeg struct {
	ChainID        string          `json:"chainId"`
	Hash           string          `json:"hash"`
	Block          int64           `json:"block"`
	Type           string          `json:"type"`
	Status         string          `json:"status"`
	TrackingStatus string          `json:"trackingStatus"`
	FromAsset      string          `json:"fromAsset"`
	FromAmount     string          `json:"fromAmount"`
	FromAddress    string          `json:"fromAddress"`
	ToAsset        string          `json:"toAsset"`
	ToAmount       string          `json:"toAmount"`
	ToAddress      string          `json:"toAddress"`
	FinalisedAt    int64           `json:"finalisedAt"`
	Meta           json.RawMessage `json:"meta,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}
