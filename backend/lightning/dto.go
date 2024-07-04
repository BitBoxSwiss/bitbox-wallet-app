package lightning

type aesSuccessActionResultDto struct {
	Type   string      `json:"type"`
	Result interface{} `json:"result"`
}

type aesSuccessActionResultErrorDto struct {
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

type aesSuccessActionDataDecryptedDto struct {
	Description string `json:"description"`
	Plaintext   string `json:"plaintext"`
}

type bitcoinAddressDataDto struct {
	Address   string  `json:"address"`
	Network   string  `json:"network"`
	AmountSat *uint64 `json:"amountSat"`
	Label     *string `json:"label"`
	Message   *string `json:"message"`
}

type closedChannelPaymentDetailsDto struct {
	State          string  `json:"state"`
	FundingTxid    string  `json:"fundingTxid"`
	ShortChannelId *string `json:"shortChannelId"`
	ClosingTxid    *string `json:"closingTxid"`
}

type messageSuccessActionDataDto struct {
	Message string `json:"message"`
}

type nodeStateDto struct {
	Id                         string                        `json:"id"`
	BlockHeight                uint32                        `json:"blockHeight"`
	ChannelsBalanceMsat        uint64                        `json:"channelsBalanceMsat"`
	OnchainBalanceMsat         uint64                        `json:"onchainBalanceMsat"`
	PendingOnchainBalanceMsat  uint64                        `json:"pendingOnchainBalanceMsat"`
	Utxos                      []unspentTransactionOutputDto `json:"utxos"`
	MaxPayableMsat             uint64                        `json:"maxPayableMsat"`
	MaxReceivableMsat          uint64                        `json:"maxReceivableMsat"`
	MaxSinglePaymentAmountMsat uint64                        `json:"maxSinglePaymentAmountMsat"`
	MaxChanReserveMsats        uint64                        `json:"maxChanReserveMsats"`
	ConnectedPeers             []string                      `json:"connectedPeers"`
	InboundLiquidityMsats      uint64                        `json:"inboundLiquidityMsats"`
}

type listPaymentsRequestDto struct {
	Filters         *[]string `json:"filters"`
	FromTimestamp   *int64    `json:"fromTimestamp"`
	ToTimestamp     *int64    `json:"toTimestamp"`
	IncludeFailures *bool     `json:"includeFailures"`
	Offset          *uint32   `json:"offset"`
	Limit           *uint32   `json:"limit"`
}

type lnInvoiceDto struct {
	Bolt11          string         `json:"bolt11"`
	PayeePubkey     string         `json:"payeePubkey"`
	PaymentHash     string         `json:"paymentHash"`
	Description     *string        `json:"description"`
	DescriptionHash *string        `json:"descriptionHash"`
	AmountMsat      *uint64        `json:"amountMsat"`
	Timestamp       uint64         `json:"timestamp"`
	Expiry          uint64         `json:"expiry"`
	RoutingHints    []routeHintDto `json:"routingHints"`
	PaymentSecret   []uint8        `json:"paymentSecret"`
}

type lnPaymentDetailsDto struct {
	PaymentHash            string              `json:"paymentHash"`
	Label                  string              `json:"label"`
	DestinationPubkey      string              `json:"destinationPubkey"`
	PaymentPreimage        string              `json:"paymentPreimage"`
	Keysend                bool                `json:"keysend"`
	Bolt11                 string              `json:"bolt11"`
	OpenChannelBolt11      *string             `json:"openChannelBolt11"`
	LnurlSuccessAction     interface{}         `json:"lnurlSuccessAction"`
	LnurlPayDomain         *string             `json:"lnurlPayDomain"`
	LnurlPayComment        *string             `json:"lnurlPayComment"`
	LnurlMetadata          *string             `json:"lnurlMetadata"`
	LnAddress              *string             `json:"lnAddress"`
	LnurlWithdrawEndpoint  *string             `json:"lnurlWithdrawEndpoint"`
	ReverseSwapInfo        *reverseSwapInfoDto `json:"reverseSwapInfo"`
	PendingExpirationBlock *uint32             `json:"pendingExpirationBlock"`
}

type lnUrlAuthRequestDataDto struct {
	K1     string  `json:"k1"`
	Action *string `json:"action"`
	Domain string  `json:"domain"`
	Url    string  `json:"url"`
}

type lnUrlErrorDataDto struct {
	Reason string `json:"reason"`
}

type lnUrlPayRequestDataDto struct {
	Callback       string  `json:"callback"`
	MinSendable    uint64  `json:"minSendable"`
	MaxSendable    uint64  `json:"maxSendable"`
	MetadataStr    string  `json:"metadataStr"`
	CommentAllowed uint16  `json:"commentAllowed"`
	Domain         string  `json:"domain"`
	AllowsNostr    bool    `json:"allowsNostr"`
	NostrPubkey    *string `json:"nostrPubkey"`
	LnAddress      *string `json:"lnAddress"`
}

type lnUrlWithdrawRequestDataDto struct {
	Callback           string `json:"callback"`
	K1                 string `json:"k1"`
	DefaultDescription string `json:"defaultDescription"`
	MinWithdrawable    uint64 `json:"minWithdrawable"`
	MaxWithdrawable    uint64 `json:"maxWithdrawable"`
}

type openChannelFeeRequestDto struct {
	AmountMsat *uint64 `json:"amountMsat"`
	Expiry     *uint32 `json:"expiry"`
}

type openChannelFeeResponseDto struct {
	FeeMsat   *uint64             `json:"feeMsat"`
	FeeParams openingFeeParamsDto `json:"feeParams"`
}

type openingFeeParamsDto struct {
	MinMsat              uint64 `json:"minMsat"`
	Proportional         uint32 `json:"proportional"`
	ValidUntil           string `json:"validUntil"`
	MaxIdleTime          uint32 `json:"maxIdleTime"`
	MaxClientToSelfDelay uint32 `json:"maxClientToSelfDelay"`
	Promise              string `json:"promise"`
}

type paymentDto struct {
	Id          string      `json:"id"`
	PaymentType string      `json:"paymentType"`
	PaymentTime int64       `json:"paymentTime"`
	AmountMsat  uint64      `json:"amountMsat"`
	FeeMsat     uint64      `json:"feeMsat"`
	Status      string      `json:"status"`
	Error       *string     `json:"error"`
	Description *string     `json:"description"`
	Details     typeDataDto `json:"details"`
}

type receivePaymentRequestDto struct {
	AmountMsat         uint64               `json:"amountMsat"`
	Description        string               `json:"description"`
	Preimage           *[]uint8             `json:"preimage"`
	OpeningFeeParams   *openingFeeParamsDto `json:"openingFeeParams"`
	UseDescriptionHash *bool                `json:"useDescriptionHash"`
	Expiry             *uint32              `json:"expiry"`
	Cltv               *uint32              `json:"cltv"`
}

type receivePaymentResponseDto struct {
	LnInvoice        lnInvoiceDto         `json:"lnInvoice"`
	OpeningFeeParams *openingFeeParamsDto `json:"openingFeeParams"`
	OpeningFeeMsat   *uint64              `json:"openingFeeMsat"`
}

type reverseSwapInfoDto struct {
	Id               string  `json:"id"`
	ClaimPubkey      string  `json:"claimPubkey"`
	LockupTxid       *string `json:"lockupTxid"`
	ClaimTxid        *string `json:"claimTxid"`
	OnchainAmountSat uint64  `json:"onchainAmountSat"`
	Status           string  `json:"status"`
}

type routeHintDto struct {
	Hops []routeHintHopDto `json:"hops"`
}

type routeHintHopDto struct {
	SrcNodeId                  string  `json:"srcNodeId"`
	ShortChannelId             uint64  `json:"shortChannelId"`
	FeesBaseMsat               uint32  `json:"feesBaseMsat"`
	FeesProportionalMillionths uint32  `json:"feesProportionalMillionths"`
	CltvExpiryDelta            uint64  `json:"cltvExpiryDelta"`
	HtlcMinimumMsat            *uint64 `json:"htlcMinimumMsat"`
	HtlcMaximumMsat            *uint64 `json:"htlcMaximumMsat"`
}

type sendPaymentRequestDto struct {
	Bolt11     string  `json:"bolt11"`
	AmountMsat *uint64 `json:"amountMsat"`
	Label      *string `json:"label"`
}

type sendPaymentResponseDto struct {
	Payment paymentDto `json:"payment"`
}

type typeDataDto struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type unspentTransactionOutputDto struct {
	Txid               []uint8 `json:"txid"`
	Outnum             uint32  `json:"outnum"`
	AmountMillisatoshi uint64  `json:"amountMillisatoshi"`
	Address            string  `json:"address"`
	Reserved           bool    `json:"reserved"`
}

type urlSuccessActionDataDecryptedDto struct {
	Description string `json:"description"`
	Url         string `json:"url"`
}
