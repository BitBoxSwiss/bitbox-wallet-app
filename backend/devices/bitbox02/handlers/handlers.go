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
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02 models the API of the bitbox02 package.
type BitBox02 interface {
	Status() bitbox02.Status
	Random() ([]byte, error)
	ChannelHash() (string, bool)
	ChannelHashVerify(ok bool)
	DeviceInfo() (*bitbox02.DeviceInfo, error)
	SetDeviceName(deviceName string) error
	SetPassword() error
	CreateBackup() error
	ListBackups() ([]*bitbox02.Backup, error)
	RestoreBackup(string) error
	InsertRemoveSDCard(messages.InsertRemoveSDCardRequest_SDCardAction) error
	SetMnemonicPassphraseEnabled(bool) error
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
	handleFunc("/random-number", handlers.postGetRandomNumberHandler).Methods("POST")
	handleFunc("/channel-hash", handlers.getChannelHash).Methods("GET")
	handleFunc("/channel-hash-verify", handlers.postChannelHashVerify).Methods("POST")
	handleFunc("/info", handlers.getDeviceInfo).Methods("GET")
	handleFunc("/set-device-name", handlers.postSetDeviceName).Methods("POST")
	handleFunc("/set-password", handlers.postSetPassword).Methods("POST")
	handleFunc("/create-backup", handlers.postCreateBackup).Methods("POST")
	handleFunc("/backups/list", handlers.getBackupsList).Methods("GET")
	handleFunc("/backups/restore", handlers.postBackupsRestore).Methods("POST")
	handleFunc("/insert-sdcard", handlers.postInsertSDCard).Methods("POST")
	handleFunc("/remove-sdcard", handlers.postRemoveSDCard).Methods("POST")
	handleFunc("/set-mnemonic-passphrase-enabled", handlers.postSetMnemonicPassphraseEnabled).Methods("POST")

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
			"date": backup.Time.Format(time.RFC3339),
		})
	}
	return map[string]interface{}{
		"success": true,
		"backups": result,
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
