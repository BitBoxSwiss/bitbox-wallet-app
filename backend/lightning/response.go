package lightning

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-go/breez_sdk"
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
		State:          state,
		FundingTxid:    closedChannelPaymentDetails.FundingTxid,
		ShortChannelId: closedChannelPaymentDetails.ShortChannelId,
		ClosingTxid:    closedChannelPaymentDetails.ClosingTxid,
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
	reverseSwapInfo, err := toReverseSwapInfoDto(lnPaymentDetails.ReverseSwapInfo)
	if err != nil {
		return lnPaymentDetailsDto{}, err
	}
	successActionProcessed, err := toSuccessActionProcessedDto(lnPaymentDetails.LnurlSuccessAction)
	if err != nil {
		return lnPaymentDetailsDto{}, err
	}
	return lnPaymentDetailsDto{
		PaymentHash:            lnPaymentDetails.PaymentHash,
		Label:                  lnPaymentDetails.Label,
		DestinationPubkey:      lnPaymentDetails.DestinationPubkey,
		PaymentPreimage:        lnPaymentDetails.PaymentPreimage,
		Keysend:                lnPaymentDetails.Keysend,
		Bolt11:                 lnPaymentDetails.Bolt11,
		OpenChannelBolt11:      lnPaymentDetails.OpenChannelBolt11,
		LnurlSuccessAction:     successActionProcessed,
		LnurlPayDomain:         lnPaymentDetails.LnurlPayDomain,
		LnurlPayComment:        lnPaymentDetails.LnurlPayComment,
		LnurlMetadata:          lnPaymentDetails.LnurlMetadata,
		LnAddress:              lnPaymentDetails.LnAddress,
		LnurlWithdrawEndpoint:  lnPaymentDetails.LnurlWithdrawEndpoint,
		ReverseSwapInfo:        reverseSwapInfo,
		PendingExpirationBlock: lnPaymentDetails.PendingExpirationBlock,
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
		AllowsNostr:    lnUrlPayRequestData.AllowsNostr,
		NostrPubkey:    lnUrlPayRequestData.NostrPubkey,
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
		PendingOnchainBalanceMsat:  nodeState.PendingOnchainBalanceMsat,
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
		FeeMsat:   openChannelFeeResponse.FeeMsat,
		FeeParams: toOpeningFeeParamsDto(openChannelFeeResponse.FeeParams),
	}
}

func toOpeningFeeParamsDto(openingFeeParams breez_sdk.OpeningFeeParams) openingFeeParamsDto {
	return openingFeeParamsDto{
		MinMsat:              openingFeeParams.MinMsat,
		Proportional:         openingFeeParams.Proportional,
		ValidUntil:           openingFeeParams.ValidUntil,
		MaxIdleTime:          openingFeeParams.MaxIdleTime,
		MaxClientToSelfDelay: openingFeeParams.MaxClientToSelfDelay,
		Promise:              openingFeeParams.Promise,
	}
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
		Error:       payment.Error,
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
	response := receivePaymentResponseDto{
		LnInvoice:      toLnInvoiceDto(receivePaymentResponse.LnInvoice),
		OpeningFeeMsat: receivePaymentResponse.OpeningFeeMsat,
	}
	if receivePaymentResponse.OpeningFeeParams != nil {
		openingFeeParams := toOpeningFeeParamsDto(*receivePaymentResponse.OpeningFeeParams)
		response.OpeningFeeParams = &openingFeeParams
	}
	return response
}

func toReverseSwapInfoDto(reverseSwapInfo *breez_sdk.ReverseSwapInfo) (*reverseSwapInfoDto, error) {
	if reverseSwapInfo != nil {
		reverseSwapStatus, err := toReverseSwapStatusDto(reverseSwapInfo.Status)
		if err != nil {
			return nil, err
		}
		return &reverseSwapInfoDto{
			Id:               reverseSwapInfo.Id,
			ClaimPubkey:      reverseSwapInfo.ClaimPubkey,
			LockupTxid:       reverseSwapInfo.LockupTxid,
			ClaimTxid:        reverseSwapInfo.ClaimTxid,
			OnchainAmountSat: reverseSwapInfo.OnchainAmountSat,
			Status:           reverseSwapStatus,
		}, nil
	}
	return nil, nil
}

//nolint:misspell
func toReverseSwapStatusDto(status breez_sdk.ReverseSwapStatus) (string, error) {
	switch status {
	case breez_sdk.ReverseSwapStatusCancelled:
		return "cancelled", nil
	case breez_sdk.ReverseSwapStatusCompletedConfirmed:
		return "completedConfirmed", nil
	case breez_sdk.ReverseSwapStatusCompletedSeen:
		return "completedSeen", nil
	case breez_sdk.ReverseSwapStatusInProgress:
		return "inProgress", nil
	case breez_sdk.ReverseSwapStatusInitial:
		return "initial", nil
	}
	return "", errp.New("Invalid ReverseSwapStatus")
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

func toSuccessActionProcessedDto(successActionProcessed *breez_sdk.SuccessActionProcessed) (interface{}, error) {
	if successActionProcessed != nil {
		switch successActionType := (*successActionProcessed).(type) {
		case breez_sdk.SuccessActionProcessedAes:
			switch resultType := successActionType.Result.(type) {
			case breez_sdk.AesSuccessActionDataResultDecrypted:
				return &aesSuccessActionResultDto{
					Type: "aes",
					Result: typeDataDto{
						Type: "decrypted",
						Data: aesSuccessActionDataDecryptedDto{
							Description: resultType.Data.Description,
							Plaintext:   resultType.Data.Plaintext,
						},
					},
				}, nil
			case breez_sdk.AesSuccessActionDataResultErrorStatus:
				return &aesSuccessActionResultDto{
					Type: "aes",
					Result: aesSuccessActionResultErrorDto{
						Type:   "errorStatus",
						Reason: resultType.Reason,
					},
				}, nil
			}
		case breez_sdk.SuccessActionProcessedMessage:
			return &typeDataDto{Type: "message", Data: messageSuccessActionDataDto{
				Message: successActionType.Data.Message,
			}}, nil
		case breez_sdk.SuccessActionProcessedUrl:
			return &typeDataDto{Type: "url", Data: urlSuccessActionDataDecryptedDto{
				Description: successActionType.Data.Description,
				Url:         successActionType.Data.Url,
			}}, nil
		}
		return nil, errp.New("Invalid SuccessActionProcessed")
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
