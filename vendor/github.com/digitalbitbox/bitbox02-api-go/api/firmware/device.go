// Copyright 2018-2019 Shift Cryptosecurity AG
// Copyright 2020 Shift Crypto AG
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

// Package firmware contains the API to the physical device.
package firmware

import (
	"fmt"
	"sync"

	"github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/flynn/noise"
)

//go:generate sh -c "protoc --proto_path=messages/ --go_out='import_path=messages,paths=source_relative:messages' messages/*.proto"

var (
	lowestSupportedFirmwareVersion                   = semver.NewSemVer(9, 0, 0)
	lowestSupportedFirmwareVersionBTCOnly            = semver.NewSemVer(9, 0, 0)
	lowestSupportedFirmwareVersionBitBoxBaseStandard = semver.NewSemVer(4, 3, 0)
	lowestNonSupportedFirmwareVersion                = semver.NewSemVer(10, 0, 0)
)

// Communication contains functions needed to communicate with the device.
type Communication interface {
	Query([]byte) ([]byte, error)
	Close()
}

// ConfigInterface lets the library client provide their own persisted config backend.
type ConfigInterface interface {
	// ContainsDeviceStaticPubkey returns true if a device pubkey has been added before.
	ContainsDeviceStaticPubkey(pubkey []byte) bool
	// AddDeviceStaticPubkey adds a device pubkey.
	AddDeviceStaticPubkey(pubkey []byte) error
	// GetAppNoiseStaticKeypair retrieves the app keypair. Returns nil if none has been set before.
	GetAppNoiseStaticKeypair() *noise.DHKey
	// SetAppNoiseStaticKeypair stores the app keypair. Overwrites keypair if one already exists.
	SetAppNoiseStaticKeypair(key *noise.DHKey) error
}

// Logger lets the library client provide their own logging infrastructure.
type Logger interface {
	// err can be nil
	Error(msg string, err error)
	Info(msg string)
	Debug(msg string)
}

const (
	opICanHasHandShaek          = "h"
	opHerComezTehHandshaek      = "H"
	opICanHasPairinVerificashun = "v"
	opNoiseMsg                  = "n"
	opAttestation               = "a"
	opUnlock                    = "u"

	responseSuccess = "\x00"
)

// Device provides the API to communicate with the BitBox02.
type Device struct {
	communication Communication
	// firmware version.
	version *semver.SemVer
	product *common.Product

	config ConfigInterface

	// if nil, the attestation check has not been completed yet.
	attestation *bool

	deviceNoiseStaticPubkey   []byte
	channelHash               string
	channelHashAppVerified    bool
	channelHashDeviceVerified bool
	sendCipher, receiveCipher *noise.CipherState
	// encrypting (decrypting) increments the cipherstate nonce, and has to be in sync with the
	// state nonce in the BitBox02.
	//
	// We have to make sure that if there are concurrent queries, the incrementing of the local
	// nonces must match the incrementing of the device nonces, so the decryption works. Avoid the
	// situation where we Encrypt() locally twice, and send the queries out of order, which will
	// result in a failed decryption on the device.
	queryLock sync.Mutex

	status Status

	mu      sync.RWMutex
	onEvent func(Event, interface{})
	log     Logger
}

// DeviceInfo is the data returned from the device info api call.
type DeviceInfo struct {
	Name                      string `json:"name"`
	Version                   string `json:"version"`
	Initialized               bool   `json:"initialized"`
	MnemonicPassphraseEnabled bool   `json:"mnemonicPassphraseEnabled"`
	// This information is only available since firmwae v9.6.0. Will be an empty string for older
	// firmware versions.
	SecurechipModel string `json:"securechipModel"`
}

// NewDevice creates a new instance of Device.
// version:
//   Can be given if known at the time of instantiation, e.g. by parsing the USB HID product string.
//   It must be provided if the version could be less than 4.3.0.
//   If nil, the version will be queried from the device using the OP_INFO api endpoint. Do this
//   when you are sure the firmware version is bigger or equal to 4.3.0.
// product: same deal as with the version, after 4.3.0 it can be inferred by OP_INFO.
func NewDevice(
	version *semver.SemVer,
	product *common.Product,
	config ConfigInterface,
	communication Communication,
	log Logger,
) *Device {
	if (version == nil) != (product == nil) {
		panic("both version and product have to be specified, or none")
	}
	return &Device{
		communication: communication,
		version:       version,
		product:       product,
		config:        config,
		status:        StatusConnected,
		log:           log,
	}
}

