// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

func (lightning *Lightning) notifyListPaymentsReload() {
	lightning.Notify(observable.Event{
		Subject: "lightning/list-payments",
		Action:  action.Reload,
	})
}

// NotifyBalanceReload computes the current lightning balance and notifies observers.
func (lightning *Lightning) NotifyBalanceReload() {
	if !lightning.Ready() {
		return
	}

	balance, err := lightning.formattedBalance()
	if err != nil {
		lightning.log.Errorf("failed to compute lightning balance for notification: %v", err)
		return
	}
	lightning.Notify(observable.Event{
		Subject: "lightning/balance",
		Action:  action.Replace,
		Object:  balance,
	})
}

// OnEvent handles Breez SDK events and forwards relevant updates to observers.
func (lightning *Lightning) OnEvent(e breez_sdk_spark.SdkEvent) {
	switch event := e.(type) {
	case breez_sdk_spark.SdkEventSynced:
		// Wallet has been synchronized with the network
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: wallet synchronized with the network")
	case breez_sdk_spark.SdkEventUnclaimedDeposits:
		// SDK was unable to claim some deposits automatically
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: unable to claim some deposits automatically")
	case breez_sdk_spark.SdkEventClaimedDeposits:
		// Deposits were successfully claimed
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: deposits successfully claimed")
	case breez_sdk_spark.SdkEventNewDeposits:
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: new deposits detected")
	case breez_sdk_spark.SdkEventPaymentSucceeded:
		// A payment completed successfully
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: payment completed successfully")
	case breez_sdk_spark.SdkEventPaymentPending:
		// A payment is pending (waiting for confirmation)
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: payment waiting for confirmation")
	case breez_sdk_spark.SdkEventPaymentFailed:
		// A payment failed
		lightning.notifyListPaymentsReload()
		lightning.NotifyBalanceReload()
		lightning.log.Info("Spark: payment failed")
	case breez_sdk_spark.SdkEventLightningAddressChanged:
		lightning.Notify(observable.Event{
			Subject: "lightning/address",
			Action:  action.Replace,
			Object:  lightningAddressString(event.LightningAddress),
		})
		lightning.log.Info("Spark: Lightning address changed")
	default:
		// Handle any future event types
		lightning.log.Infof("Spark event received: %T", e)
	}
}
