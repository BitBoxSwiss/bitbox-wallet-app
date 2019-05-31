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

// Package bitbox02 contains the API to the physical device.
package bitbox02

import (
	"bytes"
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	devicepkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/flynn/noise"
	"github.com/golang/protobuf/proto"
	"github.com/sirupsen/logrus"
)

//go:generate protoc --go_out=import_path=messages:. messages/hww.proto

var (
	lowestSupportedFirmwareVersion    = semver.NewSemVer(0, 0, 1)
	lowestNonSupportedFirmwareVersion = semver.NewSemVer(1, 0, 0)
)

// ProductName is the name of the BitBox02 product.
const ProductName = "bitbox02"

// Communication contains functions needed to communicate with the device.
type Communication interface {
	SendFrame(string) error
	ReadFrame() ([]byte, error)
	Close()
}

const (
	// EventChannelHashChanged is fired when the return values of ChannelHash() change.
	EventChannelHashChanged device.Event = "channelHashChanged"

	// EventStatusChanged is fired when the status changes. Check the status using Status().
	EventStatusChanged device.Event = "statusChanged"
)

const (
	opICanHasHandShaek          = "h"
	opICanHasPairinVerificashun = "v"

	responseSuccess = "\x00"
)

// Device provides the API to communicate with the BitBox02.
type Device struct {
	deviceID      string
	communication Communication
	// firmware version.
	version *semver.SemVer

	configDir string

	deviceNoiseStaticPubkey   []byte
	channelHash               string
	channelHashAppVerified    bool
	channelHashDeviceVerified bool
	sendCipher, receiveCipher *noise.CipherState

	status Status

	mu      sync.RWMutex
	onEvent func(devicepkg.Event, interface{})
	log     *logrus.Entry
}

// DeviceInfo is the data returned from the device info api call.
type DeviceInfo struct {
	Name                      string `json:"name"`
	Version                   string `json:"version"`
	Initialized               bool   `json:"initialized"`
	MnemonicPassphraseEnabled bool   `json:"mnemonicPassphraseEnabled"`
}

// NewDevice creates a new instance of Device.
func NewDevice(
	deviceID string,
	version *semver.SemVer,
	configDir string,
	communication Communication,
) *Device {
	log := logging.Get().WithGroup("device").WithField("deviceID", deviceID)
	log.Info("Plugged in device")
	return &Device{
		deviceID:      deviceID,
		communication: communication,
		version:       version,
		configDir:     configDir,
		status:        StatusUnpaired,
		log:           log.WithField("deviceID", deviceID).WithField("productName", ProductName),
	}
}

// Version returns the firmware version.
func (device *Device) Version() *semver.SemVer {
	return device.version
}

