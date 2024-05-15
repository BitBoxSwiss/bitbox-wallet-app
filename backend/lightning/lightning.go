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
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/sirupsen/logrus"
	"github.com/tyler-smith/go-bip39"
)

const (
	breezApiKeyUrl    = "https://bitboxapp.shiftcrypto.io/lightning/breez-api-key"
	greenLightCertUrl = "https://bitboxapp.shiftcrypto.io/lightning/greenlight.crt"
	greenLightKeyUrl  = "https://bitboxapp.shiftcrypto.io/lightning/greenlight-key.pem"
)

// Lightning manages the Breez SDK lightning node.
type Lightning struct {
	observable.Implementation

	backendConfig      *config.Config
	cacheDirectoryPath string
	getKeystore        func() keystore.Keystore
	synced             bool

	log          *logrus.Entry
	sdkService   *breez_sdk.BlockingBreezServices
	httpClient   *http.Client
	ratesUpdater *rates.RateUpdater
	btcCoin      coin.Coin
}

// NewLightning creates a new instance of the Lightning struct.
func NewLightning(config *config.Config,
	cacheDirectoryPath string,
	getKeystore func() keystore.Keystore,
	httpClient *http.Client,
	ratesUpdater *rates.RateUpdater,
	btcCoin coin.Coin) *Lightning {
	return &Lightning{
		backendConfig:      config,
		cacheDirectoryPath: cacheDirectoryPath,
		getKeystore:        getKeystore,
		log:                logging.Get().WithGroup("lightning"),
		synced:             false,
		httpClient:         httpClient,
		ratesUpdater:       ratesUpdater,
		btcCoin:            btcCoin,
	}
}

// Activate first creates a mnemonic from the keystore entropy then connects to instance.
func (lightning *Lightning) Activate() error {
	lightningConfig := lightning.backendConfig.LightningConfig()

	if len(lightningConfig.Accounts) > 0 {
		return errp.New("Lightning accounts already configured")
	}

	keystore := lightning.getKeystore()
	if keystore == nil || !keystore.SupportsDeterministicEntropy() {
		return errp.New("No keystore available, or firmware out of date")
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
	lightningConfig.Accounts = append(lightningConfig.Accounts, &lightningAccount)

	if err = lightning.setLightningConfig(lightningConfig); err != nil {
		return err
	}

	if err = lightning.connect(true); err != nil {
		if deactivateErr := lightning.Deactivate(); deactivateErr != nil {
			lightning.log.Error(deactivateErr)
		}
		return err
	}

	return nil
}

// Connect needs to be called before any requests are made.
func (lightning *Lightning) Connect() {
	if err := lightning.connect(false); err != nil {
		lightning.log.WithError(err).Warn("BreezSDK: Error connecting SDK")
	}
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

// Deactivate disconnects the instance, deletes cache folder and changes the config to inactive.
func (lightning *Lightning) Deactivate() error {
	lightningConfig := lightning.backendConfig.LightningConfig()

	if len(lightningConfig.Accounts) == 0 {
		return nil
	}

	account := lightningConfig.Accounts[0]
	workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))
	if err := os.RemoveAll(workingDir); err != nil {
		lightning.log.WithError(err).Error("Error deleting working directory")
	}

	lightning.Disconnect()

	lightningConfig.Accounts = []*config.LightningAccountConfig{}

	if err := lightning.setLightningConfig(lightningConfig); err != nil {
		return err
	}

	return nil
}

// CheckActive returns an error if the lightning service not has been activated.
func (lightning *Lightning) CheckActive() error {
	lightningConfig := lightning.backendConfig.LightningConfig()
	if len(lightningConfig.Accounts) == 0 || lightning.sdkService == nil {
		return errp.New("Lightning not initialized")
	}
	return nil
}

// Balance returns the balance of the lightning account.
func (lightning *Lightning) Balance() (*accounts.Balance, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	nodeInfo, err := lightning.sdkService.NodeInfo()
	if err != nil {
		return nil, err
	}

	amount := coin.NewAmountFromInt64(int64(nodeInfo.ChannelsBalanceMsat / 1000))
	return accounts.NewBalance(amount, coin.Amount{}), nil
}

func accountBreezFolder(accountCode types.Code) string {
	return strings.Join([]string{"breez-", string(accountCode)}, "")
}

// connect initializes the connection configuration and calls connect to create a Breez SDK instance.
func (lightning *Lightning) connect(registerNode bool) error {
	lightningConfig := lightning.backendConfig.LightningConfig()

	if len(lightningConfig.Accounts) > 0 && lightning.sdkService == nil {
		initializeLogging(lightning.log)

		// At the moment we only support one LN account, but the config files could possibly
		// support multiple accounts, for future extensions.
		account := lightningConfig.Accounts[0]

		seed, err := breez_sdk.MnemonicToSeed(account.Mnemonic)
		if err != nil {
			lightning.log.WithError(err).Error("BreezSDK: MnemonicToSeed failed")
			return err
		}

		var greenlightCredentials *breez_sdk.GreenlightCredentials
		if registerNode {
			_, deviceKey, err := util.HTTPGet(lightning.httpClient, greenLightKeyUrl, "", int64(4096))
			if err != nil {
				lightning.log.WithError(err).Error("Greenlight key fetch failed")
				return err
			}

			_, deviceCert, err := util.HTTPGet(lightning.httpClient, greenLightCertUrl, "", int64(4096))
			if err != nil {
				lightning.log.WithError(err).Error("Greenlight cert fetch failed")
				return err
			}

			greenlightCredentials = &breez_sdk.GreenlightCredentials{
				DeviceKey:  deviceKey,
				DeviceCert: deviceCert,
			}
		}

		nodeConfig := breez_sdk.NodeConfigGreenlight{
			Config: breez_sdk.GreenlightNodeConfig{
				PartnerCredentials: greenlightCredentials,
				InviteCode:         nil,
			},
		}

		workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))

		if err := os.MkdirAll(workingDir, 0700); err != nil {
			lightning.log.WithError(err).Error("Error creating working directory")
			return err
		}

		_, breezApiKey, err := util.HTTPGet(lightning.httpClient, breezApiKeyUrl, "", int64(4096))
		if err != nil {
			lightning.log.WithError(err).Error("Breez api key fetch failed")
			return err
		}

		// fetched key could have an unwanted newline, we'll just trim invalid chars for safety.
		trimmedKey := strings.TrimSpace(string(breezApiKey))

		config := breez_sdk.DefaultConfig(breez_sdk.EnvironmentTypeProduction, trimmedKey, nodeConfig)
		config.WorkingDir = workingDir

		connectRequest := breez_sdk.ConnectRequest{
			Config: config,
			Seed:   seed,
		}
		sdkService, err := breez_sdk.Connect(connectRequest, lightning)
		if err != nil {
			lightning.log.WithError(err).Error("BreezSDK: Error connecting SDK")
			return err
		}

		lightning.sdkService = sdkService
	}
	return nil
}

func (lightning *Lightning) setLightningConfig(config config.LightningConfig) error {
	if err := lightning.backendConfig.SetLightningConfig(config); err != nil {
		lightning.log.WithError(err).Warn("Error updating lightning config")
		return errp.New("Error updating lightning config")
	}

	lightning.Notify(observable.Event{
		Subject: "lightning/config",
		Action:  action.Reload,
	})

	return nil
}
