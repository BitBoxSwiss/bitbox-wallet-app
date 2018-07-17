package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/devices/bitbox"
	"github.com/shiftdevices/godbb/backend/devices/bitbox/relay"
	"github.com/shiftdevices/godbb/backend/devices/device"
	"github.com/shiftdevices/godbb/util/errp"
)

// Bitbox models the API of a Bitbox.
type Bitbox interface {
	device.Interface
	Status() bitbox.Status
	BootloaderStatus() (*bitbox.BootloaderStatus, error)
	DeviceInfo() (*bitbox.DeviceInfo, error)
	SetPassword(string) error
	ChangePassword(string, string) error
	SetHiddenPassword(string, string) (bool, error)
	CreateWallet(string, string) error
	Login(string) (bool, string, error)
	Blink() error
	Random(string) (string, error)
	Reset(string) (bool, error)
	XPub(path string) (*hdkeychain.ExtendedKey, error)
	Sign(tx *maketx.TxProposal, hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)
	UnlockBootloader() (bool, error)
	LockBootloader() error
	EraseBackup(string) error
	RestoreBackup(string, string) (bool, error)
	CreateBackup(string, string) error
	BackupList() ([]map[string]string, error)
	BootloaderUpgradeFirmware([]byte) error
	DisplayAddress(keyPath string, typ string) error
	ECDHPKhash(string) (interface{}, error)
	ECDHPK(string) (interface{}, error)
	ECDHchallenge() error
	StartPairing() (*relay.Channel, error)
	Paired() bool
	Lock() (bool, error)
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
	handlers := &Handlers{log: log}

	handleFunc("/status", handlers.getDeviceStatusHandler).Methods("GET")
	handleFunc("/bootloader-status", handlers.getBootloaderStatusHandler).Methods("GET")
	handleFunc("/info", handlers.getDeviceInfoHandler).Methods("GET")
	handleFunc("/paired", handlers.getPairedHandler).Methods("GET")
	handleFunc("/bundled-firmware-version", handlers.getBundledFirmwareVersionHandler).Methods("GET")
	handleFunc("/set-password", handlers.postSetPasswordHandler).Methods("POST")
	handleFunc("/change-password", handlers.postChangePasswordHandler).Methods("POST")
	handleFunc("/set-hidden-password", handlers.postSetHiddenPasswordHandler).Methods("POST")
	handleFunc("/create-wallet", handlers.postCreateWalletHandler).Methods("POST")
	handleFunc("/backups/list", handlers.getBackupListHandler).Methods("GET")
	handleFunc("/blink", handlers.postBlinkDeviceHandler).Methods("POST")
	handleFunc("/random-number", handlers.postGetRandomNumberHandler).Methods("POST")
	handleFunc("/reset", handlers.postResetDeviceHandler).Methods("POST")
	handleFunc("/login", handlers.postLoginHandler).Methods("POST")
	handleFunc("/lock-bootloader", handlers.postLockBootloaderHandler).Methods("POST")
	handleFunc("/unlock-bootloader", handlers.postUnlockBootloaderHandler).Methods("POST")
	handleFunc("/backups/erase", handlers.postBackupsEraseHandler).Methods("POST")
	handleFunc("/backups/restore", handlers.postBackupsRestoreHandler).Methods("POST")
	handleFunc("/backups/create", handlers.postBackupsCreateHandler).Methods("POST")
	handleFunc("/pairing/start", handlers.postPairingStartHandler).Methods("POST")
	handleFunc("/bootloader/upgrade-firmware",
		handlers.postBootloaderUpgradeFirmwareHandler).Methods("POST")
	handleFunc("/lock", handlers.postLockHandler).Methods("POST")
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
		return nil, err
	}
	handlers.log.WithFields(logrus.Fields{"sdCardInserted": sdCardInserted, "backupList": backupList}).
		Debug("Get backup list")
	return map[string]interface{}{
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
	return handlers.bitbox.DeviceInfo()
}

func (handlers *Handlers) getPairedHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.Paired(), nil
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
		handlers.log.WithFields(logrus.Fields{"walletName": filename, "error": err}).
			Error("Failed to restore wallet")
		return map[string]interface{}{"didRestore": false, "errorMessage": err.Error()}, nil
	}
	return map[string]interface{}{"didRestore": didRestore}, nil
}

func (handlers *Handlers) postBackupsCreateHandler(r *http.Request) (interface{}, error) {
	jsonBody := map[string]string{}
	if err := json.NewDecoder(r.Body).Decode(&jsonBody); err != nil {
		return nil, errp.WithStack(err)
	}
	backupName := jsonBody["backupName"]
	recoveryPassword := jsonBody["recoveryPassword"]
	handlers.log.WithField("backupName", backupName).Debug("Create backup")
	if err := handlers.bitbox.CreateBackup(backupName, recoveryPassword); err != nil {
		return maybeDBBErr(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postPairingStartHandler(r *http.Request) (interface{}, error) {
	return handlers.bitbox.StartPairing()
}

func (handlers *Handlers) postBlinkDeviceHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Blink")
	return nil, handlers.bitbox.Blink()
}

func (handlers *Handlers) postGetRandomNumberHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Random Number")
	return handlers.bitbox.Random("true")
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
	return nil, handlers.bitbox.BootloaderUpgradeFirmware(bitbox.BundledFirmware())
}

func (handlers *Handlers) postLockHandler(_ *http.Request) (interface{}, error) {
	return handlers.bitbox.Lock()
}
