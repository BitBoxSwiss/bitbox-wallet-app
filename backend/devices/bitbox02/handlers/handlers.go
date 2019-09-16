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

package handlers

import (
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02common"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02 models the API of the bitbox02 package.
type BitBox02 interface {
	Version() *semver.SemVer
	Status() bitbox02.Status
	Random() ([]byte, error)
	ChannelHash() (string, bool)
	ChannelHashVerify(ok bool)
	DeviceInfo() (*bitbox02.DeviceInfo, error)
	SetDeviceName(deviceName string) error
	SetPassword() error
	CreateBackup() error
	ListBackups() ([]*bitbox02.Backup, error)
	CheckBackup(bool) (string, error)
	RestoreBackup(string) error
	CheckSDCard() (bool, error)
	InsertRemoveSDCard(messages.InsertRemoveSDCardRequest_SDCardAction) error
	SetMnemonicPassphraseEnabled(bool) error
	UpgradeFirmware() error
	Attestation() bool
	Reset() error
	ShowMnemonic() error
	RestoreFromMnemonic() error
	Edition() bitbox02common.Edition
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	device BitBox02
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("device", "bitbox02")}

	handleFunc("/status", handlers.getStatusHandler).Methods("GET")
	handleFunc("/attestation", handlers.getAttestationHandler).Methods("GET")
	handleFunc("/random-number", handlers.postGetRandomNumberHandler).Methods("POST")
	handleFunc("/channel-hash", handlers.getChannelHash).Methods("GET")
	handleFunc("/channel-hash-verify", handlers.postChannelHashVerify).Methods("POST")
	handleFunc("/info", handlers.getDeviceInfo).Methods("GET")
	handleFunc("/set-device-name", handlers.postSetDeviceName).Methods("POST")
	handleFunc("/set-password", handlers.postSetPassword).Methods("POST")
	handleFunc("/backups/create", handlers.postCreateBackup).Methods("POST")
	handleFunc("/backups/check", handlers.postCheckBackup).Methods("POST")
	handleFunc("/backups/list", handlers.getBackupsList).Methods("GET")
	handleFunc("/backups/restore", handlers.postBackupsRestore).Methods("POST")
	handleFunc("/check-sdcard", handlers.getCheckSDCard).Methods("GET")
	handleFunc("/insert-sdcard", handlers.postInsertSDCard).Methods("POST")
	handleFunc("/remove-sdcard", handlers.postRemoveSDCard).Methods("POST")
	handleFunc("/set-mnemonic-passphrase-enabled", handlers.postSetMnemonicPassphraseEnabled).Methods("POST")
	handleFunc("/bundled-firmware-version", handlers.getBundledFirmwareVersionHandler).Methods("GET")
	handleFunc("/upgrade-firmware", handlers.postUpgradeFirmwareHandler).Methods("POST")
	handleFunc("/reset", handlers.postResetHandler).Methods("POST")
	handleFunc("/show-mnemonic", handlers.postShowMnemonicHandler).Methods("POST")
	handleFunc("/restore-from-mnemonic", handlers.postRestoreFromMnemonicHandler).Methods("POST")
	return handlers
}

// Init installs a bitbox02 as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(device BitBox02) {
	handlers.log.Debug("Init")
	handlers.device = device
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.device = nil
}

func maybeBB02Err(err error, log *logrus.Entry) map[string]interface{} {
	result := map[string]interface{}{"success": false}

	if bb02Error, ok := errp.Cause(err).(*bitbox02.Error); ok {
		result["code"] = bb02Error.Code
		result["message"] = bb02Error.Message
		log.WithField("bitbox02-error", bb02Error.Code).Warning("Received an error from Bitbox02")
	}

	return result
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) (interface{}, error) {
	return handlers.device.Status(), nil
}

func (handlers *Handlers) getAttestationHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Attestation")
	return handlers.device.Attestation(), nil
}

func (handlers *Handlers) postGetRandomNumberHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Random Number")
	randomNumber, err := handlers.device.Random()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return hex.EncodeToString(randomNumber), nil
}

func (handlers *Handlers) getDeviceInfo(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Get Device Info")
	deviceInfo, err := handlers.device.DeviceInfo()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return deviceInfo, nil
}

