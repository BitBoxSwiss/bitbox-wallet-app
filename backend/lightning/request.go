package lightning

import (
	"net/url"

	"github.com/breez/breez-sdk-go/breez_sdk"
)

func toListPaymentsRequestDto(params url.Values) (listPaymentsRequestDto, error) {
	fromTimestamp, err := getOptionalInt64(params, "fromTimestamp")
	if err != nil {
		return listPaymentsRequestDto{}, err
	}
	toTimestamp, err := getOptionalInt64(params, "toTimestamp")
	if err != nil {
		return listPaymentsRequestDto{}, err
	}
	includeFailures, err := getOptionalBool(params, "toTincludeFailuresimestamp")
	if err != nil {
		return listPaymentsRequestDto{}, err
	}
	return listPaymentsRequestDto{
		Filter: params.Get("filter"),
		FromTimestamp: fromTimestamp,
		ToTimestamp: toTimestamp,
		IncludeFailures: includeFailures,
	}, nil
}

func toListPaymentsRequest(listPaymentsRequest listPaymentsRequestDto) (breez_sdk.ListPaymentsRequest, error) {
	paymentFilter, err := toPaymentTypeFilter(listPaymentsRequest.Filter)
	if err != nil {
		return breez_sdk.ListPaymentsRequest{}, err
	}
	return breez_sdk.ListPaymentsRequest{
		Filter: paymentFilter,
		FromTimestamp: listPaymentsRequest.FromTimestamp,
		ToTimestamp: listPaymentsRequest.ToTimestamp,
		IncludeFailures: listPaymentsRequest.IncludeFailures,
	}, nil
}

func toOpenChannelFeeRequestDto(params url.Values) (openChannelFeeRequestDto, error) {
	amountMsat, err := getInt64(params, "amountMsat")
	if err != nil {
		return openChannelFeeRequestDto{}, err
	}
	expiry, err := getOptionalUint32(params, "expiry")
	if err != nil {
		return openChannelFeeRequestDto{}, err
	}
	return openChannelFeeRequestDto{
		AmountMsat: uint64(amountMsat),
		Expiry: expiry,
	}, nil
}

func toOpenChannelFeeRequest(openChannelFeeRequest openChannelFeeRequestDto) breez_sdk.OpenChannelFeeRequest {
	return breez_sdk.OpenChannelFeeRequest{
		AmountMsat: openChannelFeeRequest.AmountMsat,
		Expiry:     openChannelFeeRequest.Expiry,
	}
}

func toOpeningFeeParams(openingFeeParams *openingFeeParamsDto) *breez_sdk.OpeningFeeParams {
	if openingFeeParams != nil {
		return &breez_sdk.OpeningFeeParams{
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

func toReceivePaymentRequest(receivePaymentRequest receivePaymentRequestDto) breez_sdk.ReceivePaymentRequest {
	return breez_sdk.ReceivePaymentRequest{
		AmountSats:         receivePaymentRequest.AmountSats,
		Description:        receivePaymentRequest.Description,
		Preimage:           receivePaymentRequest.Preimage,
		OpeningFeeParams:   toOpeningFeeParams(receivePaymentRequest.OpeningFeeParams),
		UseDescriptionHash: receivePaymentRequest.UseDescriptionHash,
		Expiry:             receivePaymentRequest.Expiry,
		Cltv:               receivePaymentRequest.Cltv,
	}
}
