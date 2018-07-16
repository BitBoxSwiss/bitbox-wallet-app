// Package bitbox contains the API to the physical device.
package bitbox

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/pbkdf2"

	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/devices/bitbox/relay"
	"github.com/shiftdevices/godbb/backend/devices/device"
	keystoreInterface "github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/semver"
)

var (
	lowestSupportedFirmwareVersion    = semver.NewSemVer(3, 0, 2)
	lowestNonSupportedFirmwareVersion = semver.NewSemVer(4, 0, 0)

	pinPolicyProd              = NewPasswordPolicy("^[[:print:]]{4,}$")
	pinPolicyTest              = NewPasswordPolicy("^[[:print:]]{4,}$")
	recoveryPasswordPolicyProd = NewPasswordPolicy("^[[:print:]]{8,}$")
	recoveryPasswordPolicyTest = NewPasswordPolicy("^[[:print:]]{4,}$")
)

var errNoBootloader = errors.New("invalid command in bootloader")

const (
	// EventStatusChanged is fired when the status changes. Check the status using Status().
	EventStatusChanged device.Event = "statusChanged"

	// EventBootloaderStatusChanged is fired when the bootloader status changes. Check the status
	// using BootloaderStatus().
	EventBootloaderStatusChanged device.Event = "bootloaderStatusChanged"

	// signatureBatchSize is the amount of signatures that can be handled by the Bitbox in one batch
	// (with one long-touch).
	signatureBatchSize = 15

	// ProductName is the name of the bitbox.
	ProductName = "bitbox"

	// backupDateFormat is the date format used in the backup name.
	backupDateFormat = "2006-01-02-15-04-05"
)

// CommunicationInterface contains functions needed to communicate with the device.
//go:generate mockery -name CommunicationInterface
type CommunicationInterface interface {
	SendPlain(string) (map[string]interface{}, error)
	SendEncrypt(string, string) (map[string]interface{}, error)
	SendBootloader([]byte) ([]byte, error)
	Close()
}

// DeviceInfo is the data returned from the device info api call.
type DeviceInfo struct {
	Version   string `json:"version"`
	Serial    string `json:"serial"`
	ID        string `json:"id"`
	TFA       string `json:"TFA"`
	Bootlock  bool   `json:"bootlock"`
	Name      string `json:"name"`
	SDCard    bool   `json:"sdcard"`
	Lock      bool   `json:"lock"`
	U2F       bool   `json:"U2F"`
	U2FHijack bool   `json:"U2F_hijack"`
	Seeded    bool   `json:"seeded"`
}

// Device provides the API to communicate with the digital bitbox.
type Device struct {
	deviceID      string
	communication CommunicationInterface
	onEvent       func(device.Event, interface{})

	// If set, the device is in bootloader mode.
	bootloaderStatus *BootloaderStatus

	// firmware or bootloader version.
	version *semver.SemVer

	// If set, the device is configured with a PIN.
	initialized bool

	// If set, the user is "logged in".
	pin string

	// If set, the device contains a wallet.
	seeded bool

	// The password policy for the device PIN.
	pinPolicy *PasswordPolicy

	// The password policy for the wallet recovery password.
	recoveryPasswordPolicy *PasswordPolicy

	// If set, the channel can be used to communicate to the mobile.
	channel *relay.Channel

	closed bool

	log *logrus.Entry
}

// NewDevice creates a new instance of Device.
// bootloader enables the bootloader API and should be true only if the device is in bootloader mode.
// communication is used for transporting messages to/from the device.
func NewDevice(
	deviceID string,
	bootloader bool,
	version *semver.SemVer,
	communication CommunicationInterface) (*Device, error) {
	if bootloader {
		if !version.Between(lowestSupportedBootloaderVersion, lowestNonSupportedBootloaderVersion) {
			return nil, errp.Newf("The bootloader version '%s' is not supported.", version)
		}
	}
	log := logging.Get().WithGroup("device").WithField("deviceID", deviceID)
	log.WithFields(logrus.Fields{"deviceID": deviceID, "version": version}).Info("Plugged in device")

	var bootloaderStatus *BootloaderStatus
	if bootloader {
		bootloaderStatus = &BootloaderStatus{}
	}
	device := &Device{
		deviceID:         deviceID,
		bootloaderStatus: bootloaderStatus,
		version:          version,
		communication:    communication,
		onEvent:          nil,
		channel:          relay.NewChannelFromConfigFile(),

		closed: false,
		log:    log,
	}

	if device.channel != nil {
		device.ListenForMobile()
	}

	if !bootloader {
		if !version.AtLeast(semver.NewSemVer(3, 0, 0)) {
			// Sleep a bit to wait for the device to initialize. Sending commands too early in older
			// firmware (fixed since v3.0.0) means the internal memory might not be initialized, and
			// we run into the PIN retry check, requiring a long touch by the user.
			time.Sleep(1 * time.Second)
		}

		// Ping to check if the device is initialized. Sometimes, booting takes a couple of seconds,
		// so repeat the command until it is ready.
		var initialized bool
		for i := 0; i < 20; i++ {
			var err error
			initialized, err = device.Ping()
			if err != nil {
				if dbbErr, ok := errp.Cause(err).(*Error); ok && dbbErr.Code == ErrInitializing {
					time.Sleep(500 * time.Millisecond)
					continue
				}
				return nil, err
			}
			break
		}
		device.initialized = initialized
		log.WithFields(logrus.Fields{"deviceID": deviceID, "initialized": initialized}).Debug("Device initialization status")
	}
	return device, nil
}

