// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"encoding/hex"
	"math/big"
	"net/http"
	"os"
	"path"
	"strconv"
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

// CheckActive returns an error if the lightning service not has been activated.
func (lightning *Lightning) CheckActive() error {
	if lightning.Account() == nil || lightning.sdkService == nil {
		return errp.New("Lightning not initialized")
	}
	return nil
}

// ParseInput validates and classifies a lightning input string.
func (lightning *Lightning) ParseInput(inputStr string) (breez_sdk_spark.InputType, error) {
	input, err := lightning.sdkService.Parse(inputStr)
	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return nil, err
	}

	switch inputType := input.(type) {
	case breez_sdk_spark.InputTypeBitcoinAddress:
		lightning.log.Printf("Input is Bitcoin address %s", inputType.Field0.Address)

	case breez_sdk_spark.InputTypeBolt11Invoice:
		amount := "unknown"
		if inputType.Field0.AmountMsat != nil {
			amount = strconv.FormatUint(*inputType.Field0.AmountMsat, 10)
		}
		lightning.log.Printf("Input is BOLT11 invoice for %s msats", amount)

	case breez_sdk_spark.InputTypeLnurlPay:
		lightning.log.Printf("Input is LNURL-Pay/Lightning address accepting min/max %d/%d msats",
			inputType.Field0.MinSendable, inputType.Field0.MaxSendable)

	case breez_sdk_spark.InputTypeLnurlWithdraw:
		lightning.log.Printf("Input is LNURL-Withdraw for min/max %d/%d msats",
			inputType.Field0.MinWithdrawable, inputType.Field0.MaxWithdrawable)

	case breez_sdk_spark.InputTypeSparkAddress:
		lightning.log.Printf("Input is Spark address %s", inputType.Field0.Address)

	case breez_sdk_spark.InputTypeSparkInvoice:
		invoice := inputType.Field0
		lightning.log.Println("Input is Spark invoice:")
		if invoice.TokenIdentifier != nil {
			lightning.log.Printf("  Amount: %d base units of token with id %s", invoice.Amount, *invoice.TokenIdentifier)
		} else {
			lightning.log.Printf("  Amount: %d sats", invoice.Amount)
		}

		if invoice.Description != nil {
			lightning.log.Printf("  Description: %s", *invoice.Description)
		}

		if invoice.ExpiryTime != nil {
			lightning.log.Printf("  Expiry time: %d", *invoice.ExpiryTime)
		}

		if invoice.SenderPublicKey != nil {
			lightning.log.Printf("  Sender public key: %s", *invoice.SenderPublicKey)
		}

	default:
		lightning.log.Errorf("Input type not supported %T", input)
		return nil, errp.New("Invoice format not supported")
	}
	return input, nil

}

// SendPayment executes a payment for the provided payment request.
func (lightning *Lightning) SendPayment(paymentRequest string, amountMsat *uint64) error {
	lightning.log.Infof("Sending payment to %+v", paymentRequest)
	request := breez_sdk_spark.PrepareSendPaymentRequest{
		PaymentRequest: paymentRequest,
	}

	// Optionally set the amount you wish the pay the receiver
	if amountMsat != nil {
		lightning.log.Infof("Optional amount: %+v Msat", *amountMsat)
		optionalAmountSats := new(big.Int).SetUint64(*amountMsat / 1000)
		request.Amount = &optionalAmountSats
	}
	prepareResponse, err := lightning.sdkService.PrepareSendPayment(request)
	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return err
	}

	// If the fees are acceptable, continue to create the Send Payment
	switch paymentMethod := prepareResponse.PaymentMethod.(type) {
	case breez_sdk_spark.SendPaymentMethodBolt11Invoice:
		// Fees to pay via Lightning
		lightningFeeSats := paymentMethod.LightningFeeSats
		// Or fees to pay (if available) via a Spark transfer
		sparkTransferFeeSats := paymentMethod.SparkTransferFeeSats
		lightning.log.Printf("Lightning Fees: %v sats", lightningFeeSats)
		lightning.log.Printf("Spark Transfer Fees: %v sats", sparkTransferFeeSats)
	default:
		return errp.Newf("Payment method %v not supported", paymentMethod)
	}

	// var completionTimeoutSecs uint32 = 4
	var options breez_sdk_spark.SendPaymentOptions = breez_sdk_spark.SendPaymentOptionsBolt11Invoice{
		PreferSpark: false,
		// CompletionTimeoutSecs: &completionTimeoutSecs,
	}

	// optionalIdempotencyKey := "<idempotency key uuid>"
	payRequest := breez_sdk_spark.SendPaymentRequest{
		PrepareResponse: prepareResponse,
		Options:         &options,
		// IdempotencyKey:  &optionalIdempotencyKey,
	}
	_, err = lightning.sdkService.SendPayment(payRequest)

	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return err
	}
	return nil
}

// BoardingAddress returns a bitcoin address that can be used to fund lightning.
func (lightning *Lightning) BoardingAddress() (string, *big.Int, error) {
	request := breez_sdk_spark.ReceivePaymentRequest{
		PaymentMethod: breez_sdk_spark.ReceivePaymentMethodBitcoinAddress{},
	}

	response, err := lightning.sdkService.ReceivePayment(request)

	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return "", nil, err
	}

	paymentRequest := response.PaymentRequest
	lightning.log.Printf("Payment Request: %v", paymentRequest)
	receiveFeesSat := response.Fee
	lightning.log.Printf("Fees: %v sats", receiveFeesSat)

	return paymentRequest, receiveFeesSat, nil
}

// ReceivePayment creates a BOLT11 invoice and returns the SDK response.
func (lightning *Lightning) ReceivePayment(amountSats uint64, description string) (*breez_sdk_spark.ReceivePaymentResponse, error) {
	if len(description) < 1 {
		description = "Send to BitBoxApp"
	}

	request := breez_sdk_spark.ReceivePaymentRequest{
		PaymentMethod: breez_sdk_spark.ReceivePaymentMethodBolt11Invoice{
			Description: description,
			AmountSats:  &amountSats,
		},
	}

	response, err := lightning.sdkService.ReceivePayment(request)

	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return nil, err
	}

	paymentRequest := response.PaymentRequest
	lightning.log.Printf("Payment Request: %v", paymentRequest)
	receiveFeesSat := response.Fee
	lightning.log.Printf("Fees: %v sats", receiveFeesSat)
	return &response, nil
}

// ListPayments fetches lightning payments using the supplied filter request.
func (lightning *Lightning) ListPayments(request breez_sdk_spark.ListPaymentsRequest) ([]breez_sdk_spark.Payment, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}
	response, err := lightning.sdkService.ListPayments(request)
	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return nil, err
	}

	lightning.log.Infof("List payments: %+v", response.Payments)

	return response.Payments, nil
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

	if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
		return nil, err
	}

	balanceSats := info.BalanceSats
	lightning.log.Infof("Balance: %v sats", balanceSats)

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
		if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
			lightning.log.WithError(err).Error("BreezSDK: Error connecting SDK")
			return err
		}

		sdk.AddEventListener(lightning)
		initializeLogging(lightning.log)
		_, err = sdk.SyncWallet(breez_sdk_spark.SyncWalletRequest{})
		if sdkErr := err.(*breez_sdk_spark.SdkError); sdkErr != nil {
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
