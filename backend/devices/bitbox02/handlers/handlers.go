// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02 models the API of the bitbox02 package.
type BitBox02 interface {
	Version() *semver.SemVer
	Status() firmware.Status
	ChannelHash() (string, bool)
	ChannelHashVerify(ok bool)
	DeviceInfo() (*firmware.DeviceInfo, error)
	SetDeviceName(deviceName string) error
	SetPassword(seedLen int) error
	ChangePassword() error
	CreateBackup() error
	ListBackups() ([]*firmware.Backup, error)
	CheckBackup(bool) (string, error)
	RestoreBackup(string) error
	CheckSDCard() (bool, error)
	InsertSDCard() error
	SetMnemonicPassphraseEnabled(bool) error
	UpgradeFirmware() error
	Attestation() *bool
	Reset() error
	ShowMnemonic() error
	RestoreFromMnemonic() error
	Product() bitbox02common.Product
	GotoStartupSettings() error
	RootFingerprint() ([]byte, error)
	BIP85AppBip39() error
	BluetoothToggleEnabled() error
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	device BitBox02
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) interface{}) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("device", "bitbox02")}

	handleFunc("/status", handlers.getStatusHandler).Methods("GET")
	handleFunc("/attestation", handlers.getAttestationHandler).Methods("GET")
	handleFunc("/channel-hash", handlers.getChannelHash).Methods("GET")
	handleFunc("/channel-hash-verify", handlers.postChannelHashVerify).Methods("POST")
	handleFunc("/info", handlers.getDeviceInfo).Methods("GET")
	handleFunc("/set-device-name", handlers.postSetDeviceName).Methods("POST")
	handleFunc("/set-password", handlers.postSetPassword).Methods("POST")
	handleFunc("/change-password", handlers.postChangePassword).Methods("POST")
	handleFunc("/backups/create", handlers.postCreateBackup).Methods("POST")
	handleFunc("/backups/check", handlers.postCheckBackup).Methods("POST")
	handleFunc("/backups/list", handlers.getBackupsList).Methods("GET")
	handleFunc("/backups/restore", handlers.postBackupsRestore).Methods("POST")
	handleFunc("/check-sdcard", handlers.getCheckSDCard).Methods("GET")
	handleFunc("/insert-sdcard", handlers.postInsertSDCard).Methods("POST")
	handleFunc("/set-mnemonic-passphrase-enabled", handlers.postSetMnemonicPassphraseEnabled).Methods("POST")
	handleFunc("/version", handlers.getVersionHandler).Methods("GET")
	handleFunc("/upgrade-firmware", handlers.postUpgradeFirmwareHandler).Methods("POST")
	handleFunc("/reset", handlers.postResetHandler).Methods("POST")
	handleFunc("/show-mnemonic", handlers.postShowMnemonicHandler).Methods("POST")
	handleFunc("/restore-from-mnemonic", handlers.postRestoreFromMnemonicHandler).Methods("POST")
	handleFunc("/goto-startup-settings", handlers.postGotoStartupSettings).Methods("POST")
	handleFunc("/root-fingerprint", handlers.getRootFingerprint).Methods("GET")
	handleFunc("/invoke-bip85", handlers.postInvokeBIP85Handler).Methods("POST")
	handleFunc("/bluetooth/toggle-enabled", handlers.postBluetoothToggleEnabled).Methods("POST")
	return handlers
}

// Init installs a bitbox02 as a base for the web firmware. This needs to be called before any requests
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

	if bb02Error, ok := errp.Cause(err).(*firmware.Error); ok {
		result["code"] = bb02Error.Code
		result["message"] = bb02Error.Message
		log.WithField("bitbox02-error", bb02Error.Code).Warning("Received an error from Bitbox02")
	} else {
		log.WithField("error", err).Error("Received an error from when querying the BitBox02")
	}

	return result
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) interface{} {
	return handlers.device.Status()
}

func (handlers *Handlers) getAttestationHandler(_ *http.Request) interface{} {
	handlers.log.Debug("Attestation")
	return handlers.device.Attestation()
}

func (handlers *Handlers) getDeviceInfo(_ *http.Request) interface{} {
	handlers.log.Debug("Get Device Info")
	deviceInfo, err := handlers.device.DeviceInfo()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{
		"success":    true,
		"deviceInfo": deviceInfo,
	}
}

func (handlers *Handlers) postSetDeviceName(r *http.Request) interface{} {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return map[string]interface{}{"success": false}
	}
	deviceName := jsonBody["name"]
	if err := handlers.device.SetDeviceName(strings.TrimSpace(deviceName)); err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postSetPassword(r *http.Request) interface{} {
	var seedLen int
	if err := json.NewDecoder(r.Body).Decode(&seedLen); err != nil {
		return map[string]interface{}{"success": false}
	}
	if err := handlers.device.SetPassword(seedLen); err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postChangePassword(_ *http.Request) interface{} {
	err := handlers.device.ChangePassword()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postCreateBackup(r *http.Request) interface{} {
	var backupMethod string
	if err := json.NewDecoder(r.Body).Decode(&backupMethod); err != nil {
		return map[string]interface{}{"success": false}
	}
	switch backupMethod {
	case "sdcard":
		if err := handlers.device.CreateBackup(); err != nil {
			return maybeBB02Err(err, handlers.log)
		}
	case "recovery-words":
		if err := handlers.device.ShowMnemonic(); err != nil {
			return maybeBB02Err(err, handlers.log)
		}
	default:
		return map[string]interface{}{"success": false}
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) getBackupsList(_ *http.Request) interface{} {
	handlers.log.Debug("List backups ")
	backups, err := handlers.device.ListBackups()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].Time.After(backups[j].Time)
	})
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
	}
}