// Init initialized the device. testing means the device is initialized for testnet.
func (dbb *Device) Init(testing bool) {
	dbb.setPasswordPolicy(testing)
}

// setPasswordPolicy sets the password policy to the test or prod policy.
func (dbb *Device) setPasswordPolicy(testing bool) {
	if testing {
		dbb.pinPolicy = pinPolicyTest
		dbb.recoveryPasswordPolicy = recoveryPasswordPolicyTest
	} else {
		dbb.pinPolicy = pinPolicyProd
		dbb.recoveryPasswordPolicy = recoveryPasswordPolicyProd
	}
}

// SetOnEvent installs a callback which is called for various events.
func (dbb *Device) SetOnEvent(onEvent func(device.Event, interface{})) {
	dbb.onEvent = onEvent
}

func (dbb *Device) fireEvent(event device.Event, data interface{}) {
	if dbb.onEvent != nil {
		dbb.onEvent(event, data)
	}
}

func (dbb *Device) onStatusChanged() {
	dbb.fireEvent(EventStatusChanged, nil)
	switch dbb.Status() {
	case StatusSeeded:
		dbb.fireEvent(device.EventKeystoreAvailable, nil)
	case StatusUninitialized:
		dbb.fireEvent(device.EventKeystoreGone, nil)
	}
}

// Status returns the device state. See the Status* constants.
func (dbb *Device) Status() Status {
	if dbb.bootloaderStatus != nil {
		return StatusBootloader
	}
	defer dbb.log.WithFields(logrus.Fields{"deviceID": dbb.deviceID, "seeded": dbb.seeded,
		"pin-set": (dbb.pin != ""), "initialized": dbb.initialized}).Debug("Device status")
	if (dbb.seeded || dbb.pin != "") && !dbb.version.Between(lowestSupportedFirmwareVersion, lowestNonSupportedFirmwareVersion) {
		return StatusRequireUpgrade
	}
	if dbb.seeded {
		return StatusSeeded
	}
	if dbb.pin != "" {
		return StatusLoggedIn
	}
	if dbb.initialized {
		return StatusInitialized
	}
	return StatusUninitialized
}

// Close closes the HID device.
func (dbb *Device) Close() {
	dbb.log.WithFields(logrus.Fields{"deviceID": dbb.deviceID}).Debug("Close connection")
	dbb.communication.Close()
	dbb.closed = true
}

func (dbb *Device) sendPlain(key, val string) (map[string]interface{}, error) {
	jsonText, err := json.Marshal(map[string]string{key: val})
	if err != nil {
		return nil, err
	}
	return dbb.communication.SendPlain(string(jsonText))
}

func (dbb *Device) send(value interface{}, pin string) (map[string]interface{}, error) {
	return dbb.communication.SendEncrypt(string(jsonp.MustMarshal(value)), pin)
}

func (dbb *Device) sendKV(key, value, pin string) (map[string]interface{}, error) {
	return dbb.send(map[string]string{key: value}, pin)
}

func (dbb *Device) deviceInfo(pin string) (*DeviceInfo, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	reply, err := dbb.sendKV("device", "info", pin)
	if err != nil {
		return nil, err
	}
	deviceInfo := &DeviceInfo{}

	device, ok := reply["device"].(map[string]interface{})
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	if deviceInfo.Serial, ok = device["serial"].(string); !ok {
		dbb.log = dbb.log.WithField("serial", deviceInfo.Serial)
		return nil, errp.New("no serial")
	}
	if deviceInfo.ID, ok = device["id"].(string); !ok {
		dbb.log = dbb.log.WithField("id", deviceInfo.ID)
		return nil, errp.New("no id")
	}
	if deviceInfo.TFA, ok = device["TFA"].(string); !ok {
		dbb.log = dbb.log.WithField("TFA", deviceInfo.TFA)
		return nil, errp.New("no TFA")
	}
	if deviceInfo.Bootlock, ok = device["bootlock"].(bool); !ok {
		dbb.log = dbb.log.WithField("bootlock", deviceInfo.Bootlock)
		return nil, errp.New("no bootlock")
	}
	if deviceInfo.Name, ok = device["name"].(string); !ok {
		dbb.log = dbb.log.WithField("name", deviceInfo.Name)
		return nil, errp.New("device name")
	}
	if deviceInfo.SDCard, ok = device["sdcard"].(bool); !ok {
		dbb.log = dbb.log.WithField("sdcard", deviceInfo.SDCard)
		return nil, errp.New("SD card")
	}
	if deviceInfo.Lock, ok = device["lock"].(bool); !ok {
		dbb.log = dbb.log.WithField("lock", deviceInfo.Lock)
		return nil, errp.New("lock")
	}
	if deviceInfo.U2F, ok = device["U2F"].(bool); !ok {
		dbb.log = dbb.log.WithField("U2F", deviceInfo.U2F)
		return nil, errp.New("U2F")
	}
	if deviceInfo.U2FHijack, ok = device["U2F_hijack"].(bool); !ok {
		dbb.log = dbb.log.WithField("U2F_hijack", deviceInfo.U2FHijack)
		return nil, errp.New("U2F_hijack")
	}
	if deviceInfo.Version, ok = device["version"].(string); !ok {
		dbb.log = dbb.log.WithField("version", deviceInfo.Version)
		return nil, errp.New("version")
	}
	if deviceInfo.Seeded, ok = device["seeded"].(bool); !ok {
		dbb.log = dbb.log.WithField("seeded", deviceInfo.Seeded)
		return nil, errp.New("version")
	}
	dbb.log.Debug("Device info")
	return deviceInfo, nil
}

