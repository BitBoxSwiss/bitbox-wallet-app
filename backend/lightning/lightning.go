// SPDX-License-Identifier: Apache-2.0

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
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/sirupsen/logrus"
	"github.com/tyler-smith/go-bip39"
)

const (
	breezApiKeyUrl = "https://bitboxapp.shiftcrypto.dev/lightning/breez-api-key"
)

// Lightning manages the Breez SDK lightning node.
type Lightning struct {
	observable.Implementation

	backendConfig      *config.Config
	cacheDirectoryPath string
	getKeystore        func() keystore.Keystore
	synced             bool

	log          *logrus.Entry
	sdkService   *breez_sdk_spark.BreezSdk
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
	if lightning.Account() != nil {
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
	if err = lightning.SetAccount(&lightningAccount); err != nil {
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
	account := lightning.Account()

	if account == nil {
		return nil
	}

	lightning.Disconnect()
	workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))
	if err := os.RemoveAll(workingDir); err != nil {
		lightning.log.WithError(err).Error("Error deleting working directory")
	}

	if err := lightning.SetAccount(nil); err != nil {
		return err
	}

	return nil
}

// CheckActive returns an error if the lightning service has not been activated.
func (lightning *Lightning) CheckActive() error {
	if lightning.Account() == nil || lightning.sdkService == nil {
		return errp.New("Lightning not initialized")
	}
	return nil
}

// Balance returns the balance of the lightning account.
func (lightning *Lightning) Balance() (*accounts.Balance, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	ensureSynced := false
	info, err := lightning.sdkService.GetInfo(breez_sdk_spark.GetInfoRequest{
		// EnsureSynced: true will ensure the SDK is synced with the Spark network
		// before returning the balance
		EnsureSynced: &ensureSynced,
	})

	if err != nil {
		return nil, err
	}

	balanceSats := info.BalanceSats

	amount := coin.NewAmountFromInt64(int64(balanceSats))
	return accounts.NewBalance(amount, coin.Amount{}), nil
}

func accountBreezFolder(accountCode types.Code) string {
	return strings.Join([]string{"breez-", string(accountCode)}, "")
}

// connect initializes the connection configuration and calls connect to create a Breez SDK instance.
func (lightning *Lightning) connect(_ bool) error {
	account := lightning.Account()

	if account != nil && lightning.sdkService == nil {
		initializeLogging(lightning.log)

		workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))

		if err := os.MkdirAll(workingDir, 0700); err != nil {
			lightning.log.WithError(err).Error("Error creating working directory")
			return err
		}

		// Construct the seed using mnemonic words or entropy bytes
		var seed breez_sdk_spark.Seed = breez_sdk_spark.SeedMnemonic{
			Mnemonic:   account.Mnemonic,
			Passphrase: nil,
		}

		apiKey, err := lightning.getBreezApiKey()
		if err != nil {
			return err
		}

		// Create the default config
		config := breez_sdk_spark.DefaultConfig(breez_sdk_spark.NetworkMainnet)
		config.ApiKey = apiKey
		// It should already default to true, but we force it just in case.
		config.PrivateEnabledDefault = true
		// Set the maximum fee to the fastest network recommended fee at the time of claim
		// with a leeway of 1 sats/vbyte
		networkRecommendedInterface := breez_sdk_spark.MaxFee(breez_sdk_spark.MaxFeeNetworkRecommended{LeewaySatPerVbyte: 1})
		config.MaxDepositClaimFee = &networkRecommendedInterface

		connectRequest := breez_sdk_spark.ConnectRequest{
			Config:     config,
			Seed:       seed,
			StorageDir: workingDir,
		}

		// Connect to the SDK using the simplified connect method
		sdk, err := breez_sdk_spark.Connect(connectRequest)
		if err != nil {
			lightning.log.WithError(err).Error("BreezSDK: Error connecting SDK")
			return err
		}

		sdk.AddEventListener(lightning)
		initializeLogging(lightning.log)
		_, err = sdk.SyncWallet(breez_sdk_spark.SyncWalletRequest{})
		if err != nil {
			lightning.log.WithError(err).Error("BreezSDK: Error connecting SDK")
			if err := sdk.Disconnect(); err != nil {
				lightning.log.WithError(err).Warn("BreezSDK: Error disconnecting SDK")
			}
			sdk.Destroy()
			return err
		}

		lightning.sdkService = sdk
	}
	return nil
}

func (lightning *Lightning) getBreezApiKey() (*string, error) {
	_, breezApiKey, err := util.HTTPGet(lightning.httpClient, breezApiKeyUrl, "", int64(4096))
	if err != nil {
		lightning.log.WithError(err).Error("Breez api key fetch failed")
		return nil, err
	}

	// fetched key could have an unwanted newline, we'll just trim invalid chars for safety.
	trimmedKey := strings.TrimSpace(string(breezApiKey))

	return &trimmedKey, nil
}

// Account returns the active lightning account, if any.
func (lightning *Lightning) Account() *config.LightningAccountConfig {
	lightningConfig := lightning.backendConfig.LightningConfig()
	if len(lightningConfig.Accounts) == 0 {
		return nil
	}
	// The config keeps a slice for forward compatibility with future multi-account support,
	// but the current backend only exposes and operates on the first configured account.
	return lightningConfig.Accounts[0]
}

// SetAccount updates the active lightning account and notifies about the config change.
func (lightning *Lightning) SetAccount(account *config.LightningAccountConfig) error {
	if err := lightning.backendConfig.ModifyLightningConfig(func(cfg *config.LightningConfig) error {
		cfg.Accounts = []*config.LightningAccountConfig{}
		if account != nil {
			accountCopy := *account
			cfg.Accounts = []*config.LightningAccountConfig{&accountCopy}
		}
		return nil
	}); err != nil {
		lightning.log.WithError(err).Warn("Error updating lightning config")
		return errp.New("Error updating lightning config")
	}

	lightning.Notify(observable.Event{
		Subject: "lightning/account",
		Action:  action.Reload,
	})

	return nil
}
