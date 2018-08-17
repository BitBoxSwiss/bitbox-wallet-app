// Copyright 2018 Shift Devices AG
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

package backend

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"

	"golang.org/x/text/language"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
	"github.com/sirupsen/logrus"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum/client"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	utilconf "github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonrpc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/rpc"
)

type backendEvent struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type deviceEvent struct {
	DeviceID string `json:"deviceID"`
	Type     string `json:"type"`
	Data     string `json:"data"`
	// TODO: rename Data to Event, Meta to Data.
	Meta interface{} `json:"meta"`
}

// WalletEvent models an event triggered by a wallet.
type WalletEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
}

// Backend ties everything together and is the main starting point to use the BitBox wallet library.
type Backend struct {
	arguments *arguments.Arguments

	config *config.Config

	events chan interface{}

	devices        map[string]device.Interface
	keystores      keystore.Keystores
	onWalletInit   func(*btc.Account)
	onWalletUninit func(*btc.Account)
	onDeviceInit   func(device.Interface)
	onDeviceUninit func(string)

	coins     map[string]*btc.Coin
	coinsLock locker.Locker

	accounts     []*btc.Account
	accountsLock locker.Locker
	// accountsSyncStart time.Time

	// Stored and exposed temporarily through the backend.
	ratesUpdater coin.RatesUpdater

	log *logrus.Entry
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *arguments.Arguments) *Backend {
	log := logging.Get().WithGroup("backend")
	return &Backend{
		arguments: arguments,
		config:    config.NewConfig(arguments.ConfigFilename()),
		events:    make(chan interface{}, 1000),

		devices:      map[string]device.Interface{},
		keystores:    keystore.NewKeystores(),
		coins:        map[string]*btc.Coin{},
		ratesUpdater: btc.NewRatesUpdater(),
		log:          log,
	}
}

func (backend *Backend) addAccount(
	coin *btc.Coin,
	code string,
	name string,
	keypath string,
	scriptType signing.ScriptType,
) {
	if !backend.config.Config().Backend.AccountActive(code) {
		backend.log.WithField("code", code).WithField("name", name).Info("skipping inactive account")
		return
	}
	backend.log.WithField("code", code).WithField("name", name).Info("init account")
	onEvent := func(code string) func(btc.Event) {
		return func(event btc.Event) {
			backend.events <- WalletEvent{Type: "wallet", Code: code, Data: string(event)}
		}
	}
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	getSigningConfiguration := func() (*signing.Configuration, error) {
		return backend.keystores.Configuration(scriptType, absoluteKeypath, backend.keystores.Count())
	}
	if backend.arguments.Multisig() {
		name = name + " Multisig"
	}
	account := btc.NewAccount(coin, backend.arguments.CacheDirectoryPath(), code, name,
		getSigningConfiguration, backend.keystores, onEvent(code), backend.log)
	backend.accounts = append(backend.accounts, account)
}

// Config returns the app config.
func (backend *Backend) Config() *config.Config {
	return backend.config
}

// DefaultConfig returns the default app config.y
func (backend *Backend) DefaultConfig() config.AppConfig {
	return config.NewDefaultConfig()
}