// Init implements device.Device.
func (device *Device) Init(testing bool) {
	if device.version.AtLeast(lowestNonSupportedFirmwareVersion) {
		device.changeStatus(StatusRequireAppUpgrade)
		return
	}

	cipherSuite := noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)
	keypair := device.configGetAppNoiseStaticKeypair()
	if keypair == nil {
		device.log.Info("noise static keypair created")
		kp, err := cipherSuite.GenerateKeypair(rand.Reader)
		if err != nil {
			panic(err)
		}
		keypair = &kp
		if err := device.configSetAppNoiseStaticKeypair(keypair); err != nil {
			device.log.WithError(err).Error("could not store app noise static keypair")

			// Not a critical error, ignore.
		}
	}
	handshake, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   cipherSuite,
		Random:        rand.Reader,
		Pattern:       noise.HandshakeXX,
		StaticKeypair: *keypair,
		Prologue:      []byte("Noise_XX_25519_ChaChaPoly_SHA256"),
		Initiator:     true,
	})
	if err != nil {
		panic(err)
	}
	responseBytes, err := device.queryRaw([]byte(opICanHasHandShaek))
	if err != nil {
		panic(err)
	}
	if string(responseBytes) != responseSuccess {
		panic(string(responseBytes))
	}
	// do handshake:
	msg, _, _, err := handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	responseBytes, err = device.queryRaw(msg)
	if err != nil {
		panic(err)
	}
	_, _, _, err = handshake.ReadMessage(nil, responseBytes)
	if err != nil {
		panic(err)
	}
	msg, device.sendCipher, device.receiveCipher, err = handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	responseBytes, err = device.queryRaw(msg)
	if err != nil {
		panic(err)
	}

	device.deviceNoiseStaticPubkey = handshake.PeerStatic()
	if len(device.deviceNoiseStaticPubkey) != 32 {
		panic(errp.New("expected 32 byte remote static pubkey"))
	}

	pairingVerificationRequiredByApp := !device.configContainsDeviceStaticPubkey(
		device.deviceNoiseStaticPubkey)
	pairingVerificationRequiredByDevice := string(responseBytes) == "\x01"

	if pairingVerificationRequiredByDevice || pairingVerificationRequiredByApp {
		channelHashBase32 := base32.StdEncoding.EncodeToString(handshake.ChannelBinding())
		device.channelHash = fmt.Sprintf(
			"%s %s\n%s %s",
			channelHashBase32[:5],
			channelHashBase32[5:10],
			channelHashBase32[10:15],
			channelHashBase32[15:20])
		if err := device.communication.SendFrame(opICanHasPairinVerificashun); err != nil {
			panic(err)
		}
		go func() {
			response, err := device.communication.ReadFrame()
			if err != nil {
				panic(err)
			}
			device.channelHashDeviceVerified = string(response) == responseSuccess
			if device.channelHashDeviceVerified {
				device.fireEvent(EventChannelHashChanged)
			} else {
				device.sendCipher = nil
				device.receiveCipher = nil
				device.channelHash = ""
				device.changeStatus(StatusPairingFailed)
			}
		}()
	} else {
		device.channelHashDeviceVerified = true
		device.ChannelHashVerify(true)
	}
}

func (device *Device) changeStatus(status Status) {
	device.status = status
	device.fireEvent(EventStatusChanged)
	switch device.Status() {
	case StatusInitialized:
		device.fireEvent(devicepkg.EventKeystoreAvailable)
	case StatusUninitialized:
		device.fireEvent(devicepkg.EventKeystoreGone)
	}
}

// Status returns the device state. See the Status* constants.
func (device *Device) Status() Status {
	defer device.log.WithField("status", device.status).Debug("Device status")
	return device.status
}

// ProductName implements device.Device.
func (device *Device) ProductName() string {
	return ProductName
}

// Identifier implements device.Device.
func (device *Device) Identifier() string {
	return device.deviceID
}

// KeystoreForConfiguration implements device.Device.
func (device *Device) KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystoreInterface.Keystore {
	if device.Status() != StatusInitialized {
		return nil
	}
	return &keystore{
		device:        device,
		configuration: configuration,
		cosignerIndex: cosignerIndex,
		log:           device.log,
	}
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(devicepkg.Event, interface{})) {
	device.mu.Lock()
	defer device.mu.Unlock()
	device.onEvent = onEvent
}

// fireEvent calls device.onEvent callback if non-nil.
// It blocks for the entire duration of the call.
// The read-only lock is released before calling device.onEvent.
func (device *Device) fireEvent(event device.Event) {
	device.mu.RLock()
	f := device.onEvent
	device.mu.RUnlock()
	if f != nil {
		f(event, nil)
	}
}

// Close implements device.Device.
func (device *Device) Close() {
	device.communication.Close()
}

func (device *Device) queryRaw(request []byte) ([]byte, error) {
	if err := device.communication.SendFrame(string(request)); err != nil {
		return nil, err
	}
	return device.communication.ReadFrame()
}

