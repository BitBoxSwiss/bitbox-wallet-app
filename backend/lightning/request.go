// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"net/url"
	"strconv"

	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

// func toPaymentTypeFilterList(filters *[]string) (*[]breez_sdk.PaymentTypeFilter, error) {
// 	if filters != nil {
// 		list := []breez_sdk.PaymentTypeFilter{}

// 		for _, f := range *filters {
// 			filter, err := toPaymentTypeFilter(f)
// 			if err != nil {
// 				return nil, err
// 			}
// 			list = append(list, filter)
// 		}

// 		return &list, nil
// 	}

// 	return nil, nil
// }

// func toListPaymentsRequestDto(params url.Values) (listPaymentsRequestDto, error) {
// 	fromTimestamp, err := getOptionalInt64(params, "fromTimestamp")
// 	if err != nil {
// 		return listPaymentsRequestDto{}, err
// 	}
// 	toTimestamp, err := getOptionalInt64(params, "toTimestamp")
// 	if err != nil {
// 		return listPaymentsRequestDto{}, err
// 	}
// 	includeFailures, err := getOptionalBool(params, "includeFailures")
// 	if err != nil {
// 		return listPaymentsRequestDto{}, err
// 	}
// 	offset, err := getOptionalUint32(params, "offset")
// 	if err != nil {
// 		return listPaymentsRequestDto{}, err
// 	}
// 	limit, err := getOptionalUint32(params, "limit")
// 	if err != nil {
// 		return listPaymentsRequestDto{}, err
// 	}
// 	return listPaymentsRequestDto{
// 		Filters:         getOptionalList(params, "filters"),
// 		FromTimestamp:   fromTimestamp,
// 		ToTimestamp:     toTimestamp,
// 		IncludeFailures: includeFailures,
// 		Offset:          offset,
// 		Limit:           limit,
// 	}, nil
// }

// func toListPaymentsRequest(listPaymentsRequest listPaymentsRequestDto) (breez_sdk.ListPaymentsRequest, error) {
// 	paymentFilters, err := toPaymentTypeFilterList(listPaymentsRequest.Filters)
// 	if err != nil {
// 		return breez_sdk.ListPaymentsRequest{}, err
// 	}
// 	return breez_sdk.ListPaymentsRequest{
// 		Filters:         paymentFilters,
// 		FromTimestamp:   listPaymentsRequest.FromTimestamp,
// 		ToTimestamp:     listPaymentsRequest.ToTimestamp,
// 		IncludeFailures: listPaymentsRequest.IncludeFailures,
// 	}, nil
// }

func toSparkPaymentTypeList(filters *[]string) (*[]breez_sdk_spark.PaymentType, error) {
	if filters == nil {
		return nil, nil
	}

	list := []breez_sdk_spark.PaymentType{}
	for _, f := range *filters {
		parsed, err := strconv.ParseUint(f, 10, 32)
		if err != nil {
			return nil, err
		}
		list = append(list, breez_sdk_spark.PaymentType(parsed))
	}
	return &list, nil
}

func toSparkPaymentStatusList(filters *[]string) (*[]breez_sdk_spark.PaymentStatus, error) {
	if filters == nil {
		return nil, nil
	}

	list := []breez_sdk_spark.PaymentStatus{}
	for _, f := range *filters {
		parsed, err := strconv.ParseUint(f, 10, 32)
		if err != nil {
			return nil, err
		}
		list = append(list, breez_sdk_spark.PaymentStatus(parsed))
	}
	return &list, nil
}