func (backend *Backend) defaultProdServers(code string) []*rpc.ServerInfo {
	switch code {
	case "btc":
		return backend.config.Config().Backend.BTC.ElectrumServers
	case "tbtc":
		return backend.config.Config().Backend.TBTC.ElectrumServers
	case "ltc":
		return backend.config.Config().Backend.LTC.ElectrumServers
	case "tltc":
		return backend.config.Config().Backend.TLTC.ElectrumServers
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func defaultDevServers(code string) []*rpc.ServerInfo {
	const devShiftCA = `-----BEGIN CERTIFICATE-----
MIIGGjCCBAKgAwIBAgIJAO1AEqR+xvjRMA0GCSqGSIb3DQEBDQUAMIGZMQswCQYD
VQQGEwJDSDEPMA0GA1UECAwGWnVyaWNoMR0wGwYDVQQKDBRTaGlmdCBDcnlwdG9z
ZWN1cml0eTEzMDEGA1UECwwqU2hpZnQgQ3J5cHRvc2VjdXJpdHkgQ2VydGlmaWNh
dGUgQXV0aG9yaXR5MSUwIwYDVQQDDBxTaGlmdCBDcnlwdG9zZWN1cml0eSBSb290
IENBMB4XDTE4MDMwNzE3MzUxMloXDTM4MDMwMjE3MzUxMlowgZkxCzAJBgNVBAYT
AkNIMQ8wDQYDVQQIDAZadXJpY2gxHTAbBgNVBAoMFFNoaWZ0IENyeXB0b3NlY3Vy
aXR5MTMwMQYDVQQLDCpTaGlmdCBDcnlwdG9zZWN1cml0eSBDZXJ0aWZpY2F0ZSBB
dXRob3JpdHkxJTAjBgNVBAMMHFNoaWZ0IENyeXB0b3NlY3VyaXR5IFJvb3QgQ0Ew
ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDlz32VZk/D3rfm7Qwx6WkE
Fp9cdQV2FNYTeTjWVErVeTev02ctHHXV1fR3Svk8iIJWaALSJy7phdEDwC/3gDIQ
Ylm15kpntCibOWiQPZZxGq7Udts20fooccdZqtG/PKFRCPWZ2MOgHAOWDKGk6Kb+
siqkr55hkxwtiHuwkCcTh/Q2orEIuteSRbbYwgURZwd6dDIQq4ty7reC3j32xphh
edbnVBoDE6DSdebSS5SJL/gb6LxUdio98XdJPwkaD8292uEODxx0DKw/Ou2e1f5Q
Iv1WBl+LBaSrZ3sJSFUqoSvCQwBQmMAPoPJ1O13jCnFz1xoNygxUfz2eiKRL5E2l
VTmTh7zIez4oniOh5MOmDnKMVgTUGP1II2UU5r6PAq2tDpw4lVwyezhyLaBegwMc
pg/LinbABxUJrP8c8G2tve0yuTAhsir7r+Koo+nAE7FwcuIkD0UTyQcoag2IMS8O
dKZdYMGXjfUPJRBWg60LfXJeqMyU1oHpDrsRoa5iaYPt7ZApxc41kyynqfuuuIRD
du8327gd1nJ6ExMxGHY7dYelE4GNkOg3R0+5czykm/RxnGyDuDcO/RcYBJTChN1L
HYq+dTt0dYPAzBtiXnfuvjDyOsDK5f65pbrDgoOr6AQ4lvDJabcXFsWPrulM9Dyu
p0Y4+fuwXOCd8cr1Zm34MQIDAQABo2MwYTAdBgNVHQ4EFgQU486X86LMbNNSDw7J
NcT2U30NrikwHwYDVR0jBBgwFoAU486X86LMbNNSDw7JNcT2U30NrikwDwYDVR0T
AQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQENBQADggIBAN0N
IPVBv8aaKDHDK9Nsu5fwiGp8GgkAN0B1+D34CbxTuzCDurToVMHCPEdo9tk/AzE4
Aa1p/kMW9X3XP8IyCFFj+BpEVkBRr9fXTVuh3XRHbyN6tXFbkKWQ/6QeUcnefq2k
DCpqEGjJQWsujZ4tJKkJl2HLIBZL6FAa/kaDLFHd3LeV1immC66CiN3ieHejCJL1
zZXiWi8pNxvEanTLPBaBjCw/AAl/owg/ySu2hGZzL0wsFboPrUbo4J+KvL1pvwql
PCT8AylJKCu+cn/N9zZDtUsgZJQBIq7btoakC3mCSnfVTlcbxfHVef0DbfohFqoV
ZpdmIuy0/njw7o+2uL/ArPJscPOhNl60ocDbdFIyYvc85oxyts8yMvKDdWV9Bm//
kl7lv4QUAvjqjb7ZgUhYibVk3Eu6n1MGZOP40l1/mm922/Wcd2n/HZVk/LsJs4tt
B6DLMDpf5nzeI1Yz/QtDGvNyb4aiJoRV5tQb9KkFfIeSzBS/ORZto4tVHKS37lxV
d1r8kFyCgpL9KASdahfyLBWCC7awlcOQP1QJA5QoO9u5Feq3lU0VnJF0YCZh8GOy
py3n1TR6S59eT495BiKDjWnhdVchEa8zMGIW/wFW7EX/LyW2zX3hQsdfnmMWUPVr
O3nOxjgSfRAfKWQ2Ny1APKcn6I83P5PFLhtO5I12
-----END CERTIFICATE-----`

	switch code {
	case "btc":
		return []*rpc.ServerInfo{{Server: "dev.shiftcrypto.ch:50002", TLS: true, PEMCert: devShiftCA}}
	case "tbtc":
		return []*rpc.ServerInfo{
			{Server: "s1.dev.shiftcrypto.ch:51003", TLS: true, PEMCert: devShiftCA},
			{Server: "s2.dev.shiftcrypto.ch:51003", TLS: true, PEMCert: devShiftCA},
		}
	case "ltc":
		return []*rpc.ServerInfo{{Server: "dev.shiftcrypto.ch:50004", TLS: true, PEMCert: devShiftCA}}
	case "tltc":
		return []*rpc.ServerInfo{{Server: "dev.shiftcrypto.ch:51004", TLS: true, PEMCert: devShiftCA}}
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func (backend *Backend) defaultServers(code string) []*rpc.ServerInfo {
	if backend.arguments.DevMode() {
		return defaultDevServers(code)
	}

	return backend.defaultProdServers(code)
}

// Coin returns a Coin instance for a coin type.
func (backend *Backend) Coin(code string) *btc.Coin {
	defer backend.coinsLock.Lock()()
	coin, ok := backend.coins[code]
	if ok {
		return coin
	}
	servers := backend.defaultServers(code)
	dbFolder := backend.arguments.CacheDirectoryPath()
	switch code {
	case "rbtc":
		servers = []*rpc.ServerInfo{{"127.0.0.1:52001", false, ""}}
		coin = btc.NewCoin("rbtc", "RBTC", &chaincfg.RegressionNetParams, dbFolder, servers, "", nil)
	case "tbtc":
		coin = btc.NewCoin("tbtc", "TBTC", &chaincfg.TestNet3Params, dbFolder, servers, "https://testnet.blockchain.info/tx/", backend.ratesUpdater)
	case "btc":
		coin = btc.NewCoin("btc", "BTC", &chaincfg.MainNetParams, dbFolder, servers, "https://blockchain.info/tx/", backend.ratesUpdater)
	case "tltc":
		coin = btc.NewCoin("tltc", "TLTC", &ltc.TestNet4Params, dbFolder, servers, "http://explorer.litecointools.com/tx/", backend.ratesUpdater)
	case "ltc":
		coin = btc.NewCoin("ltc", "LTC", &ltc.MainNetParams, dbFolder, servers, "https://insight.litecore.io/tx/", backend.ratesUpdater)
	default:
		panic(errp.Newf("unknown coin code %s", code))
	}
	coin.Init()
	coin.Observe(func(event observable.Event) { backend.events <- event })
	backend.coins[code] = coin
	return coin
}

func (backend *Backend) initAccounts() {
	backend.accounts = []*btc.Account{}
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			RBTC := backend.Coin("rbtc")
			backend.addAccount(RBTC, "rbtc-p2pkh", "Bitcoin Regtest Legacy", "m/44'/1'/0'", signing.ScriptTypeP2PKH)
			backend.addAccount(RBTC, "rbtc-p2wpkh-p2sh", "Bitcoin Regtest Segwit", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
		} else {
			TBTC := backend.Coin("tbtc")
			backend.addAccount(TBTC, "tbtc-p2wpkh-p2sh", "Bitcoin Testnet", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(TBTC, "tbtc-p2wpkh", "Bitcoin Testnet: bech32", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
			backend.addAccount(TBTC, "tbtc-p2pkh", "Bitcoin Testnet Legacy", "m/44'/1'/0'", signing.ScriptTypeP2PKH)

			TLTC := backend.Coin("tltc")
			backend.addAccount(TLTC, "tltc-p2wpkh-p2sh", "Litecoin Testnet", "m/49'/1'/0'", signing.ScriptTypeP2WPKHP2SH)
			backend.addAccount(TLTC, "tltc-p2wpkh", "Litecoin Testnet: bech32", "m/84'/1'/0'", signing.ScriptTypeP2WPKH)
		}
	} else {
		BTC := backend.Coin("btc")
		backend.addAccount(BTC, "btc-p2wpkh-p2sh", "Bitcoin", "m/49'/0'/0'", signing.ScriptTypeP2WPKHP2SH)
		backend.addAccount(BTC, "btc-p2wpkh", "Bitcoin: bech32", "m/84'/0'/0'", signing.ScriptTypeP2WPKH)
		backend.addAccount(BTC, "btc-p2pkh", "Bitcoin Legacy", "m/44'/0'/0'", signing.ScriptTypeP2PKH)

		LTC := backend.Coin("ltc")
		backend.addAccount(LTC, "ltc-p2wpkh-p2sh", "Litecoin", "m/49'/2'/0'", signing.ScriptTypeP2WPKHP2SH)
		backend.addAccount(LTC, "ltc-p2wpkh", "Litecoin: bech32", "m/84'/2'/0'", signing.ScriptTypeP2WPKH)
	}
	for _, account := range backend.accounts {
		backend.onWalletInit(account)
	}
}

// WalletStatus returns whether the wallets have been initialized.
func (backend *Backend) WalletStatus() string {
	if backend.keystores.Count() > 0 {
		return "initialized"
	}
	return "uninitialized"
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.arguments.Testing()
}

// Accounts returns the supported accounts.
func (backend *Backend) Accounts() []*btc.Account {
	return backend.accounts
}

// UserLanguage returns the language the UI should be presented in to the user.
func (backend *Backend) UserLanguage() language.Tag {
	userLocale, err := jibber_jabber.DetectIETF()
	if err != nil {
		return language.English
	}
	languages := []language.Tag{
		language.English,
		language.German,
	}
	tag, _, _ := language.NewMatcher(languages).Match(language.Make(userLocale))
	backend.log.WithField("user-language", tag).Debug("Detected user language")
	return tag
}

// OnWalletInit installs a callback to be called when a wallet is initialized.
func (backend *Backend) OnWalletInit(f func(*btc.Account)) {
	backend.onWalletInit = f
}

// OnWalletUninit installs a callback to be called when a wallet is stopped.
func (backend *Backend) OnWalletUninit(f func(*btc.Account)) {
	backend.onWalletUninit = f
}

// OnDeviceInit installs a callback to be called when a device is initialized.
func (backend *Backend) OnDeviceInit(f func(device.Interface)) {
	backend.onDeviceInit = f
}

// OnDeviceUninit installs a callback to be called when a device is uninitialized.
func (backend *Backend) OnDeviceUninit(f func(string)) {
	backend.onDeviceUninit = f
}

// Start starts the background services. It returns a channel of events to handle by the library
// client.
func (backend *Backend) Start() <-chan interface{} {
	go backend.listenHID()
	go func() {
		err := backend.checkForUpdate()
		if err != nil {
			backend.log.WithError(err).Error("The update check failed.")
		}
	}()
	return backend.events
}

// Events returns the push notifications channel.
func (backend *Backend) Events() <-chan interface{} {
	return backend.events
}

func (backend *Backend) initWallets() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitWallets()
	defer backend.accountsLock.Lock()()
	backend.initAccounts()
}

// DevicesRegistered returns a slice of device IDs of registered devices.
func (backend *Backend) DevicesRegistered() []string {
	deviceIDs := []string{}
	for deviceID := range backend.devices {
		deviceIDs = append(deviceIDs, deviceID)
	}
	return deviceIDs
}

func (backend *Backend) uninitWallets() {
	defer backend.accountsLock.Lock()()
	for _, account := range backend.accounts {
		account := account
		backend.onWalletUninit(account)
		account.Close()
	}
	backend.accounts = nil
}

// Keystores returns the keystores registered at this backend.
func (backend *Backend) Keystores() keystore.Keystores {
	return backend.keystores
}

// RegisterKeystore registers the given keystore at this backend.
func (backend *Backend) RegisterKeystore(keystore keystore.Keystore) {
	backend.log.Info("registering keystore")
	if err := backend.keystores.Add(keystore); err != nil {
		backend.log.Panic("Failed to add a keystore.", err)
	}
	if backend.arguments.Multisig() && backend.keystores.Count() != 2 {
		return
	}
	backend.initWallets()
	backend.events <- backendEvent{Type: "backend", Data: "walletStatusChanged"}
}

// DeregisterKeystore removes the registered keystore.
func (backend *Backend) DeregisterKeystore() {
	backend.log.Info("deregistering keystore")
	backend.keystores = keystore.NewKeystores()
	backend.uninitWallets()
	backend.events <- backendEvent{Type: "backend", Data: "walletStatusChanged"}
}

// Register registers the given device at this backend.
func (backend *Backend) Register(theDevice device.Interface) error {
	backend.devices[theDevice.Identifier()] = theDevice
	backend.onDeviceInit(theDevice)
	theDevice.Init(backend.Testing())

	mainKeystore := len(backend.devices) == 1
	theDevice.SetOnEvent(func(event device.Event, data interface{}) {
		switch event {
		case device.EventKeystoreGone:
			backend.DeregisterKeystore()
		case device.EventKeystoreAvailable:
			// absoluteKeypath := signing.NewEmptyAbsoluteKeypath().Child(44, signing.Hardened)
			// extendedPublicKey, err := backend.device.ExtendedPublicKey(absoluteKeypath)
			// if err != nil {
			// 	panic(err)
			// }
			// configuration := signing.NewConfiguration(absoluteKeypath,
			// 	[]*hdkeychain.ExtendedKey{extendedPublicKey}, 1)
			if backend.arguments.Multisig() {
				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
			} else if mainKeystore {
				// HACK: for device based, only one is supported at the moment.
				backend.keystores = keystore.NewKeystores()

				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
			}
		}
		backend.events <- deviceEvent{
			DeviceID: theDevice.Identifier(),
			Type:     "device",
			Data:     string(event),
			Meta:     data,
		}
	})
	select {
	case backend.events <- backendEvent{
		Type: "devices",
		Data: "registeredChanged",
	}:
	default:
	}
	return nil
}

// Deregister deregisters the device with the given ID from this backend.
func (backend *Backend) Deregister(deviceID string) {
	if _, ok := backend.devices[deviceID]; ok {
		backend.onDeviceUninit(deviceID)
		delete(backend.devices, deviceID)
		backend.DeregisterKeystore()
		backend.events <- backendEvent{Type: "devices", Data: "registeredChanged"}
	}
}

func (backend *Backend) listenHID() {
	// TODO: Merge utilconf with backend/config and/or arguments.ConfigFilename.
	usb.NewManager(utilconf.DirectoryPath(), backend.Register, backend.Deregister).ListenHID()
}

// Rates return the latest rates.
func (backend *Backend) Rates() map[string]map[string]float64 {
	return backend.ratesUpdater.Last()
}

// DownloadCert downloads the first element of the remote certificate chain.
func (backend *Backend) DownloadCert(server string) (string, error) {
	var pemCert []byte
	conn, err := tls.Dial("tcp", server, &tls.Config{
		VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
			if len(rawCerts) == 0 {
				return errp.New("no remote certs")
			}

			certificatePEM := &pem.Block{Type: "CERTIFICATE", Bytes: rawCerts[0]}
			certificatePEMBytes := &bytes.Buffer{}
			if err := pem.Encode(certificatePEMBytes, certificatePEM); err != nil {
				panic(err)
			}
			pemCert = certificatePEMBytes.Bytes()
			return nil
		},
		InsecureSkipVerify: true,
	})
	if err != nil {
		return "", err
	}
	_ = conn.Close()
	return string(pemCert), nil
}

// CheckElectrumServer checks if a tls connection can be established with the electrum server, and
// whether the server is an electrum server.
func (backend *Backend) CheckElectrumServer(server string, pemCert string) error {
	backends := []rpc.Backend{
		electrum.NewElectrum(backend.log, &rpc.ServerInfo{Server: server, TLS: true, PEMCert: pemCert}),
	}
	conn, err := backends[0].EstablishConnection()
	if err != nil {
		return err
	}
	_ = conn.Close()
	// Simple check if the server is an electrum server.
	jsonrpcClient := jsonrpc.NewRPCClient(backends, backend.log)
	electrumClient := client.NewElectrumClient(jsonrpcClient, backend.log)
	defer electrumClient.Close()
	_, err = electrumClient.ServerVersion()
	return err
}
