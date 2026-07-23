// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"

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
	breezApiKeyUrl            = "https://bitboxapp.shiftcrypto.dev/lightning/breez-api-key"
	encryptedMnemonicV1Prefix = "v1:"
	lnurlDomainDev            = "lnurl.shiftcrypto.dev"
	// Temporarily use the development LNURL server until the production domain is available.
	// lnurlDomainProd = "bitbox.pay"
	lnurlDomainProd = lnurlDomainDev
)

// Keep this local to avoid importing backend.Environment and creating a package cycle.
type environment interface {
	CanEncryptLightningMnemonic() bool
	StoreLightningEncryptionKey(accountCode string, encryptionKey string) error
	LoadLightningEncryptionKey(accountCode string) (string, error)
	DeleteLightningEncryptionKey(accountCode string) error
}

type breezSDK interface {
	Disconnect() error
	Destroy()
	GetInfo(breez_sdk_spark.GetInfoRequest) (breez_sdk_spark.GetInfoResponse, error)
	GetLightningAddress() (*breez_sdk_spark.LightningAddressInfo, error)
	CheckLightningAddressAvailable(breez_sdk_spark.CheckLightningAddressRequest) (bool, error)
	RegisterLightningAddress(breez_sdk_spark.RegisterLightningAddressRequest) (breez_sdk_spark.LightningAddressInfo, error)
	Parse(string) (breez_sdk_spark.InputType, error)
	PrepareSendPayment(breez_sdk_spark.PrepareSendPaymentRequest) (breez_sdk_spark.PrepareSendPaymentResponse, error)
	PrepareLnurlPay(breez_sdk_spark.PrepareLnurlPayRequest) (breez_sdk_spark.PrepareLnurlPayResponse, error)
	SendPayment(breez_sdk_spark.SendPaymentRequest) (breez_sdk_spark.SendPaymentResponse, error)
	LnurlPay(breez_sdk_spark.LnurlPayRequest) (breez_sdk_spark.LnurlPayResponse, error)
	ReceivePayment(breez_sdk_spark.ReceivePaymentRequest) (breez_sdk_spark.ReceivePaymentResponse, error)
	ListPayments(breez_sdk_spark.ListPaymentsRequest) (breez_sdk_spark.ListPaymentsResponse, error)
	ListUnclaimedDeposits(breez_sdk_spark.ListUnclaimedDepositsRequest) (breez_sdk_spark.ListUnclaimedDepositsResponse, error)
}

// Lightning manages the Breez SDK Spark integration.
type Lightning struct {
	observable.Implementation

	backendConfig      *config.Config
	cacheDirectoryPath string
	environment        environment
	getKeystore        func() keystore.Keystore
	getAccount         func(types.Code) (accounts.Interface, error)
	synced             bool

	log          *logrus.Entry
	sdkService   breezSDK
	sparkStatus  func() (breez_sdk_spark.SparkStatus, error)
	httpClient   *http.Client
	ratesUpdater *rates.RateUpdater
	btcCoin      coin.Coin
	devServers   bool

	// Serializes lazy lightning address registration.
	lightningAddressLock sync.Mutex
}

// NewLightning creates a new instance of the Lightning struct.
func NewLightning(config *config.Config,
	cacheDirectoryPath string,
	environment environment,
	getKeystore func() keystore.Keystore,
	getAccount func(types.Code) (accounts.Interface, error),
	httpClient *http.Client,
	ratesUpdater *rates.RateUpdater,
	btcCoin coin.Coin,
	devServers bool) *Lightning {
	return &Lightning{
		backendConfig:      config,
		cacheDirectoryPath: cacheDirectoryPath,
		environment:        environment,
		getKeystore:        getKeystore,
		getAccount:         getAccount,
		log:                logging.Get().WithGroup("lightning"),
		synced:             false,
		sparkStatus:        breez_sdk_spark.GetSparkStatus,
		httpClient:         httpClient,
		ratesUpdater:       ratesUpdater,
		btcCoin:            btcCoin,
		devServers:         devServers,
	}
}