// DeviceInfo gets device information.
func (dbb *Device) DeviceInfo() (*DeviceInfo, error) {
	return dbb.deviceInfo(dbb.pin)
}

// Ping returns true if the device is initialized, and false if it is not.
func (dbb *Device) Ping() (bool, error) {
	if dbb.bootloaderStatus != nil {
		return false, errp.WithStack(errNoBootloader)
	}
	reply, err := dbb.sendPlain("ping", "")
	if err != nil {
		return false, err
	}
	ping, ok := reply["ping"].(string)
	initialized := ok && ping == "password"
	dbb.log.WithField("ping", ping).Debug("Ping")
	return initialized, nil
}

// SetPassword defines a PIN for the device. This only works on a fresh device. If a password has
// already been configured, a new one cannot be set until the device is reset.
func (dbb *Device) SetPassword(pin string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	if ok, err := dbb.pinPolicy.ValidatePassword(pin); !ok {
		return err
	}

	if dbb.Status() != StatusUninitialized {
		return errp.New("device has to be uninitialized")
	}
	reply, err := dbb.sendPlain("password", pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to set new pin")
	}
	if reply["password"] != "success" {
		return errp.New("Unexpected reply")
	}
	dbb.log.Debug("Pin set")
	dbb.pin = pin
	dbb.onStatusChanged()
	return nil
}

// ChangePassword replaces the PIN for the device. This only works when logged in, so the oldPIN can
// be checked.
func (dbb *Device) ChangePassword(oldPIN string, newPIN string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	if ok, err := dbb.pinPolicy.ValidatePassword(newPIN); !ok {
		return err
	}

	if dbb.Status() == StatusUninitialized || dbb.pin == "" {
		return errp.New("device has to be initialized")
	}
	if dbb.pin != oldPIN {
		return errp.New("Old PIN incorrect")
	}
	reply, err := dbb.sendKV("password", newPIN, oldPIN)
	if err != nil {
		return errp.WithMessage(err, "Failed to replace pin")
	}
	if reply["password"] != "success" {
		return errp.New("Unexpected reply")
	}
	dbb.log.Debug("Pin replaced")
	dbb.pin = newPIN
	dbb.onStatusChanged()
	return nil
}

// Login validates the pin. This needs to be called before using any API call except for Ping() and
// SetPassword(). It returns whether the next login attempt requires a long-touch, and the number of
// remaining attempts.
func (dbb *Device) Login(pin string) (bool, string, error) {
	if dbb.bootloaderStatus != nil {
		return false, "", errp.WithStack(errNoBootloader)
	}
	if !dbb.initialized {
		return false, "", errp.New("the device must first be initialized before trying to login")
	}
	deviceInfo, err := dbb.deviceInfo(pin)
	if err != nil {
		var remainingAttempts string
		var needsLongTouch bool
		if dbbErr, ok := errp.Cause(err).(*Error); ok {
			groups := regexp.MustCompile(`(\d+) attempts remain before`).
				FindStringSubmatch(dbbErr.Error())
			if len(groups) == 2 {
				remainingAttempts = groups[1]
			}
			needsLongTouch = strings.Contains(dbbErr.Error(), "next")
		}
		dbb.log.WithFields(logrus.Fields{"needs-longtouch": needsLongTouch,
			"remaining-attempts": remainingAttempts}).Debug("Failed to authenticate")

		if needsLongTouch && remainingAttempts == "0" {
			// Check if the device was resetted after too many failed attempts.
			initialized, pingErr := dbb.Ping()
			if pingErr == nil && !initialized {
				dbb.initialized = false
				dbb.seeded = false
				dbb.pin = ""
				dbb.onStatusChanged()
			}
		}

		return needsLongTouch, remainingAttempts, err
	}
	dbb.pin = pin
	dbb.seeded = deviceInfo.Seeded
	dbb.onStatusChanged()

	dbb.log.Debug("Authentication successful")
	if !deviceInfo.Bootlock {
		dbb.log.Debug("Device bootloader is unlocked; locking now")
		if err := dbb.LockBootloader(); err != nil {
			return false, "", err
		}
	}
	return false, "", nil
}

