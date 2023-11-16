package lightning

import (
	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

type responseDto struct {
	Success      bool        `json:"success"`
	Data         interface{} `json:"data"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	ErrorCode    string      `json:"errorCode,omitempty"`
}

func toBitcoinAddressDataDto(bitcoinAddressData breez_sdk.BitcoinAddressData) (bitcoinAddressDataDto, error) {
	network, err := toNetworkDto(bitcoinAddressData.Network)
	if err != nil {
		return bitcoinAddressDataDto{}, err
	}
	return bitcoinAddressDataDto{
		Address:   bitcoinAddressData.Address,
		Network:   network,
		AmountSat: bitcoinAddressData.AmountSat,
		Label:     bitcoinAddressData.Label,
		Message:   bitcoinAddressData.Message,
	}, nil
}

func toChannelStateDto(state breez_sdk.ChannelState) (string, error) {
	switch state {
	case breez_sdk.ChannelStatePendingOpen:
		return "pendingOpen", nil
	case breez_sdk.ChannelStateOpened:
		return "opened", nil
	case breez_sdk.ChannelStatePendingClose:
		return "pendingClose", nil
	case breez_sdk.ChannelStateClosed:
		return "closed", nil
	}
	return "", errp.New("Invalid ChannelState")
}

func toClosedChannelPaymentDetailsDto(closedChannelPaymentDetails breez_sdk.ClosedChannelPaymentDetails) (closedChannelPaymentDetailsDto, error) {
	state, err := toChannelStateDto(closedChannelPaymentDetails.State)
	if err != nil {
		return closedChannelPaymentDetailsDto{}, err
	}
	return closedChannelPaymentDetailsDto{
		ShortChannelId: closedChannelPaymentDetails.ShortChannelId,
		State:          state,
		FundingTxid:    closedChannelPaymentDetails.FundingTxid,
	}, nil
}

func toInputTypeDto(inputType breez_sdk.InputType) (interface{}, error) {
	switch typed := inputType.(type) {
	case breez_sdk.InputTypeBitcoinAddress:
		type inputTypeBitcoinAddressDto struct {
			Type    string                `json:"type"`
			Address bitcoinAddressDataDto `json:"address"`
		}
		bitcoinAddressData, err := toBitcoinAddressDataDto(typed.Address)
		if err != nil {
			return nil, err
		}
		return inputTypeBitcoinAddressDto{Type: "bitcoinAddress", Address: bitcoinAddressData}, nil
	case breez_sdk.InputTypeBolt11:
		type inputTypeBolt11Dto struct {
			Type    string       `json:"type"`
			Invoice lnInvoiceDto `json:"invoice"`
		}
		return inputTypeBolt11Dto{Type: "bolt11", Invoice: toLnInvoiceDto(typed.Invoice)}, nil
	case breez_sdk.InputTypeNodeId:
		type inputTypeNodeIdDto struct {
			Type   string `json:"type"`
			NodeId string `json:"nodeId"`
		}
		return inputTypeNodeIdDto{Type: "nodeId", NodeId: typed.NodeId}, nil
	case breez_sdk.InputTypeUrl:
		type inputTypeUrlDto struct {
			Type string `json:"type"`
			Url  string `json:"url"`
		}
		return inputTypeUrlDto{Type: "url", Url: typed.Url}, nil
	case breez_sdk.InputTypeLnUrlPay:
		type inputTypeLnUrlPayDto struct {
			Type string                 `json:"type"`
			Data lnUrlPayRequestDataDto `json:"data"`
		}
		return inputTypeLnUrlPayDto{Type: "lnUrlPay", Data: toLnUrlPayRequestDataDto(typed.Data)}, nil
	case breez_sdk.InputTypeLnUrlWithdraw:
		type inputTypeLnUrlWithdrawDto struct {
			Type string                      `json:"type"`
			Data lnUrlWithdrawRequestDataDto `json:"data"`
		}
		return inputTypeLnUrlWithdrawDto{Type: "lnUrlWithdraw", Data: toLnUrlWithdrawRequestDataDto(typed.Data)}, nil
	case breez_sdk.InputTypeLnUrlAuth:
		type inputTypeLnUrlAuthDto struct {
			Type string                  `json:"type"`
			Data lnUrlAuthRequestDataDto `json:"data"`
		}
		return inputTypeLnUrlAuthDto{Type: "lnUrlAuth", Data: toLnUrlAuthRequestDataDto(typed.Data)}, nil
	case breez_sdk.InputTypeLnUrlError:
		type inputTypeLnUrlErrorDto struct {
			Type string            `json:"type"`
			Data lnUrlErrorDataDto `json:"data"`
		}
		return inputTypeLnUrlErrorDto{Type: "lnUrlError", Data: toLnUrlErrorDataDto(typed.Data)}, nil
	}
	return nil, errp.New("Invalid InputType")
}

func toLnInvoiceDto(lnInvoice breez_sdk.LnInvoice) lnInvoiceDto {
	return lnInvoiceDto{
		Bolt11:          lnInvoice.Bolt11,
		PayeePubkey:     lnInvoice.PayeePubkey,
		PaymentHash:     lnInvoice.PaymentHash,
		Description:     lnInvoice.Description,
		DescriptionHash: lnInvoice.DescriptionHash,
		AmountMsat:      lnInvoice.AmountMsat,
		Timestamp:       lnInvoice.Timestamp,
		Expiry:          lnInvoice.Expiry,
		RoutingHints:    toRouteHintsDto(lnInvoice.RoutingHints),
		PaymentSecret:   lnInvoice.PaymentSecret,
	}
}

func toLnPaymentDetailsDto(lnPaymentDetails breez_sdk.LnPaymentDetails) (lnPaymentDetailsDto, error) {
	successActionProcessed, err := toSuccessActionProcessedDto(lnPaymentDetails.LnurlSuccessAction)
	if err != nil {
		return lnPaymentDetailsDto{}, err
	}
	return lnPaymentDetailsDto{
		PaymentHash:           lnPaymentDetails.PaymentHash,
		Label:                 lnPaymentDetails.Label,
		DestinationPubkey:     lnPaymentDetails.DestinationPubkey,
		PaymentPreimage:       lnPaymentDetails.PaymentPreimage,
		Keysend:               lnPaymentDetails.Keysend,
		Bolt11:                lnPaymentDetails.Bolt11,
		LnurlSuccessAction:    successActionProcessed,
		LnurlMetadata:         lnPaymentDetails.LnurlMetadata,
		LnAddress:             lnPaymentDetails.LnAddress,
		LnurlWithdrawEndpoint: lnPaymentDetails.LnurlWithdrawEndpoint,
	}, nil
}

func toLnUrlAuthRequestDataDto(lnUrlAuthRequestData breez_sdk.LnUrlAuthRequestData) lnUrlAuthRequestDataDto {
	return lnUrlAuthRequestDataDto{
		K1:     lnUrlAuthRequestData.K1,
		Action: lnUrlAuthRequestData.Action,
		Domain: lnUrlAuthRequestData.Domain,
		Url:    lnUrlAuthRequestData.Url,
	}
}

func toLnUrlErrorDataDto(lnUrlErrorData breez_sdk.LnUrlErrorData) lnUrlErrorDataDto {
	return lnUrlErrorDataDto{
		Reason: lnUrlErrorData.Reason,
	}
}

func toLnUrlPayRequestDataDto(lnUrlPayRequestData breez_sdk.LnUrlPayRequestData) lnUrlPayRequestDataDto {
	return lnUrlPayRequestDataDto{
		Callback:       lnUrlPayRequestData.Callback,
		MinSendable:    lnUrlPayRequestData.MinSendable,
		MaxSendable:    lnUrlPayRequestData.MaxSendable,
		MetadataStr:    lnUrlPayRequestData.MetadataStr,
		CommentAllowed: lnUrlPayRequestData.CommentAllowed,
		Domain:         lnUrlPayRequestData.Domain,
		LnAddress:      lnUrlPayRequestData.LnAddress,
	}
}

func toLnUrlWithdrawRequestDataDto(lnUrlWithdrawRequestData breez_sdk.LnUrlWithdrawRequestData) lnUrlWithdrawRequestDataDto {
	return lnUrlWithdrawRequestDataDto{
		Callback:           lnUrlWithdrawRequestData.Callback,
		K1:                 lnUrlWithdrawRequestData.K1,
		DefaultDescription: lnUrlWithdrawRequestData.DefaultDescription,
		MinWithdrawable:    lnUrlWithdrawRequestData.MinWithdrawable,
		MaxWithdrawable:    lnUrlWithdrawRequestData.MaxWithdrawable,
	}
}

func toNetworkDto(network breez_sdk.Network) (string, error) {
	switch network {
	case breez_sdk.NetworkBitcoin:
		return "bitcoin", nil
	case breez_sdk.NetworkTestnet:
		return "testnet", nil
	case breez_sdk.NetworkSignet:
		return "signet", nil
	case breez_sdk.NetworkRegtest:
		return "regtest", nil
	}
	return "", errp.New("Invalid Network")
}

func toNodeStateDto(nodeState breez_sdk.NodeState) nodeStateDto {
	return nodeStateDto{
		Id:                         nodeState.Id,
		BlockHeight:                nodeState.BlockHeight,
		ChannelsBalanceMsat:        nodeState.ChannelsBalanceMsat,
		OnchainBalanceMsat:         nodeState.OnchainBalanceMsat,
		Utxos:                      toUnspentTransactionOutputsDto(nodeState.Utxos),
		MaxPayableMsat:             nodeState.MaxPayableMsat,
		MaxReceivableMsat:          nodeState.MaxReceivableMsat,
		MaxSinglePaymentAmountMsat: nodeState.MaxSinglePaymentAmountMsat,
		MaxChanReserveMsats:        nodeState.MaxChanReserveMsats,
		ConnectedPeers:             nodeState.ConnectedPeers,
		InboundLiquidityMsats:      nodeState.InboundLiquidityMsats,
	}
}

func toOpenChannelFeeResponseDto(openChannelFeeResponse breez_sdk.OpenChannelFeeResponse) openChannelFeeResponseDto {
	return openChannelFeeResponseDto{
		FeeMsat:       openChannelFeeResponse.FeeMsat,
		UsedFeeParams: toOpeningFeeParamsDto(openChannelFeeResponse.UsedFeeParams),
	}
}

func toOpeningFeeParamsDto(openingFeeParams *breez_sdk.OpeningFeeParams) *openingFeeParamsDto {
	if openingFeeParams != nil {
		return &openingFeeParamsDto{
			MinMsat:              openingFeeParams.MinMsat,
			Proportional:         openingFeeParams.Proportional,
			ValidUntil:           openingFeeParams.ValidUntil,
			MaxIdleTime:          openingFeeParams.MaxIdleTime,
			MaxClientToSelfDelay: openingFeeParams.MaxClientToSelfDelay,
			Promise:              openingFeeParams.Promise,
		}
	}

	return nil
}

func toPaymentStatusDto(status breez_sdk.PaymentStatus) (string, error) {
	switch status {
	case breez_sdk.PaymentStatusPending:
		return "pending", nil
	case breez_sdk.PaymentStatusComplete:
		return "complete", nil
	case breez_sdk.PaymentStatusFailed:
		return "failed", nil
	}
	return "", errp.New("Invalid PaymentStatus")
}

func toPaymentTypeDto(paymentType breez_sdk.PaymentType) (string, error) {
	switch paymentType {
	case breez_sdk.PaymentTypeSent:
		return "sent", nil
	case breez_sdk.PaymentTypeReceived:
		return "received", nil
	case breez_sdk.PaymentTypeClosedChannel:
		return "closedChannel", nil
	}
	return "", errp.New("Invalid PaymentType")
}

func toPaymentTypeFilter(filter string) (breez_sdk.PaymentTypeFilter, error) {
	switch filter {
	case "closedChannel":
		return breez_sdk.PaymentTypeFilterClosedChannel, nil
	case "sent":
		return breez_sdk.PaymentTypeFilterSent, nil
	case "received":
		return breez_sdk.PaymentTypeFilterReceived, nil
	}
	return breez_sdk.PaymentTypeFilterSent, errp.New("Invalid PaymentTypeFilter")
}

func toPaymentDto(payment breez_sdk.Payment) (paymentDto, error) {
	paymentType, err := toPaymentTypeDto(payment.PaymentType)
	if err != nil {
		return paymentDto{}, err
	}
	status, err := toPaymentStatusDto(payment.Status)
	if err != nil {
		return paymentDto{}, err
	}
	details, err := toPaymentDetailsDto(payment.Details)
	if err != nil {
		return paymentDto{}, err
	}
	return paymentDto{
		Id:          payment.Id,
		PaymentType: paymentType,
		PaymentTime: payment.PaymentTime,
		AmountMsat:  payment.AmountMsat,
		FeeMsat:     payment.FeeMsat,
		Status:      status,
		Description: payment.Description,
		Details:     details,
	}, nil
}

func toPaymentsDto(payments []breez_sdk.Payment) ([]paymentDto, error) {
	list := []paymentDto{}

	for _, p := range payments {
		payment, err := toPaymentDto(p)
		if err != nil {
			return []paymentDto{}, err
		}
		list = append(list, payment)
	}

	return list, nil
}

func toPaymentDetailsDto(paymentDetails breez_sdk.PaymentDetails) (typeDataDto, error) {
	switch typed := paymentDetails.(type) {
	case breez_sdk.PaymentDetailsLn:
		lnPaymentDetails, err := toLnPaymentDetailsDto(typed.Data)
		if err != nil {
			return typeDataDto{}, err
		}
		return typeDataDto{Type: "ln", Data: lnPaymentDetails}, nil
	case breez_sdk.PaymentDetailsClosedChannel:
		closedChannelPaymentDetails, err := toClosedChannelPaymentDetailsDto(typed.Data)
		if err != nil {
			return typeDataDto{}, err
		}
		return typeDataDto{Type: "cloedChannel", Data: closedChannelPaymentDetails}, nil
	}
	return typeDataDto{}, errp.New("Invalid PaymentStatus")
}

func toReceivePaymentResponseDto(receivePaymentResponse breez_sdk.ReceivePaymentResponse) receivePaymentResponseDto {
	return receivePaymentResponseDto{
		LnInvoice:        toLnInvoiceDto(receivePaymentResponse.LnInvoice),
		OpeningFeeParams: toOpeningFeeParamsDto(receivePaymentResponse.OpeningFeeParams),
		OpeningFeeMsat:   receivePaymentResponse.OpeningFeeMsat,
	}
}

func toRouteHintsDto(routeHints []breez_sdk.RouteHint) []routeHintDto {
	list := []routeHintDto{}

	for _, routeHint := range routeHints {
		list = append(list, routeHintDto{
			Hops: toRouteHintHopsDto(routeHint.Hops),
		})
	}

	return list
}

func toRouteHintHopsDto(routeHintHops []breez_sdk.RouteHintHop) []routeHintHopDto {
	list := []routeHintHopDto{}

	for _, routeHintHop := range routeHintHops {
		list = append(list, routeHintHopDto{
			SrcNodeId:                  routeHintHop.SrcNodeId,
			ShortChannelId:             routeHintHop.ShortChannelId,
			FeesBaseMsat:               routeHintHop.FeesBaseMsat,
			FeesProportionalMillionths: routeHintHop.FeesProportionalMillionths,
			CltvExpiryDelta:            routeHintHop.CltvExpiryDelta,
			HtlcMinimumMsat:            routeHintHop.HtlcMinimumMsat,
			HtlcMaximumMsat:            routeHintHop.HtlcMaximumMsat,
		})
	}

	return list
}

func toSendPaymentResponseDto(sendPaymentResponse breez_sdk.SendPaymentResponse) (sendPaymentResponseDto, error) {
	payment, err := toPaymentDto(sendPaymentResponse.Payment)
	if err != nil {
		return sendPaymentResponseDto{}, err
	}

	return sendPaymentResponseDto{
		Payment: payment,
	}, nil
}

func toSuccessActionProcessedDto(successActionProcessed *breez_sdk.SuccessActionProcessed) (*typeDataDto, error) {
	if successActionProcessed != nil {
		switch typed := (*successActionProcessed).(type) {
		case breez_sdk.SuccessActionProcessedAes:
			return &typeDataDto{Type: "aes", Data: aesSuccessActionDataDecryptedDto{
				Description: typed.Data.Description,
				Plaintext:   typed.Data.Plaintext,
			}}, nil
		case breez_sdk.SuccessActionProcessedMessage:
			return &typeDataDto{Type: "message", Data: messageSuccessActionDataDto{
				Message: typed.Data.Message,
			}}, nil
		case breez_sdk.SuccessActionProcessedUrl:
			return &typeDataDto{Type: "url", Data: urlSuccessActionDataDecryptedDto{
				Description: typed.Data.Description,
				Url:         typed.Data.Url,
			}}, nil
		}
		return &typeDataDto{}, errp.New("Invalid SuccessActionProcessed")
	}
	return nil, nil
}

func toUnspentTransactionOutputsDto(unspentTransactionOutputs []breez_sdk.UnspentTransactionOutput) []unspentTransactionOutputDto {
	list := []unspentTransactionOutputDto{}

	for _, unspentTransactionOutput := range unspentTransactionOutputs {
		list = append(list, unspentTransactionOutputDto{
			Txid:               unspentTransactionOutput.Txid,
			Outnum:             unspentTransactionOutput.Outnum,
			AmountMillisatoshi: unspentTransactionOutput.AmountMillisatoshi,
			Address:            unspentTransactionOutput.Address,
			Reserved:           unspentTransactionOutput.Reserved,
		})
	}

	return list
}