// Activate first creates a mnemonic from the keystore entropy, persists it, and connects to the
// instance.
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

	accountCode := types.Code(strings.Join([]string{"v0-", hex.EncodeToString(fingerprint), "-ln-0"}, ""))
	sealedMnemonic, err := lightning.sealMnemonic(string(accountCode), entropyMnemonic)
	if err != nil {
		lightning.log.WithError(err).Warn("Error configuring Lightning secure storage")
		return errp.New("Could not configure Lightning secure storage on this device")
	}

	lightningAccount := config.LightningAccountConfig{
		Seed:            sealedMnemonic,
		RootFingerprint: fingerprint,
		Code:            accountCode,
		Number:          0,
	}
	if err = lightning.SetAccount(&lightningAccount); err != nil {
		if lightning.environment.CanEncryptLightningMnemonic() {
			if deleteErr := lightning.environment.DeleteLightningEncryptionKey(string(accountCode)); deleteErr != nil {
				lightning.log.WithError(deleteErr).Warn("Error deleting lightning encryption key after activation failure")
			}
		}
		return err
	}

	if err = lightning.connect(); err != nil {
		if deactivateErr := lightning.Deactivate(); deactivateErr != nil {
			lightning.log.Error(deactivateErr)
		}
		return err
	}

	return nil
}

// Connect needs to be called before any requests are made.
func (lightning *Lightning) Connect() {
	if err := lightning.connect(); err != nil {
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
		lightning.notifyReady()
	}
}

// Deactivate changes the config to inactive, disconnects the instance and deletes the cache folder.
func (lightning *Lightning) Deactivate() error {
	account := lightning.Account()

	if account == nil {
		return nil
	}

	if err := lightning.SetAccount(nil); err != nil {
		return err
	}

	lightning.Disconnect()
	workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))
	if err := os.RemoveAll(workingDir); err != nil {
		lightning.log.WithError(err).Error("Error deleting working directory")
	}

	if lightning.environment.CanEncryptLightningMnemonic() {
		if err := lightning.environment.DeleteLightningEncryptionKey(string(account.Code)); err != nil {
			lightning.log.WithError(err).Warn("Error deleting lightning encryption key")
		}
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

// Ready returns true if the lightning account is configured and the SDK is connected.
func (lightning *Lightning) Ready() bool {
	return lightning.Account() != nil && lightning.sdkService != nil
}

func (lightning *Lightning) notifyReady() {
	lightning.Notify(observable.Event{
		Subject: "lightning/ready",
		Action:  action.Replace,
		Object:  lightning.Ready(),
	})
}

func (lightning *Lightning) availableBalance() (coin.Amount, error) {
	if err := lightning.CheckActive(); err != nil {
		return coin.Amount{}, err
	}

	ensureSynced := false
	info, err := lightning.sdkService.GetInfo(breez_sdk_spark.GetInfoRequest{
		// EnsureSynced: true will ensure the SDK is synced with the Spark network
		// before returning the balance
		EnsureSynced: &ensureSynced,
	})
	if err != nil {
		return coin.Amount{}, errp.Wrap(err, "breez: get info")
	}
	return coin.NewAmountFromInt64(int64(info.BalanceSats)), nil
}

// Balance returns the balance of the lightning account.
func (lightning *Lightning) Balance() (*accounts.Balance, error) {
	available, err := lightning.availableBalance()
	if err != nil {
		return nil, err
	}

	deposits, err := lightning.sdkService.ListUnclaimedDeposits(breez_sdk_spark.ListUnclaimedDepositsRequest{})
	if err != nil {
		return nil, errp.Wrap(err, "breez: list unclaimed deposits")
	}

	return accounts.NewBalance(available, lightning.unclaimedDepositsAmount(deposits.Deposits)), nil
}

// SparkStatus is the operational status of the Spark network.
type SparkStatus struct {
	// Status represents the current status.
	Status string `json:"status"`
}

func serviceStatus(status breez_sdk_spark.ServiceStatus) string {
	switch status {
	case breez_sdk_spark.ServiceStatusOperational:
		return "operational"
	case breez_sdk_spark.ServiceStatusDegraded:
		return "degraded"
	case breez_sdk_spark.ServiceStatusPartial:
		return "partial"
	case breez_sdk_spark.ServiceStatusMajor:
		return "major"
	default:
		return "unknown"
	}
}

// SparkStatus queries the Spark service and returns the current Spark network status.
// It returns an error if the Breez SDK status request fails. Tests can override the status request
// through the Lightning.sparkStatus field.
func (lightning *Lightning) SparkStatus() (*SparkStatus, error) {
	getSparkStatus := lightning.sparkStatus
	if getSparkStatus == nil {
		getSparkStatus = breez_sdk_spark.GetSparkStatus
	}
	status, err := getSparkStatus()
	if err != nil {
		return nil, errp.Wrap(err, "breez: get spark status")
	}
	return &SparkStatus{
		Status: serviceStatus(status.Status),
	}, nil
}

func accountBreezFolder(accountCode types.Code) string {
	return strings.Join([]string{"breez-", string(accountCode)}, "")
}

// connect initializes the connection configuration and calls connect to create a Breez SDK instance.
func (lightning *Lightning) connect() error {
	account := lightning.Account()

	if account != nil && lightning.sdkService == nil {
		initializeLogging(lightning.log)

		workingDir := path.Join(lightning.cacheDirectoryPath, accountBreezFolder(account.Code))

		if err := os.MkdirAll(workingDir, 0700); err != nil {
			lightning.log.WithError(err).Error("Error creating working directory")
			return err
		}

		mnemonic, err := lightning.unsealMnemonic(account)
		if err != nil {
			lightning.log.WithError(err).Warn("Error unlocking Lightning mnemonic")
			return errp.New("Error unlocking Lightning mnemonic from the device")
		}

		// Construct the seed using mnemonic words or entropy bytes
		var seed breez_sdk_spark.Seed = breez_sdk_spark.SeedMnemonic{
			Mnemonic:   mnemonic,
			Passphrase: nil,
		}

		apiKey, err := lightning.getBreezApiKey()
		if err != nil {
			return err
		}

		// Create the default config
		config := breez_sdk_spark.DefaultConfig(breez_sdk_spark.NetworkMainnet)
		config.ApiKey = apiKey
		lnurlDomainConfig := lightning.lnurlDomain()
		config.LnurlDomain = &lnurlDomainConfig
		// It should already default to true, but we force it just in case.
		config.PrivateEnabledDefault = true
		// Set the maximum fee to the fastest network recommended fee at the time of claim
		// with a leeway of 1 sats/vbyte
		networkRecommendedInterface := breez_sdk_spark.MaxFee(
			breez_sdk_spark.MaxFeeNetworkRecommended{LeewaySatPerVbyte: 1},
		)
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
		lightning.notifyReady()
		lightning.NotifyBalanceReload()
		if _, err := lightning.ensureLightningAddress(); err != nil {
			lightning.log.WithError(err).Warn("BreezSDK: Error ensuring lightning address")
		}
	}
	return nil
}

func (lightning *Lightning) lnurlDomain() string {
	if lightning.devServers {
		return lnurlDomainDev
	}
	return lnurlDomainProd
}

func (lightning *Lightning) sealMnemonic(accountCode string, mnemonic string) (string, error) {
	if !lightning.environment.CanEncryptLightningMnemonic() {
		return mnemonic, nil
	}

	encryptionKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, encryptionKey); err != nil {
		return "", err
	}

	sealedMnemonic, err := encryptMnemonic(mnemonic, encryptionKey)
	if err != nil {
		return "", err
	}

	if err := lightning.environment.StoreLightningEncryptionKey(
		accountCode,
		base64.StdEncoding.EncodeToString(encryptionKey),
	); err != nil {
		return "", err
	}

	return sealedMnemonic, nil
}

