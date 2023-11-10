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
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/sirupsen/logrus"
)

// Lightning manages the Breez SDK lightning node.
type Lightning struct {
	observable.Implementation

	cacheDirectoryPath string
	synced             bool

	log        *logrus.Entry
	sdkService *breez_sdk.BlockingBreezServices
}

func NewLightning(cacheDirectoryPath string) *Lightning {
	return &Lightning{
		cacheDirectoryPath: cacheDirectoryPath,
		log:                logging.Get().WithGroup("lightning"),
		synced:             false,
	}
}

// This needs to be called before any requests are made.
func (lightning *Lightning) Init() {
	// TODO: check the config and connect if active.
	go lightning.connect()
}

// Uninit disconnects from the SDK. After this, no requests should be made.
func (lightning *Lightning) Uninit() {
	// Disconnect the SDK.
	lightning.disconnect()
}
