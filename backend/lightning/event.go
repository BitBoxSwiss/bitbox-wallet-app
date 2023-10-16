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
	"fmt"

	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
)

// Implementation of breez_sdk.EventListener
// OnEvent receives an event from the sdk and handles it.
func (handlers *Handlers) OnEvent(breezEvent breez_sdk.BreezEvent) {
	handlers.log.Infof("BreezSDK: %#v", breezEvent)

	switch breezEvent.(type) {
	case breez_sdk.BreezEventInvoicePaid, breez_sdk.BreezEventPaymentFailed, breez_sdk.BreezEventPaymentSucceed:
		handlers.Notify(observable.Event{
			Subject: fmt.Sprintf("account/%s/lightning/list-payments", handlers.account.Config().Config.Code),
			Action:  action.Reload,
		})
	case breez_sdk.BreezEventSynced:
		handlers.Notify(observable.Event{
			Subject: fmt.Sprintf("account/%s/lightning/node-info", handlers.account.Config().Config.Code),
			Action:  action.Reload,
		})
	}
}