func stretchKey(key string) string {
	const (
		iterations = 20480
		keylen     = 64
	)
	first := hex.EncodeToString(pbkdf2.Key(
		[]byte(key),
		[]byte("Digital Bitbox"),
		iterations,
		keylen,
		sha512.New))
	second := hex.EncodeToString(pbkdf2.Key(
		[]byte(key),
		[]byte("Digital Bitbox"),
		iterations,
		keylen,
		sha512.New))
	if first != second {
		panic("memory error")
	}
	return first
}

func (dbb *Device) seed(pin, backupPassword, source, filename string) error {
	if source != "create" && source != "backup" && source != "U2F_create" && source != "U2F_load" {
		panic(`source must be "create", "backup", "U2F_create" or "U2F_load"`)
	}
	if backupPassword == "" {
		return errp.New("invalid password")
	}
	dbb.log.WithFields(logrus.Fields{"source": source, "filename": filename}).Debug("Seed")
	key := stretchKey(backupPassword)
	reply, err := dbb.send(
		map[string]interface{}{
			"seed": map[string]string{
				"source":   source,
				"key":      key,
				"filename": filename,
			},
		},
		pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to create or backup wallet (seed)")
	}
	if reply["seed"] != "success" {
		return errp.New("Unexpected result")
	}
	reply, err = dbb.send(
		map[string]interface{}{
			"backup": map[string]string{
				"key":   key,
				"check": filename,
			},
		},
		dbb.pin)
	if err != nil {
		return errp.WithMessage(err, "There was an unexpected error during wallet creation or restoring. "+
			"Please contact our support and do not use this wallet.")
	}
	backupCheck, ok := reply["backup"].(string)
	if !ok || backupCheck != "success" {
		return errp.New("There was an unexpected error during wallet creation or restoring." +
			" Please contact our support and do not use this wallet.")
	}
	return nil
}

func backupFilename(backupName string) string {
	return fmt.Sprintf("%s-%s.pdf", backupName, time.Now().Format(backupDateFormat))
}

// SetName sets the device name. Retrieve the device name using DeviceInfo().
func (dbb *Device) SetName(name string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	if !regexp.MustCompile(`^[0-9a-zA-Z-_]{1,31}$`).MatchString(name) {
		return errp.WithContext(errp.New("Invalid device name"),
			errp.Context{"device-name": name})
	}
	reply, err := dbb.send(
		map[string]interface{}{
			"name": name,
		},
		dbb.pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to set name")
	}
	newName, ok := reply["name"].(string)
	if !ok || len(newName) == 0 || newName != name {
		return errp.New("unexpected result")
	}
	return nil
}

// CreateWallet creates a new wallet and stores a backup containing `walletName` in the
// filename. The password used for the backup is passed, and different from the device PIN.
func (dbb *Device) CreateWallet(walletName string, backupPassword string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	if !regexp.MustCompile(`^[0-9a-zA-Z-_.]{1,31}$`).MatchString(walletName) {
		return errp.New("invalid wallet name")
	}
	if ok, err := dbb.recoveryPasswordPolicy.ValidatePassword(backupPassword); !ok {
		return err
	}
	dbb.log.WithField("wallet-name", walletName).Info("Set name")
	if err := dbb.SetName(walletName); err != nil {
		return err
	}
	dbb.log.WithField("wallet-name", walletName).Info("Create wallet")
	if err := dbb.seed(
		dbb.pin,
		backupPassword,
		"create",
		backupFilename(walletName),
	); err != nil {
		return errp.WithMessage(err, "Failed to create wallet")
	}
	dbb.seeded = true
	dbb.onStatusChanged()
	return nil
}

// SetHiddenPassword creates a hidden pin/seed. Returns false if aborted by the user.
func (dbb *Device) SetHiddenPassword(hiddenPIN string, hiddenBackupPassword string) (bool, error) {
	if dbb.bootloaderStatus != nil {
		return false, errp.WithStack(errNoBootloader)
	}
	if ok, err := dbb.pinPolicy.ValidatePassword(hiddenPIN); !ok {
		return false, err
	}
	if ok, err := dbb.recoveryPasswordPolicy.ValidatePassword(hiddenBackupPassword); !ok {
		return false, err
	}
	key := stretchKey(hiddenBackupPassword)
	reply, err := dbb.send(
		map[string]interface{}{
			"hidden_password": map[string]string{
				"key":      key,
				"password": hiddenPIN,
			},
		},
		dbb.pin)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if reply["hidden_password"] != "success" {
		return false, errp.New("Unexpected result")
	}
	return true, nil
}

// IsErrorAbort returns whether the user aborted the operation.
func IsErrorAbort(err error) bool {
	dbbErr, ok := errp.Cause(err).(*Error)
	return ok && (dbbErr.Code == ErrTouchAbort || dbbErr.Code == ErrTouchTimeout)
}

// IsErrorSDCard returns whether the SD card was not inserted during an operation that requires it.
func IsErrorSDCard(err error) bool {
	dbbErr, ok := errp.Cause(err).(*Error)
	return ok && dbbErr.Code == ErrSDCard
}