func (handlers *Handlers) postCheckBackup(r *http.Request) interface{} {
	handlers.log.Debug("Checking Backup")
	jsonBody := map[string]bool{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return map[string]interface{}{"success": false}
	}
	backupID, err := handlers.device.CheckBackup(jsonBody["silent"])
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{
		"success":  true,
		"backupID": backupID,
	}
}

func (handlers *Handlers) postBackupsRestore(r *http.Request) interface{} {
	var backupID string

	type response struct {
		Success bool   `json:"success"`
		Message string `json:"message,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&backupID); err != nil {
		return response{Success: false, Message: err.Error()}
	}
	if err := handlers.device.RestoreBackup(backupID); err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) getChannelHash(_ *http.Request) interface{} {
	hash, deviceVerified := handlers.device.ChannelHash()
	return map[string]interface{}{
		"hash":           hash,
		"deviceVerified": deviceVerified,
	}
}

func (handlers *Handlers) postChannelHashVerify(r *http.Request) interface{} {
	var verify bool
	if err := json.NewDecoder(r.Body).Decode(&verify); err != nil {
		handlers.log.WithError(err).Panic("could not decode json body")
	}
	handlers.device.ChannelHashVerify(verify)
	return nil
}

func (handlers *Handlers) getCheckSDCard(_ *http.Request) interface{} {
	handlers.log.Debug("Checking if SD Card is inserted")
	sdCardInserted, err := handlers.device.CheckSDCard()
	if err != nil {
		handlers.log.WithError(err).Error("CheckSDCard failed")
		return false
	}
	handlers.log.Infof("CheckSDCard result: %v", sdCardInserted)
	return sdCardInserted
}

func (handlers *Handlers) postInsertSDCard(r *http.Request) interface{} {
	handlers.log.Debug("Insert SD Card if not inserted")
	err := handlers.device.InsertSDCard()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postSetMnemonicPassphraseEnabled(r *http.Request) interface{} {
	var enabled bool
	if err := json.NewDecoder(r.Body).Decode(&enabled); err != nil {
		return map[string]interface{}{"success": false}
	}
	if err := handlers.device.SetMnemonicPassphraseEnabled(enabled); err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) getVersionHandler(_ *http.Request) interface{} {
	currentVersion := handlers.device.Version()
	newVersion := bitbox02bootloader.BundledFirmwareVersion(handlers.device.Product())
	var newVersionStr string
	var canUpgrade bool
	if newVersion != nil {
		newVersionStr = newVersion.String()
		canUpgrade = newVersion.AtLeast(currentVersion) && currentVersion.String() != newVersion.String()
	}
	return struct {
		CurrentVersion         string `json:"currentVersion"`
		NewVersion             string `json:"newVersion,omitempty"`
		CanUpgrade             bool   `json:"canUpgrade"`
		CanGotoStartupSettings bool   `json:"canGotoStartupSettings"`
		// If true, creating a backup using the mnemonic recovery words instead of the microSD card
		// is supported in the initial setup.
		//
		// If false, the backup must be performed using the microSD card in the initial setup.
		//
		// This has no influence over whether one can display the recovery words after the initial
		// setup - that is always possible regardless of this value.
		CanBackupWithRecoveryWords bool `json:"canBackupWithRecoveryWords"`
		// If true, it is possible to create a 12-word seed by passing `16` as `seedLen` to
		// `SetPassword()`. Otherwise, only `32` is allowed, corresponding to 24 words.
		CanCreate12Words  bool `json:"canCreate12Words"`
		CanBIP85          bool `json:"canBIP85"`
		CanChangePassword bool `json:"canChangePassword"`
	}{
		CurrentVersion:             currentVersion.String(),
		NewVersion:                 newVersionStr,
		CanUpgrade:                 canUpgrade,
		CanGotoStartupSettings:     currentVersion.AtLeast(semver.NewSemVer(9, 6, 0)),
		CanBackupWithRecoveryWords: currentVersion.AtLeast(semver.NewSemVer(9, 13, 0)),
		CanCreate12Words:           currentVersion.AtLeast(semver.NewSemVer(9, 6, 0)),
		CanBIP85:                   currentVersion.AtLeast(semver.NewSemVer(9, 18, 0)),
		CanChangePassword:          currentVersion.AtLeast(semver.NewSemVer(9, 25, 0)),
	}
}

func (handlers *Handlers) postUpgradeFirmwareHandler(_ *http.Request) interface{} {
	err := handlers.device.UpgradeFirmware()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return nil
}

func (handlers *Handlers) postResetHandler(_ *http.Request) interface{} {
	err := handlers.device.Reset()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postShowMnemonicHandler(_ *http.Request) interface{} {
	err := handlers.device.ShowMnemonic()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postRestoreFromMnemonicHandler(_ *http.Request) interface{} {
	err := handlers.device.RestoreFromMnemonic()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postGotoStartupSettings(_ *http.Request) interface{} {
	err := handlers.device.GotoStartupSettings()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) getRootFingerprint(_ *http.Request) interface{} {
	fingerprint, err := handlers.device.RootFingerprint()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{
		"success":         true,
		"rootFingerprint": hex.EncodeToString(fingerprint),
	}
}

func (handlers *Handlers) postInvokeBIP85Handler(_ *http.Request) interface{} {
	err := handlers.device.BIP85AppBip39()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}

func (handlers *Handlers) postBluetoothToggleEnabled(_ *http.Request) interface{} {
	err := handlers.device.BluetoothToggleEnabled()
	if err != nil {
		return maybeBB02Err(err, handlers.log)
	}
	return map[string]interface{}{"success": true}
}