func (lightning *Lightning) unsealMnemonic(account *config.LightningAccountConfig) (string, error) {
	if !lightning.environment.CanEncryptLightningMnemonic() {
		return account.Seed, nil
	}

	encryptionKeyBase64, err := lightning.environment.LoadLightningEncryptionKey(string(account.Code))
	if err != nil {
		return "", err
	}

	encryptionKey, err := base64.StdEncoding.DecodeString(encryptionKeyBase64)
	if err != nil {
		return "", err
	}

	mnemonic, err := decryptMnemonic(account.Seed, encryptionKey)
	if err != nil {
		return "", err
	}

	return mnemonic, nil
}

func encryptMnemonic(mnemonic string, encryptionKey []byte) (string, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(mnemonic), nil)
	return encryptedMnemonicV1Prefix + base64.StdEncoding.EncodeToString(append(nonce, ciphertext...)), nil
}

func decryptMnemonic(sealedMnemonic string, encryptionKey []byte) (string, error) {
	encodedCiphertext, ok := strings.CutPrefix(sealedMnemonic, encryptedMnemonicV1Prefix)
	if !ok {
		return "", errp.New("unsupported encrypted mnemonic format")
	}
	rawCiphertext, err := base64.StdEncoding.DecodeString(encodedCiphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(rawCiphertext) < gcm.NonceSize() {
		return "", errp.New("ciphertext too short")
	}
	nonce := rawCiphertext[:gcm.NonceSize()]
	ciphertext := rawCiphertext[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
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
	lightning.notifyReady()

	return nil
}
