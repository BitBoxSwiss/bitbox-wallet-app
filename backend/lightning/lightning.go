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
	"encoding/hex"
	"os"
	"path"
	"strings"

	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
	"github.com/tyler-smith/go-bip39"
)

// Lightning manages the Breez SDK lightning node.
type Lightning struct {
	observable.Implementation

	config             *config.Config
	cacheDirectoryPath string
	getKeystore        func() keystore.Keystore
	synced             bool

	log        *logrus.Entry
	sdkService *breez_sdk.BlockingBreezServices
}

// NewLightning creates a new instance of the Lightning struct.
func NewLightning(config *config.Config, cacheDirectoryPath string, getKeystore func() keystore.Keystore) *Lightning {
	return &Lightning{
		config:             config,
		cacheDirectoryPath: cacheDirectoryPath,
		getKeystore:        getKeystore,
		log:                logging.Get().WithGroup("lightning"),
		synced:             false,
	}
}

// Activate first creates a mnemonic from the keystore entropy then connects to instance.
func (lightning *Lightning) Activate() error {
	lightningConfig := lightning.config.LightningConfig()

	if !lightningConfig.Inactive {
		return errp.New("Lightning node already active")
	}

	if len(lightningConfig.Accounts) > 0 {
		return errp.New("Lightning accounts already configured")
	}

	keystore := lightning.getKeystore()
	if keystore == nil || !keystore.SupportsDeterministicEntropy() {
		return errp.New("No keystore available")
	}

	entropy, err := keystore.DeterministicEntropy()
	if err != nil {
		return err
	}

	fingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}

	entropyMnemonic, err := bip39.NewMnemonic(entropy)
	if err != nil {
		lightning.log.WithError(err).Warn("Error generating mnemonic")
		return errp.New("Error generating mnemonic")
	}

	lightningAccount := config.LightningAccountConfig{
		Mnemonic:        entropyMnemonic,
		RootFingerprint: fingerprint,
		Code:            types.Code(strings.Join([]string{"v0-", hex.EncodeToString(fingerprint), "-ln-0"}, "")),
		Number:          0,
	}
	lightningConfig.Inactive = false
	lightningConfig.Accounts = append(lightningConfig.Accounts, &lightningAccount)

	if err = lightning.setLightningConfig(lightningConfig); err != nil {
		return err
	}

	go lightning.connect()

	return nil
}

// Connect needs to be called before any requests are made.
func (lightning *Lightning) Connect() {
	go lightning.connect()
}

// Disconnect closes an active Breez SDK instance. After this, no requests should be made.
func (lightning *Lightning) Disconnect() {
	if lightning.sdkService != nil {
		if err := lightning.sdkService.Disconnect(); err != nil {
			lightning.log.WithError(err).Warn("BreezSDK: Error disconnecting SDK")
		}

		lightning.sdkService.Destroy()
		lightning.sdkService = nil
		lightning.synced = false
	}
}

// Deactivate disconnects the instance and changes the config to inactive.
func (lightning *Lightning) Deactivate() error {
	lightningConfig := lightning.config.LightningConfig()

	if lightningConfig.Inactive {
		return nil
	}

	lightning.Disconnect()

	lightningConfig.Inactive = true
	lightningConfig.Accounts = []*config.LightningAccountConfig{}

	if err := lightning.setLightningConfig(lightningConfig); err != nil {
		return err
	}

	return nil
}

func accountBreezFolder(accountCode types.Code) string {
	return strings.Join([]string{"breez-", string(accountCode)}, "")
}

// connect initializes the connection configuration and calls connect to create a Breez SDK instance.
func (lightning *Lightning) connect() {
	lightningConfig := lightning.config.LightningConfig()

	if !lightningConfig.Inactive && len(lightningConfig.Accounts) > 0 && lightning.sdkService == nil {
		initializeLogging(lightning.log)

		// At the moment we only support one LN account, but the config files could possibly
		// support multiple accounts, for future extensions.
		account := lightningConfig.Accounts[0]

		// TODO: this seed should be determined from the account/device.
		seed, err := breez_sdk.MnemonicToSeed(account.Mnemonic)

		if err != nil {
			lightning.log.WithError(err).Warn("BreezSDK: MnemonicToSeed failed")
			return
		}

		nodeConfig := breez_sdk.NodeConfigGreenlight{
			Config: breez_sdk.GreenlightNodeConfig{
				PartnerCredentials: nil,
				InviteCode:         nil,
			},
		}

		workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))

		if err := os.MkdirAll(workingDir, 0700); err != nil {
			lightning.log.WithError(err).Warn("Error creating working directory")
			return
		}

		config := breez_sdk.DefaultConfig(breez_sdk.EnvironmentTypeProduction, "", nodeConfig)
		config.WorkingDir = workingDir
		sdkService, err := breez_sdk.Connect(config, seed, lightning)

		if err != nil {
			lightning.log.WithError(err).Warn("BreezSDK: Error connecting SDK")
			return
		}

		lightning.sdkService = sdkService
	}
}

func (lightning *Lightning) setLightningConfig(config config.LightningConfig) error {
	if err := lightning.config.SetLightningConfig(config); err != nil {
		lightning.log.WithError(err).Warn("Error updating lightning config")
		return errp.New("Error updating lightning config")
	}

	lightning.Notify(observable.Event{
		Subject: "lightning/config",
		Action:  action.Reload,
	})

	return nil
}