func (device *Device) query(request proto.Message) (*messages.Response, error) {
	if device.sendCipher == nil {
		return nil, errp.New("handshake must come first")
	}
	requestBytes, err := proto.Marshal(request)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	requestBytesEncrypted := device.sendCipher.Encrypt(nil, nil, requestBytes)
	responseBytes, err := device.queryRaw(requestBytesEncrypted)
	if err != nil {
		return nil, err
	}
	responseBytesDecrypted, err := device.receiveCipher.Decrypt(nil, nil, responseBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	response := &messages.Response{}
	if err := proto.Unmarshal(responseBytesDecrypted, response); err != nil {
		return nil, errp.WithStack(err)
	}

	if errorResponse, ok := response.Response.(*messages.Response_Error); ok {
		return nil, errp.WithStack(NewError(errorResponse.Error.Code, errorResponse.Error.Message))
	}

	return response, nil
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

// SetDeviceName sends a request to the device using protobuf to set the device name
func (device *Device) SetDeviceName(deviceName string) error {
	request := &messages.Request{
		Request: &messages.Request_DeviceName{
			DeviceName: &messages.SetDeviceNameRequest{
				Name: deviceName,
			},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return err
	}

	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("Failed to set device name")
	}

	return nil
}

// DeviceInfo retrieves the current device info from the bitbox
func (device *Device) DeviceInfo() (*DeviceInfo, error) {
	request := &messages.Request{
		Request: &messages.Request_DeviceInfo{
			DeviceInfo: &messages.DeviceInfoRequest{},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return nil, err
	}

	deviceInfoResponse, ok := response.Response.(*messages.Response_DeviceInfo)
	if !ok {
		return nil, errp.New("Failed to retrieve device info")
	}

	deviceInfo := &DeviceInfo{
		Name:                      deviceInfoResponse.DeviceInfo.Name,
		Version:                   deviceInfoResponse.DeviceInfo.Version,
		Initialized:               deviceInfoResponse.DeviceInfo.Initialized,
		MnemonicPassphraseEnabled: deviceInfoResponse.DeviceInfo.MnemonicPassphraseEnabled,
	}

	return deviceInfo, nil
}

// SetPassword invokes the set password workflow on the device. Should be called only if
// deviceInfo.Initialized is false.
func (device *Device) SetPassword() error {
	if device.status == StatusInitialized {
		return errp.New("invalid status")
	}
	request := &messages.Request{
		Request: &messages.Request_SetPassword{
			SetPassword: &messages.SetPasswordRequest{
				Entropy: random.BytesOrPanic(32),
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}

	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.changeStatus(StatusSeeded)
	return nil
}

// CreateBackup is called after SetPassword() to create the backup.
func (device *Device) CreateBackup() error {
	if device.status != StatusSeeded && device.status != StatusInitialized {
		return errp.New("invalid status")
	}

	now := time.Now()
	_, offset := now.Zone()

	request := &messages.Request{
		Request: &messages.Request_CreateBackup{
			CreateBackup: &messages.CreateBackupRequest{
				Timestamp:      uint32(now.Unix()),
				TimezoneOffset: int32(offset),
			},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return err
	}

	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.changeStatus(StatusInitialized)
	return nil
}

// Backup contains the metadata of one backup.
type Backup struct {
	ID   string
	Name string
	Time time.Time
}

// ListBackups returns a list of all backups on the SD card.
func (device *Device) ListBackups() ([]*Backup, error) {
	request := &messages.Request{
		Request: &messages.Request_ListBackups{
			ListBackups: &messages.ListBackupsRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	listBackupsResponse, ok := response.Response.(*messages.Response_ListBackups)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	msgBackups := listBackupsResponse.ListBackups.Info
	backups := make([]*Backup, len(msgBackups))
	for index, msgBackup := range msgBackups {
		backups[index] = &Backup{
			ID:   msgBackup.Id,
			Name: msgBackup.Name,
			Time: time.Unix(int64(msgBackup.Timestamp), 0).Local(),
		}
	}
	return backups, nil
}

// CheckBackup checks if any backup on the SD card matches the current seed on the device
// and returns the name and ID of the matching backup
func (device *Device) CheckBackup(silent bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_CheckBackup{
			CheckBackup: &messages.CheckBackupRequest{
				Silent: silent,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	backup, ok := response.Response.(*messages.Response_CheckBackup)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return backup.CheckBackup.Id, nil
}

// RestoreBackup restores a backup returned by ListBackups (id).
func (device *Device) RestoreBackup(id string) error {
	request := &messages.Request{
		Request: &messages.Request_RestoreBackup{
			RestoreBackup: &messages.RestoreBackupRequest{
				Id: id,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.changeStatus(StatusInitialized)
	return nil
}

// ChannelHash returns the hashed handshake channel binding
func (device *Device) ChannelHash() (string, bool) {
	return device.channelHash, device.channelHashDeviceVerified
}

// ChannelHashVerify verifies the ChannelHash
func (device *Device) ChannelHashVerify(ok bool) {
	if ok && !device.channelHashDeviceVerified {
		return
	}
	device.channelHashAppVerified = ok
	if ok {
		// No critical error, we will just need to re-confirm the pairing next time.
		_ = device.configAddDeviceStaticPubkey(device.deviceNoiseStaticPubkey)
		if !device.version.AtLeast(lowestSupportedFirmwareVersion) {
			device.changeStatus(StatusRequireFirmwareUpgrade)
			return
		}

		info, err := device.DeviceInfo()
		if err != nil {
			device.log.WithError(err).Error("could not get device info")
			return
		}
		if info.Initialized {
			device.changeStatus(StatusInitialized)
		} else {
			device.changeStatus(StatusUninitialized)
		}
	} else {
		device.changeStatus(StatusPairingFailed)
	}
}

// BTCPub queries the device for a btc, ltc, tbtc, tltc xpub or address.
func (device *Device) BTCPub(
	coin messages.BTCCoin,
	keypath []uint32,
	outputType messages.BTCPubRequest_OutputType,
	scriptType messages.BTCScriptType,
	display bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_BtcPub{
			BtcPub: &messages.BTCPubRequest{
				Coin:       coin,
				Keypath:    keypath,
				OutputType: outputType,
				ScriptType: scriptType,
				Display:    display,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	pubResponse, ok := response.Response.(*messages.Response_Pub)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return pubResponse.Pub.Pub, nil
}

func (device *Device) queryBtcSign(request proto.Message) (
	*messages.BTCSignNextResponse, error) {
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	next, ok := response.Response.(*messages.Response_BtcSignNext)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return next.BtcSignNext, nil

}

// BTCSign signs a bitcoin or bitcoin-like transaction.
func (device *Device) BTCSign(
	btcProposedTx *btc.ProposedTransaction) ([]*btcec.Signature, error) {
	coin := btcProposedTx.TXProposal.Coin.(*btc.Coin)
	tx := btcProposedTx.TXProposal.Transaction
	signatures := make([]*btcec.Signature, len(tx.TxIn))
	msgCoin, ok := msgCoinMap[coin.Code()]
	if !ok {
		return nil, errp.Newf("coin not supported: %s", coin.Code())
	}
	scriptType := btcProposedTx.TXProposal.AccountConfiguration.ScriptType()
	msgScriptType, ok := msgScriptTypeMap[scriptType]
	if !ok {
		return nil, errp.Newf("Unsupported script type %s", scriptType)
	}

	// account #0
	// TODO: check that all inputs and change are the same account, and use that one.
	bip44Account := uint32(hdkeychain.HardenedKeyStart)
	next, err := device.queryBtcSign(&messages.Request{
		Request: &messages.Request_BtcSignInit{
			BtcSignInit: &messages.BTCSignInitRequest{
				Coin:         msgCoin,
				ScriptType:   msgScriptType,
				Bip44Account: bip44Account,
				Version:      uint32(tx.Version),
				NumInputs:    uint32(len(tx.TxIn)),
				NumOutputs:   uint32(len(tx.TxOut)),
				Locktime:     tx.LockTime,
			}}})
	if err != nil {
		return nil, err
	}
	for {
		switch next.Type {
		case messages.BTCSignNextResponse_INPUT:
			inputIndex := next.Index
			txIn := tx.TxIn[inputIndex] // requested input
			prevOut := btcProposedTx.PreviousOutputs[txIn.PreviousOutPoint]

			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignInput{
					BtcSignInput: &messages.BTCSignInputRequest{
						PrevOutHash:  txIn.PreviousOutPoint.Hash[:],
						PrevOutIndex: txIn.PreviousOutPoint.Index,
						PrevOutValue: uint64(prevOut.Value),
						Sequence:     txIn.Sequence,
						Keypath: btcProposedTx.GetAddress(prevOut.ScriptHashHex()).
							Configuration.AbsoluteKeypath().ToUInt32(),
					}}})
			if err != nil {
				return nil, err
			}
			if next.HasSignature {
				sigR := big.NewInt(0).SetBytes(next.Signature[:32])
				sigS := big.NewInt(0).SetBytes(next.Signature[32:])
				signatures[inputIndex] = &btcec.Signature{
					R: sigR,
					S: sigS,
				}
			}
		case messages.BTCSignNextResponse_OUTPUT:
			txOut := tx.TxOut[next.Index] // requested output
			scriptClass, addresses, _, err := txscript.ExtractPkScriptAddrs(txOut.PkScript, coin.Net())
			if err != nil {
				return nil, errp.WithStack(err)
			}
			if len(addresses) != 1 {
				return nil, errp.New("couldn't parse pkScript")
			}
			msgOutputType, ok := msgOutputTypeMap[scriptClass]
			if !ok {
				return nil, errp.Newf("unsupported output type: %d", scriptClass)
			}
			changeAddress := btcProposedTx.TXProposal.ChangeAddress
			isChange := changeAddress != nil && bytes.Equal(
				changeAddress.PubkeyScript(),
				txOut.PkScript,
			)
			var keypath []uint32
			if isChange {
				keypath = changeAddress.Configuration.AbsoluteKeypath().ToUInt32()
			}
			next, err = device.queryBtcSign(&messages.Request{
				Request: &messages.Request_BtcSignOutput{
					BtcSignOutput: &messages.BTCSignOutputRequest{
						Ours:    isChange,
						Type:    msgOutputType,
						Value:   uint64(txOut.Value),
						Hash:    addresses[0].ScriptAddress(),
						Keypath: keypath,
					}}})
			if err != nil {
				return nil, err
			}
		case messages.BTCSignNextResponse_DONE:
			return signatures, nil
		}
	}
}

// CheckSDCard checks whether an sd card is inserted in the device
func (device *Device) CheckSDCard() (bool, error) {
	request := &messages.Request{
		Request: &messages.Request_CheckSdcard{
			CheckSdcard: &messages.CheckSDCardRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return false, err
	}
	sdCardInserted, ok := response.Response.(*messages.Response_CheckSdcard)
	if !ok {
		return false, errp.New("unexpected response")
	}
	return sdCardInserted.CheckSdcard.Inserted, nil
}

// InsertRemoveSDCard sends a command to the device to insert of remove the sd card based on the workflow state
func (device *Device) InsertRemoveSDCard(action messages.InsertRemoveSDCardRequest_SDCardAction) error {
	request := &messages.Request{
		Request: &messages.Request_InsertRemoveSdcard{
			InsertRemoveSdcard: &messages.InsertRemoveSDCardRequest{
				Action: action,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}

// SetMnemonicPassphraseEnabled enables or disables entering a mnemonic passphrase after the normal
// unlock.
func (device *Device) SetMnemonicPassphraseEnabled(enabled bool) error {
	request := &messages.Request{
		Request: &messages.Request_SetMnemonicPassphraseEnabled{
			SetMnemonicPassphraseEnabled: &messages.SetMnemonicPassphraseEnabledRequest{
				Enabled: enabled,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}

func (device *Device) reboot() error {
	request := &messages.Request{
		Request: &messages.Request_Reboot{
			Reboot: &messages.RebootRequest{},
		},
	}
	_, err := device.query(request)
	return err
}

// UpgradeFirmware reboots into the bootloader so a firmware can be flashed.
func (device *Device) UpgradeFirmware() error {
	return device.reboot()
}
