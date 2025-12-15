// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox/relay"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Bitbox models the API of a Bitbox.
type Bitbox interface {
	Status() bitbox.Status
	BootloaderStatus() (*bitbox.BootloaderStatus, error)
	DeviceInfo() (*bitbox.DeviceInfo, error)
	SetPassword(string) error
	ChangePassword(string, string) error
	SetHiddenPassword(string, string) (bool, error)
	CreateWallet(string, string) error
	Login(string) (bool, string, error)
	Blink() error
	Reset(string) (bool, error)
	UnlockBootloader() (bool, error)
	LockBootloader() error
	EraseBackup(string) error
	RestoreBackup(string, string) (bool, error)
	CreateBackup(string, string) (bool, error)
	BackupList() ([]map[string]string, error)
	BootloaderUpgradeFirmware([]byte) error
	StartPairing() (*relay.Channel, error)
	HasMobileChannel() bool
	Lock() (bool, error)
	CheckBackup(string, string) (bool, error)
	FeatureSet(*bitbox.FeatureSet) error
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	bitbox Bitbox
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("device", "bitbox")}

	handleFunc("/status", handlers.getDeviceStatusHandler).Methods("GET")
	handleFunc("/bootloader-status", handlers.getBootloaderStatusHandler).Methods("GET")
	handleFunc("/info", handlers.getDeviceInfoHandler).Methods("GET")
	handleFunc("/has-mobile-channel", handlers.getHasMobileChannelHandler).Methods("GET")
	handleFunc("/bundled-firmware-version", handlers.getBundledFirmwareVersionHandler).Methods("GET")
	handleFunc("/set-password", handlers.postSetPasswordHandler).Methods("POST")
	handleFunc("/change-password", handlers.postChangePasswordHandler).Methods("POST")
	handleFunc("/set-hidden-password", handlers.postSetHiddenPasswordHandler).Methods("POST")
	handleFunc("/create-wallet", handlers.postCreateWalletHandler).Methods("POST")
	handleFunc("/backups/list", handlers.getBackupListHandler).Methods("GET")
	handleFunc("/blink", handlers.postBlinkDeviceHandler).Methods("POST")
	handleFunc("/reset", handlers.postResetDeviceHandler).Methods("POST")
	handleFunc("/login", handlers.postLoginHandler).Methods("POST")
	handleFunc("/lock-bootloader", handlers.postLockBootloaderHandler).Methods("POST")
	handleFunc("/unlock-bootloader", handlers.postUnlockBootloaderHandler).Methods("POST")
	handleFunc("/backups/erase", handlers.postBackupsEraseHandler).Methods("POST")
	handleFunc("/backups/restore", handlers.postBackupsRestoreHandler).Methods("POST")
	handleFunc("/backups/create", handlers.postBackupsCreateHandler).Methods("POST")
	handleFunc("/backups/check", handlers.postBackupsCheckHandler).Methods("POST")
	handleFunc("/pairing/start", handlers.postPairingStartHandler).Methods("POST")
	handleFunc("/bootloader/upgrade-firmware",
		handlers.postBootloaderUpgradeFirmwareHandler).Methods("POST")
	handleFunc("/lock", handlers.postLockHandler).Methods("POST")
	handleFunc("/feature-set", handlers.postFeatureSetHandler).Methods("POST")
	return handlers
}

// Init installs a dbbdevice as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(bitbox Bitbox) {
	handlers.log.Debug("Init")
	handlers.bitbox = bitbox
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.bitbox = nil
}

func (handlers *Handlers) postSetPasswordHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	password := jsonBody["password"]
	if err := handlers.bitbox.SetPassword(password); err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	handlers.log.Debug("Set password on device")
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postChangePasswordHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	newPIN := jsonBody["newPIN"]
	oldPIN := jsonBody["oldPIN"]
	if err := handlers.bitbox.ChangePassword(oldPIN, newPIN); err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	handlers.log.Debug("Change password on device")
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSetHiddenPasswordHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	pin := jsonBody["pin"]
	backupPassword := jsonBody["backupPassword"]
	success, err := handlers.bitbox.SetHiddenPassword(pin, backupPassword)
	if err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true, "didCreate": success}, nil
}

func (handlers *Handlers) getBackupListHandler(_ *http.Request) (interface{}, error) {
	backupList, err := handlers.bitbox.BackupList()
	sdCardInserted := !bitbox.IsErrorSDCard(err)
	if sdCardInserted && err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	handlers.log.WithFields(logrus.Fields{"sdCardInserted": sdCardInserted, "backupList": backupList}).
		Debug("Get backup list")
	return map[string]interface{}{
		"success":        true,
		"sdCardInserted": sdCardInserted,
		"backupList":     backupList,
	}, nil
}