// RestoreBackup restores a backup from the SD card. Returns true if restored and false if aborted
// by the user.
func (dbb *Device) RestoreBackup(backupPassword, filename string) (bool, error) {
	if dbb.bootloaderStatus != nil {
		return false, errp.WithStack(errNoBootloader)
	}
	dbb.log.WithField("filename", filename).Info("Restore backup")
	err := dbb.seed(dbb.pin, backupPassword, "backup", filename)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, errp.WithMessage(err, "Failed to restore from backup")
	}
	dbb.seeded = true
	dbb.onStatusChanged()
	return true, nil
}

// CreateBackup creates a new backup of the current device seed on the SD card.
func (dbb *Device) CreateBackup(backupName string, recoveryPassword string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	dbb.log.WithField("backup-name", backupName).Info("Create backup")
	reply, err := dbb.send(
		map[string]interface{}{
			"backup": map[string]string{
				"key":      stretchKey(recoveryPassword),
				"filename": backupFilename(backupName),
			},
		},
		dbb.pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to create backup")
	}
	if reply["backup"] != "success" {
		return errp.New("Unexpected result: backup != success")
	}
	return nil
}

// Blink flashes the LED.
func (dbb *Device) Blink() error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	dbb.log.Info("Blink")
	_, err := dbb.sendKV("led", "blink", dbb.pin)
	return errp.WithMessage(err, "Failed to blink")
}

// Reset resets the device. Returns true if erased and false if aborted by the user. Only callable
// when logged in, so the PIN can be checked.
func (dbb *Device) Reset(pin string) (bool, error) {
	if dbb.bootloaderStatus != nil {
		return false, errp.WithStack(errNoBootloader)
	}
	dbb.log.Info("Reset")
	if dbb.Status() == StatusUninitialized || dbb.pin == "" {
		return false, errp.New("device has to be initialized")
	}
	if dbb.pin != pin {
		return false, errp.New("PIN incorrect")
	}
	reply, err := dbb.sendKV("reset", "__ERASE__", dbb.pin)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if reply["reset"] != "success" {
		return false, errp.New("unexpected reply")
	}
	dbb.pin = ""
	dbb.seeded = false
	dbb.initialized = false
	dbb.onStatusChanged()
	return true, nil
}

// XPub returns the extended publickey at the path.
func (dbb *Device) XPub(path string) (*hdkeychain.ExtendedKey, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	dbb.log.WithField("path", path).Info("XPub")
	getXPub := func() (*hdkeychain.ExtendedKey, error) {
		reply, err := dbb.sendKV("xpub", path, dbb.pin)
		if err != nil {
			return nil, err
		}
		xpubStr, ok := reply["xpub"].(string)
		if !ok {
			return nil, errp.WithStack(errp.New("Unexpected reply"))
		}
		return hdkeychain.NewKeyFromString(xpubStr)
	}
	// Call the device twice, to reduce the likelihood of a hardware error.
	xpub1, err := getXPub()
	if err != nil {
		return nil, err
	}
	xpub2, err := getXPub()
	if err != nil {
		return nil, err
	}
	if xpub1.String() != xpub2.String() {
		dbb.log.WithField("path", path).Error("The device returned inconsistent xpubs")
		return nil, errp.WithStack(errp.New("Critical: the device returned inconsistent xpubs"))
	}
	return xpub1, nil
}

// Random generates a 16 byte random number, hex encoded. typ can be either "true" or "pseudo".
func (dbb *Device) Random(typ string) (string, error) {
	if dbb.bootloaderStatus != nil {
		return "", errp.WithStack(errNoBootloader)
	}
	if typ != "true" && typ != "pseudo" {
		dbb.log.WithField("type", typ).Panic("Type must be 'true' or 'pseudo'")
	}
	reply, err := dbb.sendKV("random", typ, dbb.pin)
	if err != nil {
		return "", errp.WithMessage(err, "Failed to generate random")
	}
	rand, ok := reply["random"].(string)
	if !ok {
		dbb.log.Error("Unexpected reply: field 'random' is missing")
		return "", errp.New("unexpected reply")
	}
	dbb.log.WithField("random", rand).Debug("Generated random")
	if len(rand) != 32 {
		dbb.log.WithField("random-length", len(rand)).Error("Unexpected length: expected 32 bytes")
		return "", fmt.Errorf("unexpected length, expected 32, got %d", len(rand))
	}

	if dbb.channel != nil {
		echo, ok := reply["echo"].(string)
		if !ok {
			return "", errp.WithMessage(err, "The random number echo from the BitBox was invalid.")
		}
		if err = dbb.channel.SendRandomNumberEcho(echo); err != nil {
			return "", errp.WithMessage(err, "Could not send the random number echo to the mobile.")
		}
	}

	return rand, nil
}

