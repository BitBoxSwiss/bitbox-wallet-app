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

package types

import (
	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
)

const (
	// EventLightningInvoicePaid is fired by the Breez SDK when an invoice is paid.
	EventLightningInvoicePaid accountsTypes.Event = "lightningInvoicePaid"

	// EventLightningPaymentFailed is fired by the Breez SDK when a payment is attempted and fails.
	EventLightningPaymentFailed accountsTypes.Event = "lightningPaymentFailed"

	// EventLightningPaymentSucceed is fired by the Breez SDK when a payment is attempted and succeeds.
	EventLightningPaymentSucceed accountsTypes.Event = "lightningPaymentSucceed"

	// EventLightningSynced is fired when Breez SDK is synced.
	EventLightningSynced accountsTypes.Event = "lightningSynced"
)