func (handlers *Handlers) postSetDeviceName(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	deviceName := jsonBody["name"]
	if err := handlers.device.SetDeviceName(deviceName); err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSetPassword(r *http.Request) (interface{}, error) {
	if err := handlers.device.SetPassword(); err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil

}

func (handlers *Handlers) postCreateBackup(r *http.Request) (interface{}, error) {
	if err := handlers.device.CreateBackup(); err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getBackupsList(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("List backups ")
	backups, err := handlers.device.ListBackups()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	result := []map[string]string{}
	for _, backup := range backups {
		result = append(result, map[string]string{
			"id":   backup.ID,
			"name": backup.Name,
			"date": backup.Time.Format(time.RFC3339),
		})
	}
	return map[string]interface{}{
		"success": true,
		"backups": result,
	}, nil
}

func (handlers *Handlers) postCheckBackup(r *http.Request) (interface{}, error) {
	handlers.log.Debug("Checking Backup")
	jsonBody := map[string]bool{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	backupID, err := handlers.device.CheckBackup(jsonBody["silent"])
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success":  true,
		"backupID": backupID,
	}, nil
}

func (handlers *Handlers) postBackupsRestore(r *http.Request) (interface{}, error) {
	var backupID string
	if err := json.NewDecoder(r.Body).Decode(&backupID); err != nil {
		return nil, errp.WithStack(err)
	}
	if err := handlers.device.RestoreBackup(backupID); err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getChannelHash(_ *http.Request) (interface{}, error) {
	hash, deviceVerified := handlers.device.ChannelHash()
	return map[string]interface{}{
		"hash":           hash,
		"deviceVerified": deviceVerified,
	}, nil
}

func (handlers *Handlers) postChannelHashVerify(r *http.Request) (interface{}, error) {
	var verify bool
	if err := json.NewDecoder(r.Body).Decode(&verify); err != nil {
		return nil, errp.WithStack(err)
	}
	handlers.device.ChannelHashVerify(verify)
	return nil, nil
}

func (handlers *Handlers) getCheckSDCard(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Checking if SD Card is inserted")
	sdCardInserted, err := handlers.device.CheckSDCard()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return sdCardInserted, nil
}

func (handlers *Handlers) postInsertSDCard(r *http.Request) (interface{}, error) {
	handlers.log.Debug("Insert SD Card if not inserted")
	err := handlers.device.InsertRemoveSDCard(messages.InsertRemoveSDCardRequest_INSERT_CARD)
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postRemoveSDCard(r *http.Request) (interface{}, error) {
	handlers.log.Debug("Remove SD Card if inserted")
	err := handlers.device.InsertRemoveSDCard(messages.InsertRemoveSDCardRequest_REMOVE_CARD)
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSetMnemonicPassphraseEnabled(r *http.Request) (interface{}, error) {
	var enabled bool
	if err := json.NewDecoder(r.Body).Decode(&enabled); err != nil {
		return nil, errp.WithStack(err)
	}
	if err := handlers.device.SetMnemonicPassphraseEnabled(enabled); err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) getBundledFirmwareVersionHandler(_ *http.Request) (interface{}, error) {
	currentVersion := handlers.device.Version()
	newVersion := bitbox02bootloader.BundledFirmwareVersion(handlers.device.Edition())
	return map[string]interface{}{
		"currentVersion": currentVersion.String(),
		"newVersion":     newVersion.String(),
		"canUpgrade":     newVersion.AtLeast(currentVersion) && currentVersion.String() != newVersion.String(),
	}, nil
}

func (handlers *Handlers) postUpgradeFirmwareHandler(_ *http.Request) (interface{}, error) {
	err := handlers.device.UpgradeFirmware()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return nil, nil
}

func (handlers *Handlers) postResetHandler(_ *http.Request) (interface{}, error) {
	err := handlers.device.Reset()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postShowMnemonicHandler(_ *http.Request) (interface{}, error) {
	err := handlers.device.ShowMnemonic()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postRestoreFromMnemonicHandler(_ *http.Request) (interface{}, error) {
	err := handlers.device.RestoreFromMnemonic()
	if err != nil {
		return maybeBB02Err(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}