// BackupList returns a list of backup filenames.
func (dbb *Device) BackupList() ([]map[string]string, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	reply, err := dbb.sendKV("backup", "list", dbb.pin)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to retrieve list of backups")
	}
	filenames, ok := reply["backup"].([]interface{})
	if !ok {
		dbb.log.Error("Unexpected reply: field 'backup' is missing")
		return nil, errp.New("unexpected reply")
	}
	filenamesAndDate := []map[string]string{}
	for _, filename := range filenames {
		filenameAndDate := map[string]string{}
		filenameString, ok := filename.(string)
		if !ok {
			dbb.log.Error("Unexpected reply: field 'backup' is not a string")
			return nil, errp.New("unexpected reply")
		}
		filenameAndDate["id"] = filenameString
		pattern := regexp.MustCompile("(.*)-(\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}).pdf")
		if pattern.Match([]byte(filenameString)) {
			groups := pattern.FindStringSubmatch(filenameString)
			filenameAndDate["name"] = groups[1]
			backupDate, err := time.Parse(backupDateFormat, groups[2])
			if err != nil {
				return nil, errp.WithMessage(err, "Failed to extract the backup date from the wallet name")
			}
			filenameAndDate["date"] = backupDate.Format(time.RFC3339)
		}
		filenamesAndDate = append(filenamesAndDate, filenameAndDate)
	}
	dbb.log.WithField("backup-list", filenamesAndDate).Debug("Retrieved backup list")
	sort.Slice(filenamesAndDate, func(i, j int) bool {
		first, ok1 := filenamesAndDate[i]["date"]
		second, ok2 := filenamesAndDate[j]["date"]
		if ok1 && ok2 {
			firstDate, err := time.Parse(time.RFC3339, first)
			if err != nil {
				panic("Failed to parse date")
			}
			secondDate, err := time.Parse(time.RFC3339, second)
			if err != nil {
				panic("Failed to parse date")
			}
			return firstDate.After(secondDate)
		} else if ok1 {
			return true
		}
		return false
	})
	return filenamesAndDate, nil
}

// EraseBackup deletes a backup.
func (dbb *Device) EraseBackup(filename string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	dbb.log.WithField("filename", filename).Info("Erase backup")
	reply, err := dbb.send(
		map[string]interface{}{
			"backup": map[string]string{
				"erase": filename,
			},
		},
		dbb.pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to erase backup")
	}
	if reply["backup"] != "success" {
		return errp.New("Unexpected result: field 'backup' is missing")
	}
	return nil
}

// UnlockBootloader unlocks the bootloader. It returns true on success, and false on user abort.
func (dbb *Device) UnlockBootloader() (bool, error) {
	if dbb.bootloaderStatus != nil {
		return false, errp.WithStack(errNoBootloader)
	}
	reply, err := dbb.sendKV("bootloader", "unlock", dbb.pin)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, errp.WithMessage(err, "Failed to unlock bootloader")
	}
	if val, ok := reply["bootloader"].(string); !ok || val != "unlock" {
		return false, errp.New("unexpected reply")
	}
	return true, nil
}

// LockBootloader locks the bootloader.
func (dbb *Device) LockBootloader() error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	dbb.log.Info("Lock bootloader")
	reply, err := dbb.sendKV("bootloader", "lock", dbb.pin)
	if err != nil {
		return errp.WithMessage(err, "Failed to lock bootloader")
	}
	if val, ok := reply["bootloader"].(string); !ok || val != "lock" {
		return errp.New("Unexpected reply: field 'bootloader' is missing")
	}
	return nil
}

// Signs a batch of at most 15 signatures. The method returns signatures for the provided hashes.
// The private keys used to sign them are derived using the provided keyPaths.
func (dbb *Device) signBatch(
	txProposal *maketx.TxProposal,
	signatureHashes [][]byte,
	keyPaths []string,
	locked bool,
) (map[string]interface{}, error) {
	if len(signatureHashes) != len(keyPaths) {
		dbb.log.WithFields(logrus.Fields{"signature-hashes-length": len(signatureHashes),
			"keypath-lengths": len(keyPaths)}).Panic("Length of keyPaths must match length of signatureHashes")
		panic("length of keyPaths must match length of signatureHashes")
	}
	if len(signatureHashes) > signatureBatchSize {
		dbb.log.WithFields(logrus.Fields{"signature-hashes-length": len(signatureHashes),
			"signature-batch-size": signatureBatchSize}).Panic("This amount of signature hashes " +
			"cannot be signed in one batch")
		panic(fmt.Sprintf("only up to %d signature hashes can be signed in one batch", signatureBatchSize))
	}

	data := []map[string]string{}
	for i, signatureHash := range signatureHashes {
		data = append(data, map[string]string{
			"hash":    hex.EncodeToString(signatureHash),
			"keypath": keyPaths[i],
		})
	}

	command := map[string]map[string]interface{}{
		"sign": map[string]interface{}{
			"data": data,
		},
	}

	var transaction string
	if txProposal != nil {
		buffer := new(bytes.Buffer)
		if err := txProposal.Transaction.Serialize(buffer); err != nil {
			return nil, errp.Wrap(err, "Could not serialize the transaction.")
		}
		transaction = hex.EncodeToString(buffer.Bytes())
		command["sign"]["meta"] = hex.EncodeToString(chainhash.DoubleHashB([]byte(transaction)))

		if txProposal.ChangeAddress != nil {
			configuration := txProposal.ChangeAddress.Configuration
			if configuration.Singlesig() {
				publicKey := configuration.PublicKeys()[0]
				command["sign"]["checkpub"] = []map[string]interface{}{{
					"pubkey":  hex.EncodeToString(publicKey.SerializeCompressed()),
					"keypath": configuration.AbsoluteKeypath().Encode(),
				}}
			}
		}
	}

	// First call returns the echo.
	echo, err := dbb.send(command, dbb.pin)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to sign batch (1)")
	}

	if txProposal != nil && dbb.channel != nil {
		signingEcho, ok := echo["echo"].(string)
		if !ok {
			return nil, errp.WithMessage(err, "The signing echo from the BitBox was not a string.")
		}
		if txProposal.AccountConfiguration.Singlesig() {
			if err = dbb.channel.SendSigningEcho(signingEcho, txProposal.Coin.Name(), string(txProposal.AccountConfiguration.ScriptType()), transaction); err != nil {
				return nil, errp.WithMessage(err, "Could not send the signing echo to the mobile.")
			}
		}
	}

	// If the device is 2FA locked, wait for up to two minutes for the signing "PIN"/nonce.
	var nonce string
	if locked {
		if txProposal == nil {
			return nil, errp.New("No transaction was provided for the locked device to sign.")
		}
		if dbb.channel == nil {
			return nil, errp.New("Signing failed because the device is locked but not paired.")
		}
		nonce, err = dbb.channel.WaitForSigningPin(2 * time.Minute)
		if err != nil {
			return nil, errp.WithMessage(err, "waiting for signing pin failed")
		}
		if nonce == "abort" {
			return nil, errp.WithStack(NewError("Aborted from mobile", ErrTouchAbort))
		}
	}

	// Second call returns the signatures.
	var pin interface{}
	if nonce != "" {
		pin = map[string]interface{}{
			"pin": nonce,
		}
	} else {
		pin = ""
	}
	command2 := map[string]interface{}{
		"sign": pin,
	}
	reply, err := dbb.send(command2, dbb.pin)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to sign batch (2)")
	}
	return reply, nil
}

