// Copyright 2018 Shift Devices AG
// Copyright 2023 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package lightning

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-go/breez_sdk"
)

// OnEvent receives an event from the sdk and handles it.
// Implementation of breez_sdk.EventListener.
func (lightning *Lightning) OnEvent(breezEvent breez_sdk.BreezEvent) {
	lightning.log.Infof("BreezSDK: %#v", breezEvent)

	switch breezEvent.(type) {
	case breez_sdk.BreezEventInvoicePaid, breez_sdk.BreezEventPaymentFailed, breez_sdk.BreezEventPaymentSucceed:
		lightning.Notify(observable.Event{
			Subject: "lightning/list-payments",
			Action:  action.Reload,
		})
	case breez_sdk.BreezEventSynced:
		lightning.Notify(observable.Event{
			Subject: "lightning/node-info",
			Action:  action.Reload,
		})
	}
}
