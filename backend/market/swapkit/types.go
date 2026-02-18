package swapkit

import "encoding/json"

// QuoteRequest represents a request to the /quote endpoint of the SwapKit API.
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

// QuoteResponse represents a response from the /quote endpoint of the SwapKit API.
type QuoteResponse struct {
	QuoteID        string       `json:"quoteId"`
	Routes         []QuoteRoute `json:"routes"`
	ProviderErrors []QuoteError `json:"providerErrors,omitempty"`
	Error          string       `json:"error,omitempty"`
}

// QuoteRoute represents a single route for a quote returned by the SwapKit API.
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
type Fee struct {
	Type     string `json:"type"`
	Amount   string `json:"amount"`
	Asset    string `json:"asset"`
	Chain    string `json:"chain"`
	Protocol string `json:"protocol"`
}

// NextAction represents an action that the user must take to complete a quote route returned by the SwapKit API.
type NextAction struct {
	Method  string          `json:"method"`
	URL     string          `json:"url"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// QuoteError represents an error from a provider when fetching a quote from the SwapKit API.
type QuoteError struct {
	Provider  string `json:"provider"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}