// Sign returns signatures for the provided hashes. The private keys used to sign them are derived
// using the provided keyPaths.
func (dbb *Device) Sign(
	txProposal *maketx.TxProposal,
	signatureHashes [][]byte,
	keyPaths []string,
) ([]btcec.Signature, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	dbb.log.WithFields(logrus.Fields{"signature-hashes": signatureHashes, "keypaths": keyPaths}).Info("Sign")
	if len(signatureHashes) != len(keyPaths) {
		dbb.log.WithFields(logrus.Fields{"signature-hashes-length": len(signatureHashes),
			"keypath-lengths": len(keyPaths)}).Panic("Length of keyPaths must match length of signatureHashes")
		panic("len of keyPaths must match len of signatureHashes")
	}
	if len(signatureHashes) == 0 {
		dbb.log.WithField("signature-hashes-length", len(signatureHashes)).Panic("Non-empty list of signature hashes and keypaths expected")
		panic("non-empty list of signature hashes and keypaths expected")
	}

	deviceInfo, err := dbb.DeviceInfo()
	if err != nil {
		dbb.log.WithError(err).Error("Failed to load the device info for signing.")
		return nil, errp.WithMessage(err, "Failed to load the device info for signing.")
	}

	signatures := []btcec.Signature{}
	steps := len(signatureHashes) / signatureBatchSize
	if len(signatureHashes)%signatureBatchSize != 0 {
		steps++
	}
	for i := 0; i < len(signatureHashes); i = i + signatureBatchSize {
		upper := i + signatureBatchSize
		if upper > len(signatureHashes) {
			upper = len(signatureHashes)
		}
		if steps > 1 {
			dbb.fireEvent(EventSignProgress, struct {
				Step  int `json:"step"`
				Steps int `json:"steps"`
			}{
				Step:  i / signatureBatchSize,
				Steps: steps,
			})
		}
		reply, err := dbb.signBatch(
			txProposal,
			signatureHashes[i:upper],
			keyPaths[i:upper],
			deviceInfo.Lock,
		)
		if err != nil {
			return nil, err
		}
		sigs, ok := reply["sign"].([]interface{})
		if !ok {
			return nil, errp.New("Unexpected reply: field 'sign' is missing")
		}
		for _, sig := range sigs {
			sigMap, ok := sig.(map[string]interface{})
			if !ok {
				return nil, errp.New("Unexpected reply: 'sign' must be a map")
			}
			hexSig, ok := sigMap["sig"].(string)
			if !ok {
				return nil, errp.New("Unexpected reply: field 'sig' is missing in 'sign' map")
			}
			if len(hexSig) != 128 {
				return nil, errp.New("Unexpected reply: field 'sig' must be 128 byte long")
			}
			sigR, ok := big.NewInt(0).SetString(hexSig[:64], 16)
			if !ok {
				return nil, errp.New("Unexpected reply: R in 'sig' must be a hex value")
			}
			sigS, ok := big.NewInt(0).SetString(hexSig[64:], 16)
			if !ok {
				return nil, errp.New("Unexpected reply: S in 'sig' must be a hex value")
			}
			signatures = append(signatures, btcec.Signature{R: sigR, S: sigS})
		}
	}
	return signatures, nil
}

