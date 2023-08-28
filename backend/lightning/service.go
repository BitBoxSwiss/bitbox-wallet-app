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
	"github.com/breez/breez-sdk-go/breez_sdk"
)

// connect initializes the connection configuration and calls connect to create a Breez SDK instance.
func (handlers *Handlers) connect() {
	if handlers.sdkService == nil {
		initializeLogging(handlers.log)

		// TODO: this seed should be determined from the account/device.
		seed, err := breez_sdk.MnemonicToSeed("cruise clever syrup coil cute execute laundry general cover prevent law sheriff")

		if err != nil {
			handlers.log.WithError(err).Warn("BreezSDK: MnemonicToSeed failed")
			return
		}

		nodeConfig := breez_sdk.NodeConfigGreenlight{
			Config: breez_sdk.GreenlightNodeConfig{
				PartnerCredentials: nil,
				InviteCode:         nil,
			},
		}

		workingDir, err := ensurePath(handlers.account)

		if err != nil {
			handlers.log.WithError(err).Warn("BreezSDK: Error ensuring working directory")
			return
		}

		config := breez_sdk.DefaultConfig(breez_sdk.EnvironmentTypeStaging, "", nodeConfig)
		config.WorkingDir = *workingDir
		sdkService, err := breez_sdk.Connect(config, seed, handlers)

		if err != nil {
			handlers.log.WithError(err).Warn("BreezSDK: Error connecting SDK")
			return
		}

		handlers.sdkService = sdkService
	}
}

// disconnect closes an active Breez SDK instance.
func (handlers *Handlers) disconnect() {
	if handlers.sdkService != nil {
		if err := handlers.sdkService.Disconnect(); err != nil {
			handlers.log.WithError(err).Warn("BreezSDK: Error disconnecting SDK")
		}

		handlers.sdkService.Destroy()
		handlers.sdkService = nil
		handlers.synced = false
	}
}