func (handlers *Handlers) getDeviceStatusHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.Status(), nil
}

func (handlers *Handlers) getBootloaderStatusHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.BootloaderStatus()
}

func (handlers *Handlers) getDeviceInfoHandler(_ *http.Request) (interface{}, error) {
	info, err := handlers.bitbox.DeviceInfo()
	if errp.Cause(err) == bitbox.ErrMustBeLoggedIn {
		return nil, nil
	}
	return info, err
}

func (handlers *Handlers) getHasMobileChannelHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.HasMobileChannel(), nil
}

func (handlers *Handlers) getBundledFirmwareVersionHandler(_ *http.Request) (interface{}, error) {
	return "v" + bitbox.BundledFirmwareVersion().String(), nil
}

func maybeDBBErr(err error, log *logrus.Entry) map[string]interface{} {
	result := map[string]interface{}{"success": false, "errorMessage": err.Error()}
	if _, ok := errp.Cause(err).(bitbox.PasswordValidationError); ok {
		const errWrongPW = 102
		result["code"] = errWrongPW
		return result
	}

	if dbbErr, ok := errp.Cause(err).(*bitbox.Error); ok {
		result["code"] = dbbErr.Code
		log.WithField("bitbox-error", dbbErr.Code).Warning("Received an error from Bitbox")
	}
	return result
}

func (handlers *Handlers) postLoginHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	password := jsonBody["password"]
	handlers.log.Debug("Login")
	needsLongTouch, remainingAttempts, err := handlers.bitbox.Login(password)
	if err != nil {
		result := maybeDBBErr(err, handlers.log)
		result["remainingAttempts"] = remainingAttempts
		result["needsLongTouch"] = needsLongTouch
		return result, nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postCreateWalletHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	walletName := jsonBody["walletName"]
	backupPassword := jsonBody["backupPassword"]

	handlers.log.WithField("walletName", walletName).Debug("Create wallet")

	if err := handlers.bitbox.CreateWallet(walletName, backupPassword); err != nil {
		handlers.log.WithFields(logrus.Fields{"walletName": walletName, "error": err}).
			Error("Failed to create wallet")
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postLockBootloaderHandler(_ *http.Request) (interface{}, error) {
	return nil, handlers.bitbox.LockBootloader()
}

func (handlers *Handlers) postUnlockBootloaderHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.UnlockBootloader()
}

func (handlers *Handlers) postBackupsEraseHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	filename := jsonBody["filename"]
	handlers.log.WithField("filename", filename).Debug("Erase backup")
	return nil, handlers.bitbox.EraseBackup(filename)
}

func (handlers *Handlers) postBackupsRestoreHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	filename := jsonBody["filename"]
	handlers.log.WithField("filename", filename).Debug("Restore backup")
	didRestore, err := handlers.bitbox.RestoreBackup(jsonBody["password"], filename)
	if err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true, "didRestore": didRestore}, nil
}

func (handlers *Handlers) postBackupsCheckHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	filename := jsonBody["filename"]
	handlers.log.WithField("filename", filename).Debug("Check backup")
	matches, err := handlers.bitbox.CheckBackup(jsonBody["password"], filename)
	if err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true, "matches": matches}, nil
}

func (handlers *Handlers) postBackupsCreateHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	backupName := jsonBody["backupName"]
	recoveryPassword := jsonBody["recoveryPassword"]
	handlers.log.WithField("backupName", backupName).Debug("Create backup")
	verification, err := handlers.bitbox.CreateBackup(backupName, recoveryPassword)
	if err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true, "verification": verification}, nil
}

func (handlers *Handlers) postPairingStartHandler(r *http.Request) (interface{}, error) {
	return handlers.bitbox.StartPairing()
}

func (handlers *Handlers) postBlinkDeviceHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Blink")
	return nil, handlers.bitbox.Blink()
}

func (handlers *Handlers) postResetDeviceHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("Reset")
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	didReset, err := handlers.bitbox.Reset(jsonBody["pin"])
	if err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"didReset": didReset}, nil
}

func (handlers *Handlers) postBootloaderUpgradeFirmwareHandler(_ *http.Request) (interface{}, error) {
	binary, err := bitbox.BundledFirmware()
	if err != nil {
		return nil, err
	}
	return nil, handlers.bitbox.BootloaderUpgradeFirmware(binary)
}

func (handlers *Handlers) postLockHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.Lock()
}

func (handlers *Handlers) postFeatureSetHandler(r *http.Request) (interface{}, error) {
	featureSet := &bitbox.FeatureSet{}
	if err := json.NewDecoder(r.Body).Decode(featureSet); err != nil {
		return nil, errp.WithStack(err)
	}
	return nil, handlers.bitbox.FeatureSet(featureSet)
}
