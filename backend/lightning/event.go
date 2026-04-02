// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

// OnEvent handles Breez SDK events and forwards relevant updates to observers.
func (lightning *Lightning) OnEvent(e breez_sdk_spark.SdkEvent) {
	switch event := e.(type) {
	case breez_sdk_spark.SdkEventSynced:
		// Wallet has been synchronized with the network
		lightning.log.Infof("Spark: Wallet has been synchronized with the network. Event: %v", e)
	case breez_sdk_spark.SdkEventUnclaimedDeposits:
		// SDK was unable to claim some deposits automatically
		unclaimedDeposits := event.UnclaimedDeposits
		_ = unclaimedDeposits
		lightning.log.Infof("Spark: unable to claim some deposit automatically. Event: %v", e)
	case breez_sdk_spark.SdkEventClaimedDeposits:
		// Deposits were successfully claimed
		claimedDeposits := event.ClaimedDeposits
		_ = claimedDeposits
		lightning.log.Infof("Spark: deposit successfully claimed. Event: %v", e)
	case breez_sdk_spark.SdkEventPaymentSucceeded:
		// A payment completed successfully
		payment := event.Payment
		_ = payment

		lightning.Notify(observable.Event{
			Subject: "lightning/list-payments",
			Action:  action.Reload,
		})
		lightning.log.Infof("Spark: payment completed successfully. Event: %v", e)
	case breez_sdk_spark.SdkEventPaymentPending:
		// A payment is pending (waiting for confirmation)
		pendingPayment := event.Payment
		_ = pendingPayment
		lightning.Notify(observable.Event{
			Subject: "lightning/list-payments",
			Action:  action.Reload,
		})
		lightning.log.Infof("Spark: payment waiting for confirmation. Event: %v", e)
	case breez_sdk_spark.SdkEventPaymentFailed:
		// A payment failed
		failedPayment := event.Payment
		_ = failedPayment
		lightning.Notify(observable.Event{
			Subject: "lightning/list-payments",
			Action:  action.Reload,
		})
		lightning.log.Infof("Spark: payment failed. Event: %v", e)
	default:
		// Handle any future event types
		lightning.log.Infof("Spark event: %v", e)
	}
}