func toSparkListPaymentsRequest(params url.Values) (breez_sdk_spark.ListPaymentsRequest, error) {
	typeFilter, err := toSparkPaymentTypeList(getOptionalList(params, "typeFilter"))
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	statusFilter, err := toSparkPaymentStatusList(getOptionalList(params, "statusFilter"))
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	fromTimestamp, err := getOptionalUint64(params, "fromTimestamp")
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	toTimestamp, err := getOptionalUint64(params, "toTimestamp")
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	offset, err := getOptionalUint32(params, "offset")
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	limit, err := getOptionalUint32(params, "limit")
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	sortAscending, err := getOptionalBool(params, "sortAscending")
	if err != nil {
		return breez_sdk_spark.ListPaymentsRequest{}, err
	}

	return breez_sdk_spark.ListPaymentsRequest{
		TypeFilter:    typeFilter,
		StatusFilter:  statusFilter,
		FromTimestamp: fromTimestamp,
		ToTimestamp:   toTimestamp,
		Offset:        offset,
		Limit:         limit,
		SortAscending: sortAscending,
	}, nil
}

// func toReportIssueRequest(reportPaymentFailureRequest reportPaymentFailureRequestDto) breez_sdk.ReportIssueRequest {
// 	return breez_sdk.ReportIssueRequestPaymentFailure{
// 		Data: breez_sdk.ReportPaymentFailureDetails{
// 			PaymentHash: reportPaymentFailureRequest.PaymentHash,
// 			Comment:     reportPaymentFailureRequest.Comment,
// 		},
// 	}
// }

// func toOpenChannelFeeRequestDto(params url.Values) (openChannelFeeRequestDto, error) {
// 	amountMsat, err := getOptionalUint64(params, "amountMsat")
// 	if err != nil {
// 		return openChannelFeeRequestDto{}, err
// 	}
// 	expiry, err := getOptionalUint32(params, "expiry")
// 	if err != nil {
// 		return openChannelFeeRequestDto{}, err
// 	}
// 	return openChannelFeeRequestDto{
// 		AmountMsat: amountMsat,
// 		Expiry:     expiry,
// 	}, nil
// }

// func toOpenChannelFeeRequest(openChannelFeeRequest openChannelFeeRequestDto) breez_sdk.OpenChannelFeeRequest {
// 	return breez_sdk.OpenChannelFeeRequest{
// 		AmountMsat: openChannelFeeRequest.AmountMsat,
// 		Expiry:     openChannelFeeRequest.Expiry,
// 	}
// }

// func toOpeningFeeParams(openingFeeParams *openingFeeParamsDto) *breez_sdk.OpeningFeeParams {
// 	if openingFeeParams != nil {
// 		return &breez_sdk.OpeningFeeParams{
// 			MinMsat:              openingFeeParams.MinMsat,
// 			Proportional:         openingFeeParams.Proportional,
// 			ValidUntil:           openingFeeParams.ValidUntil,
// 			MaxIdleTime:          openingFeeParams.MaxIdleTime,
// 			MaxClientToSelfDelay: openingFeeParams.MaxClientToSelfDelay,
// 			Promise:              openingFeeParams.Promise,
// 		}
// 	}

// 	return nil
// }

// // func toReceivePaymentRequest(receivePaymentRequest receivePaymentRequestDto) breez_sdk.ReceivePaymentRequest {
// // 	return breez_sdk.ReceivePaymentRequest{
// // 		AmountMsat:  receivePaymentRequest.AmountMsat,
// // 		Description: receivePaymentRequest.Description,
// // 		// Preimage:           receivePaymentRequest.Preimage,
// // 		// OpeningFeeParams:   toOpeningFeeParams(receivePaymentRequest.OpeningFeeParams),
// // 		// UseDescriptionHash: receivePaymentRequest.UseDescriptionHash,
// // 		// Expiry:             receivePaymentRequest.Expiry,
// // 		// Cltv:               receivePaymentRequest.Cltv,
// // 	}
// // }

// func toSendPaymentRequest(sendPaymentRequest sendPaymentRequestDto) breez_sdk.SendPaymentRequest {
// 	return breez_sdk.SendPaymentRequest{
// 		AmountMsat:    sendPaymentRequest.AmountMsat,
// 		UseTrampoline: sendPaymentRequest.UseTrampoline,
// 		Bolt11:        sendPaymentRequest.Bolt11,
// 		Label:         sendPaymentRequest.Label,
// 	}
// }