// DisplayAddress triggers the display of the address at the given key path.
func (dbb *Device) DisplayAddress(keyPath string, typ string) error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	if dbb.channel == nil {
		dbb.log.Debug("The address is not displayed because no pairing was found.")
		return nil
	}
	reply, err := dbb.sendKV("xpub", keyPath, dbb.pin)
	if err != nil {
		dbb.log.WithError(err).Error("Could not retrieve the xpub from the BitBox.")
		return nil
	}
	xpubEcho, ok := reply["echo"].(string)
	if !ok {
		dbb.log.Error("The echo from the BitBox to display the address is not a string.")
		return nil
	}
	if err := dbb.channel.SendXpubEcho(xpubEcho, typ); err != nil {
		dbb.log.WithError(err).Error("Sending the xpub echo to the mobile failed.")
		return nil
	}
	return nil
}

// ECDHPKhash passes the hash of the ECDH public key of the mobile to the device and returns its response.
func (dbb *Device) ECDHPKhash(mobileECDHPKhash string) (interface{}, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	command := map[string]interface{}{
		"ecdh": map[string]interface{}{
			"hash_pubkey": mobileECDHPKhash,
		},
	}
	reply, err := dbb.send(command, dbb.pin)
	if err != nil {
		return nil, err
	}
	return reply["ecdh"], nil
}

// ECDHPK passes the ECDH public key of the mobile to the device and returns its response.
func (dbb *Device) ECDHPK(mobileECDHPK string) (interface{}, error) {
	if dbb.bootloaderStatus != nil {
		return nil, errp.WithStack(errNoBootloader)
	}
	command := map[string]interface{}{
		"ecdh": map[string]interface{}{
			"pubkey": mobileECDHPK,
		},
	}
	reply, err := dbb.send(command, dbb.pin)
	if err != nil {
		return nil, err
	}
	return reply["ecdh"], nil
}

// ECDHchallenge forwards a ecdh challenge command to the Bitbox
func (dbb *Device) ECDHchallenge() error {
	if dbb.bootloaderStatus != nil {
		return errp.WithStack(errNoBootloader)
	}
	command := map[string]interface{}{
		"ecdh": map[string]interface{}{
			"challenge": true,
		},
	}
	reply, err := dbb.send(command, dbb.pin)
	if err != nil {
		return err
	}
	if reply["ecdh"] != "success" {
		return errp.New("Unexpected response from bitbox")
	}
	return nil
}

// StartPairing creates, stores and returns a new channel and finishes the pairing asynchronously.
func (dbb *Device) StartPairing() (*relay.Channel, error) {
	if dbb.channel != nil {
		if err := dbb.channel.RemoveConfigFile(); err != nil {
			return nil, errp.WithStack(err)
		}
		dbb.channel = nil
		dbb.fireEvent("pairingFalse", nil)
	}
	channel := relay.NewChannelWithRandomKey()
	go dbb.processPairing(channel)
	return channel, nil
}

// Paired returns whether a channel to a mobile exists.
func (dbb *Device) Paired() bool {
	return dbb.channel != nil
}

// PingMobile pings the mobile if a channel exists. Only returns no error if the pong was received.
func (dbb *Device) PingMobile() error {
	if dbb.channel != nil {
		if err := dbb.channel.SendPing(); err != nil {
			return err
		}
		if err := dbb.channel.WaitForPong(time.Second); err != nil {
			return err
		}
	}
	return nil
}

// ListenForMobile listens for the mobile until the BitBox is closed or the channel is removed.
func (dbb *Device) ListenForMobile() {
	go func() {
		for !dbb.closed && dbb.channel != nil {
			if dbb.PingMobile() != nil {
				dbb.fireEvent("mobileDisconnected", nil)
			} else {
				dbb.fireEvent("mobileConnected", nil)
			}
			time.Sleep(10 * time.Second)
		}
	}()
}

// ProductName implements device.Interface.
func (dbb *Device) ProductName() string {
	return ProductName
}

// Identifier implements device.Interface.
func (dbb *Device) Identifier() string {
	return dbb.deviceID
}

// ExtendedPublicKey implements device.Interface.
func (dbb *Device) ExtendedPublicKey(keypath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	return dbb.XPub(keypath.Encode())
}

// KeystoreForConfiguration implements device.Interface.
func (dbb *Device) KeystoreForConfiguration(
	configuration *signing.Configuration,
	cosignerIndex int,
) keystoreInterface.Keystore {
	if dbb.Status() != StatusSeeded {
		return nil
	}
	return &keystore{
		dbb:           dbb,
		configuration: configuration,
		cosignerIndex: cosignerIndex,
		log:           dbb.log,
	}
}

// Lock locks the device for full 2FA. Returns true if successful and false if aborted by the user.
func (dbb *Device) Lock() (bool, error) {
	reply, err := dbb.sendKV("device", "lock", dbb.pin)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, errp.WithMessage(err, "Failed to lock the device")
	}
	replyDevice, ok := reply["device"].(map[string]interface{})
	if !ok {
		return false, errp.New("unexpected reply")
	}
	if replyLock, ok := replyDevice["lock"].(bool); !ok || !replyLock {
		return false, errp.New("unexpected reply")
	}
	return true, nil
}
