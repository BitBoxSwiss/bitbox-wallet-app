// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

const (
	errLightningTopUpClaimFailed  errp.ErrorCode = "lightningTopUpClaimFailed"
	errLightningTopUpRefundFailed errp.ErrorCode = "lightningTopUpRefundFailed"
)

const (
	// Breez SDK rejects static-deposit refund fees below 194 sats.
	// Standard one-input/one-output refunds are at least 99 vbytes, so 2 sat/vByte clears this floor.
	minimumRefundFeeRateSatPerVbyte = 2
)

type topUpRecoveryResult struct {
	TxID         string `json:"txId,omitempty"`
	ClaimOutcome string `json:"claimOutcome,omitempty"`
}

func (lightning *Lightning) recoverableDeposit(paymentID string) (*breez_sdk_spark.DepositInfo, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	if paymentID == "" {
		return nil, errp.New("payment id missing")
	}
	deposits, err := lightning.sdkService.ListUnclaimedDeposits(breez_sdk_spark.ListUnclaimedDepositsRequest{})
	if err != nil {
		return nil, errp.Wrap(err, "breez: list unclaimed deposits")
	}
	for i := range deposits.Deposits {
		deposit := &deposits.Deposits[i]
		matchingPayment := bitcoinDepositPaymentID(*deposit) == paymentID
		pending := isPendingDeposit(*deposit) || isPendingRefund(*deposit)
		if !matchingPayment || !pending {
			continue
		}
		state := bitcoinDepositStateFromSDK(*deposit)
		if state != bitcoinDepositStateUnclaimed && state != bitcoinDepositStateRefundPending {
			return nil, errp.New("deposit is no longer unclaimed")
		}
		return deposit, nil
	}
	return nil, errp.New("unclaimed deposit not found")
}

func requiredClaimFeeSat(claimErrorPtr *breez_sdk_spark.DepositClaimError) (uint64, error) {
	if claimErrorPtr == nil {
		return 0, errp.New("deposit cannot be claimed manually")
	}
	switch claimError := (*claimErrorPtr).(type) {
	case breez_sdk_spark.DepositClaimErrorMaxDepositClaimFeeExceeded:
		return claimError.RequiredFeeSats, nil
	case breez_sdk_spark.DepositClaimErrorGeneric:
		if claimError.Message == "" {
			return 0, errp.New("deposit cannot be claimed manually")
		}
		return 0, errp.New(claimError.Message)
	default:
		return 0, errp.New(bitcoinDepositClaimError(claimErrorPtr))
	}
}

// ClaimTopUp manually claims an unclaimed Bitcoin top-up.
func (lightning *Lightning) ClaimTopUp(paymentID string, approvedFeeSat uint64) (*topUpRecoveryResult, error) {
	deposit, err := lightning.recoverableDeposit(paymentID)
	if err != nil {
		return nil, err
	}
	if deposit.RefundTxId != nil {
		return nil, errp.New("deposit already has a refund")
	}
	feeSat, err := requiredClaimFeeSat(deposit.ClaimError)
	if err != nil {
		return nil, err
	}
	if err := checkApprovedPaymentFee(feeSat, approvedFeeSat); err != nil {
		return nil, err
	}
	maxFee := breez_sdk_spark.MaxFee(breez_sdk_spark.MaxFeeFixed{Amount: feeSat})
	response, err := lightning.sdkService.ClaimDeposit(breez_sdk_spark.ClaimDepositRequest{
		Txid:   deposit.Txid,
		Vout:   deposit.Vout,
		MaxFee: &maxFee,
	})
	// The SDK can update the fee ceiling and deposit state even when claiming fails.
	lightning.notifyListPaymentsReload()
	if err != nil {
		lightning.log.WithError(err).Error("Claim Bitcoin deposit failed")
		return nil, errp.WithMessage(errLightningTopUpClaimFailed, errp.Wrap(err, "breez: claim deposit").Error())
	}
	result := &topUpRecoveryResult{}
	switch outcome := response.Outcome.(type) {
	case breez_sdk_spark.ClaimDepositOutcomeSettled:
		// The SDK can return this outcome before its payment completes.
		switch outcome.Payment.Status {
		case breez_sdk_spark.PaymentStatusCompleted:
			result.ClaimOutcome = "settled"
		case breez_sdk_spark.PaymentStatusPending:
			result.ClaimOutcome = "submitted"
		default:
			return nil, errLightningTopUpClaimFailed
		}
		if outcome.Payment.Details != nil {
			if details, ok := (*outcome.Payment.Details).(breez_sdk_spark.PaymentDetailsDeposit); ok {
				result.TxID = details.TxId
			}
		}
	case breez_sdk_spark.ClaimDepositOutcomeSubmitted:
		result.ClaimOutcome = "submitted"
	case breez_sdk_spark.ClaimDepositOutcomeDeferred:
		result.ClaimOutcome = "deferred"
	default:
		return nil, errp.New("unknown deposit claim outcome")
	}
	return result, nil
}