// info uses the opInfo api endpoint to learn about the version, platform/edition, and unlock
// status (true if unlocked).
func (device *Device) info() (*semver.SemVer, common.Product, bool, error) {

	// CAREFUL: hwwInfo is called on the raw transport, not on device.rawQuery, which behaves
	// differently depending on the firmware version. Reason: the version is not
	// available (this call is used to get the version), so it must work for all firmware versions.
	response, err := device.communication.Query([]byte(hwwInfo))
	if err != nil {
		return nil, "", false, err
	}

	if len(response) < 4 {
		return nil, "", false, errp.New("unexpected response")
	}
	versionStrLen, response := int(response[0]), response[1:]
	versionBytes, response := response[:versionStrLen], response[versionStrLen:]
	version, err := semver.NewSemVerFromString(string(versionBytes))
	if err != nil {
		return nil, "", false, err
	}
	platformByte, response := response[0], response[1:]
	editionByte, response := response[0], response[1:]
	const (
		platformBitBox02   = 0x00
		platformBitBoxBase = 0x01
	)
	products := map[byte]map[byte]common.Product{
		platformBitBox02: {
			0x00: common.ProductBitBox02Multi,
			0x01: common.ProductBitBox02BTCOnly,
		},
		platformBitBoxBase: {
			0x00: common.ProductBitBoxBaseStandard,
		},
	}
	editions, ok := products[platformByte]
	if !ok {
		return nil, "", false, errp.Newf("unrecognized platform: %v", platformByte)
	}
	product, ok := editions[editionByte]
	if !ok {
		return nil, "", false, errp.Newf("unrecognized platform/edition: %v/%v", platformByte, editionByte)
	}

	var unlocked bool
	unlockedByte := response[0]
	switch unlockedByte {
	case 0x00:
		unlocked = false
	case 0x01:
		unlocked = true
	default:
		return nil, "", false, errp.New("unexpected reply")
	}
	return version, product, unlocked, nil
}

// Version returns the firmware version.
func (device *Device) Version() *semver.SemVer {
	if device.version == nil {
		panic("version not set; Init() must be called first")
	}
	return device.version
}

// inferVersionAndProduct either sets the version and product by using OP_INFO if they were not
// provided. In this case, the firmware is assumed to be >=v4.3.0, before that OP_INFO was not
// available.
func (device *Device) inferVersionAndProduct() error {
	// The version has not been provided, so we try to get it from OP_INFO.
	if device.version == nil {
		version, product, _, err := device.info()
		if err != nil {
			return errp.New(
				"OP_INFO unavailable; need to provide version and product via the USB HID descriptor")
		}
		device.log.Info(fmt.Sprintf("OP_INFO: version=%s, product=%s", version, product))

		// sanity check
		if !version.AtLeast(semver.NewSemVer(4, 3, 0)) {
			return errp.New("OP_INFO is not supposed to exist below v4.3.0")
		}

		device.version = version
		device.product = &product
	}
	return nil
}

// Init initializes the device. It changes the status to StatusRequireAppUpgrade if needed,
// otherwise performs the attestation check, unlock, and noise pairing. This call is blocking.
// After this call finishes, Status() will be either:
// - StatusRequireAppUpgrade
// - StatusPairingFailed (pairing rejected on the device)
// - StatusUnpaired (in which the host needs to confirm the pairing with ChannelHashVerify(true))
func (device *Device) Init() error {
	device.attestation = nil
	device.deviceNoiseStaticPubkey = nil
	device.channelHash = ""
	device.channelHashAppVerified = false
	device.channelHashDeviceVerified = false
	device.sendCipher = nil
	device.receiveCipher = nil
	device.changeStatus(StatusConnected)

	if err := device.inferVersionAndProduct(); err != nil {
		return err
	}
	if device.version.AtLeast(lowestNonSupportedFirmwareVersion) {
		device.changeStatus(StatusRequireAppUpgrade)
		return nil
	}

	attestation, err := device.performAttestation()
	if err != nil {
		return err
	}
	device.attestation = &attestation
	device.log.Info(fmt.Sprintf("attestation check result: %v", attestation))
	device.fireEvent(EventAttestationCheckDone)

	// Before 2.0.0, unlock was invoked automatically by the device before USB communication
	// started.
	if device.version.AtLeast(semver.NewSemVer(2, 0, 0)) {
		_, err := device.rawQuery([]byte(opUnlock))
		if err != nil {
			// Most likely the device has been unplugged.
			return err
		}
	}

	if err := device.pair(); err != nil {
		// Most likely the device has been unplugged.
		return err
	}

	return nil
}

func (device *Device) changeStatus(status Status) {
	device.status = status
	device.fireEvent(EventStatusChanged)
}

// Status returns the device state. See the Status* constants.
func (device *Device) Status() Status {
	device.log.Debug(fmt.Sprintf("Device status: %v", device.status))
	return device.status
}

// Close implements device.Device.
func (device *Device) Close() {
	device.communication.Close()
}

// Random requests a random number from the device using protobuf messages
func (device *Device) Random() ([]byte, error) {
	request := &messages.Request{
		Request: &messages.Request_RandomNumber{
			RandomNumber: &messages.RandomNumberRequest{},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return nil, err
	}

	randomResponse, ok := response.Response.(*messages.Response_RandomNumber)
	if !ok {
		return nil, errp.New("expected RandomNumberResponse response")
	}

	return randomResponse.RandomNumber.Number, nil
}

// RootFingerprint returns the keystore's root fingerprint, which is the first 32 bits of the
// hash160 of the pubkey at the keypath m/.
//
// https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#key-identifiers
func (device *Device) RootFingerprint() ([]byte, error) {
	request := &messages.Request{
		Request: &messages.Request_Fingerprint{
			Fingerprint: &messages.RootFingerprintRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	fingerprintResponse, ok := response.Response.(*messages.Response_Fingerprint)
	if !ok {
		return nil, errp.New("expected Fingerprint response")
	}
	fingerprint := fingerprintResponse.Fingerprint.Fingerprint
	if len(fingerprint) != 4 {
		return nil, errp.Newf("fingerprint len=%d, expected 4", len(fingerprint))
	}
	return fingerprint, nil
}

// Product returns the device product.
func (device *Device) Product() common.Product {
	if device.product == nil {
		panic("product not set; Init() must be called first")
	}
	return *device.product
}

// SupportsETH returns true if ETH is supported by the device api.
// coinCode is eth/teth/reth or eth-erc20-xyz, ...
func (device *Device) SupportsETH(coinCode messages.ETHCoin) bool {
	if *device.product != common.ProductBitBox02Multi {
		return false
	}
	if device.version.AtLeast(semver.NewSemVer(4, 0, 0)) {
		switch coinCode {
		case messages.ETHCoin_ETH, messages.ETHCoin_RopstenETH, messages.ETHCoin_RinkebyETH:
			return true
		}
	}
	return false
}

// SupportsERC20 returns true if an ERC20 token is supported by the device api.
//
// For now, this list only contains tokens relevant to the BitBoxApp, otherwise the bitbox02-api-js
// library size would blow up. TODO: move this to the bitbox-wallet-app repo.
func (device *Device) SupportsERC20(contractAddress string) bool {
	if *device.product != common.ProductBitBox02Multi {
		return false
	}
	if device.version.AtLeast(semver.NewSemVer(4, 0, 0)) {
		switch contractAddress {
		case
			"0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
			"0x0D8775F648430679A709E98d2b0Cb6250d2887EF", // BAT
			"0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359", // SAI
			"0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
			"0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", // MKR
			"0xE41d2489571d322189246DaFA5ebDe1F4699F498": // ZRX
			return true
		}
	}
	if device.version.AtLeast(semver.NewSemVer(5, 0, 0)) {
		switch contractAddress {
		case
			"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
			"0x6B175474E89094C44Da98b954EedeAC495271d0F": // DAI
			return true
		}
	}
	if device.version.AtLeast(semver.NewSemVer(6, 0, 0)) {
		switch contractAddress {
		case
			"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
			"0x45804880De22913dAFE09f4980848ECE6EcbAf78": // PAXG
			return true
		}
	}
	return false
}

// SupportsLTC returns true if LTC is supported by the device api.
func (device *Device) SupportsLTC() bool {
	return *device.product == common.ProductBitBox02Multi
}