func (lightning *Lightning) recommendedRefundFeeRate() (uint64, error) {
	recommendedFees, err := lightning.sdkService.RecommendedFees()
	if err != nil {
		return 0, errp.Wrap(err, "breez: recommended fees")
	}
	if recommendedFees.FastestFee == 0 {
		return 0, errp.New("no recommended fee rate available")
	}
	if recommendedFees.FastestFee < minimumRefundFeeRateSatPerVbyte {
		return minimumRefundFeeRateSatPerVbyte, nil
	}
	return recommendedFees.FastestFee, nil
}

func (lightning *Lightning) prepareRefundTopUp(
	paymentID string,
	destinationAccountCode accountsTypes.Code,
) (*breez_sdk_spark.DepositInfo, string, uint64, error) {
	deposit, err := lightning.recoverableDeposit(paymentID)
	if err != nil {
		return nil, "", 0, err
	}
	destinationAddress, err := lightning.onChainDestinationAddress(destinationAccountCode)
	if err != nil {
		return nil, "", 0, err
	}
	feeRate, err := lightning.recommendedRefundFeeRate()
	if err != nil {
		return nil, "", 0, err
	}
	return deposit, destinationAddress, feeRate, nil
}

// RefundTopUp refunds an unclaimed Bitcoin top-up to a Bitcoin account.
func (lightning *Lightning) RefundTopUp(
	paymentID string,
	destinationAccountCode accountsTypes.Code,
	approvedFeeRateSatPerVbyte uint64,
) (*topUpRecoveryResult, error) {
	deposit, destinationAddress, feeRate, err := lightning.prepareRefundTopUp(paymentID, destinationAccountCode)
	if err != nil {
		return nil, err
	}
	if err := checkApprovedPaymentFee(feeRate, approvedFeeRateSatPerVbyte); err != nil {
		return nil, err
	}
	fee := breez_sdk_spark.Fee(breez_sdk_spark.FeeRate{SatPerVbyte: feeRate})
	response, err := lightning.sdkService.RefundDeposit(breez_sdk_spark.RefundDepositRequest{
		Txid:               deposit.Txid,
		Vout:               deposit.Vout,
		DestinationAddress: destinationAddress,
		Fee:                fee,
	})
	// A failed broadcast still leaves a signed refund in the SDK for retrying.
	lightning.notifyListPaymentsReload()
	if err != nil {
		// A newly stored signed refund is accepted and the SDK retries its broadcast during sync.
		// An unchanged refund from an earlier attempt does not establish acceptance of this request.
		deposits, lookupErr := lightning.sdkService.ListUnclaimedDeposits(breez_sdk_spark.ListUnclaimedDepositsRequest{})
		if lookupErr == nil {
			for _, storedDeposit := range deposits.Deposits {
				if bitcoinDepositPaymentID(storedDeposit) == paymentID && storedDeposit.RefundTxId != nil &&
					(deposit.RefundTxId == nil || *storedDeposit.RefundTxId != *deposit.RefundTxId) {
					lightning.log.WithError(err).Warn("Bitcoin deposit refund stored despite SDK error")
					return &topUpRecoveryResult{TxID: *storedDeposit.RefundTxId}, nil
				}
			}
		}
		lightning.log.WithError(err).Error("Refund Bitcoin deposit failed")
		return nil, errp.WithMessage(errLightningTopUpRefundFailed, errp.Wrap(err, "breez: refund deposit").Error())
	}
	return &topUpRecoveryResult{TxID: response.TxId}, nil
}
