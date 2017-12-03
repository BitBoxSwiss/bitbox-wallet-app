// Package dbbdevice is the API to the physical device.
package dbbdevice

import (
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"regexp"
	"time"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/dbbdevice/communication"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
	"golang.org/x/crypto/pbkdf2"
)

const (
	vendorID  = 0x03eb
	productID = 0x2402

	// ErrIONoPassword is returned when no password has been configured.
	ErrIONoPassword = 101
	// ErrTouchAbort is returned when the user short-touches the button.
	errTouchAbort = 600
	// errTouchTimeout is returned when the user does not confirm or abort for 30s.
	errTouchTimeout = 601
	// ErrSDCard is returned when the SD card is needed, but not inserted.
	errSDCard = 400
)

// CommunicationInterface contains functions needed to communicate with the device.
//go:generate mockery -name CommunicationInterface
type CommunicationInterface interface {
	SendPlain(string) (map[string]interface{}, error)
	SendEncrypt(string, string) (map[string]interface{}, error)
	Close()
}

// Interface is the API of a DBBDevice
type Interface interface {
	Status() string
	SetPassword(string) error
	CreateWallet(string) error
	Login(string) error
	Reset() (bool, error)
	EraseBackup(string) error
	RestoreBackup(string, string) (bool, error)
	CreateBackup(string) error
	BackupList() ([]string, error)
}

// DBBDevice provides the API to communicate with the digital bitbox.
type DBBDevice struct {
	deviceID      string
	communication CommunicationInterface
	onEvent       func(string)

	// If set, the device  is configured with a password.
	initialized bool
	// If set, the user is "logged in".
	password string
	// If set, the device contains a wallet.
	seeded bool

	closed bool
}

// DeviceInfo is the data returned from the device info api call.
type DeviceInfo struct {
	Version   string `json:"version"`
	Serial    string `json:"Serial"`
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

// NewDBBDevice creates a new instance of DBBDevice. deviceCommunication is used as for transporting
// messages to/from the device..
func NewDBBDevice(
	deviceID string,
	deviceCommunication CommunicationInterface) (*DBBDevice, error) {
	dbbDevice := &DBBDevice{
		deviceID:      deviceID,
		communication: deviceCommunication,
		onEvent:       nil,

		closed: false,
	}
	initialized, err := dbbDevice.Ping()
	if err != nil {
		return nil, err
	}
	dbbDevice.initialized = initialized
	return dbbDevice, nil
}

// DeviceID returns the device ID (provided when it was created in the constructor).
func (dbb *DBBDevice) DeviceID() string {
	return dbb.deviceID
}

// SetOnEvent installs a callback which is called for various events.
func (dbb *DBBDevice) SetOnEvent(onEvent func(string)) {
	dbb.onEvent = onEvent
}

func (dbb *DBBDevice) onStatusChanged() {
	if dbb.onEvent != nil {
		dbb.onEvent("statusChanged")
	}
}

// Status returns the device state. See (TODO: use proper types for the state)
func (dbb *DBBDevice) Status() string {
	if dbb.seeded {
		return "seeded"
	}
	if dbb.password != "" {
		return "logged_in"
	}
	if dbb.initialized {
		return "initialized"
	}
	return "uninitialized"
}

// Close closes the HID device.
func (dbb *DBBDevice) Close() {
	dbb.communication.Close()
	dbb.closed = true
}

func (dbb *DBBDevice) sendPlain(key, val string) (map[string]interface{}, error) {
	jsonText, err := json.Marshal(map[string]string{key: val})
	if err != nil {
		return nil, err
	}
	return dbb.communication.SendPlain(string(jsonText))
}

func (dbb *DBBDevice) send(value interface{}, password string) (map[string]interface{}, error) {
	return dbb.communication.SendEncrypt(string(jsonp.MustMarshal(value)), password)
}

func (dbb *DBBDevice) sendKV(key, value, password string) (map[string]interface{}, error) {
	return dbb.send(map[string]string{key: value}, password)
}

func (dbb *DBBDevice) deviceInfo(password string) (*DeviceInfo, error) {
	reply, err := dbb.sendKV("device", "info", password)
	if err != nil {
		return nil, err
	}
	deviceInfo := &DeviceInfo{}

	device, ok := reply["device"].(map[string]interface{})
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	if deviceInfo.Serial, ok = device["serial"].(string); !ok {
		return nil, errp.New("no serial")
	}
	if deviceInfo.ID, ok = device["id"].(string); !ok {
		return nil, errp.New("no id")
	}
	if deviceInfo.TFA, ok = device["TFA"].(string); !ok {
		return nil, errp.New("no TFA")
	}
	if deviceInfo.Bootlock, ok = device["bootlock"].(bool); !ok {
		return nil, errp.New("no bootlock")
	}
	if deviceInfo.Name, ok = device["name"].(string); !ok {
		return nil, errp.New("device name")
	}
	if deviceInfo.SDCard, ok = device["sdcard"].(bool); !ok {
		return nil, errp.New("SD card")
	}
	if deviceInfo.Lock, ok = device["lock"].(bool); !ok {
		return nil, errp.New("lock")
	}
	if deviceInfo.U2F, ok = device["U2F"].(bool); !ok {
		return nil, errp.New("U2F")
	}
	if deviceInfo.U2FHijack, ok = device["U2F_hijack"].(bool); !ok {
		return nil, errp.New("U2F_hijack")
	}
	if deviceInfo.Version, ok = device["version"].(string); !ok {
		return nil, errp.New("version")
	}
	if deviceInfo.Seeded, ok = device["seeded"].(bool); !ok {
		return nil, errp.New("version")
	}
	return deviceInfo, nil
}

// DeviceInfo gets device information.
func (dbb *DBBDevice) DeviceInfo() (*DeviceInfo, error) {
	return dbb.deviceInfo(dbb.password)
}

// Ping returns true if the device is initialized, and false if it is not.
func (dbb *DBBDevice) Ping() (bool, error) {
	reply, err := dbb.sendPlain("ping", "")
	if err != nil {
		return false, err
	}
	ping, ok := reply["ping"].(string)
	return ok && ping == "password", nil
}

// SetPassword defines a password for the device. This only works on a fresh device. If a password
// has already been configured, a new one cannot be set until the device is reset.
func (dbb *DBBDevice) SetPassword(password string) error {
	reply, err := dbb.sendPlain("password", password)
	if err != nil {
		return err
	}
	if reply["password"] != "success" {
		return errp.New("error setting password")
	}
	dbb.password = password
	dbb.onStatusChanged()
	return nil
}

// Login validates the password. This needs to be called before using any API call except for Ping()
// and SetPassord().
func (dbb *DBBDevice) Login(password string) error {
	deviceInfo, err := dbb.deviceInfo(password)
	if err != nil {
		return err
	}
	dbb.password = password
	dbb.seeded = deviceInfo.Seeded
	dbb.onStatusChanged()
	if dbb.onEvent != nil {
		dbb.onEvent("login")
	}
	return nil
}

func stretchKey(key string) string {
	const (
		iterations = 20480
		keylen     = 64
	)
	return hex.EncodeToString(pbkdf2.Key(
		[]byte(key),
		[]byte("Digital Bitbox"),
		iterations,
		keylen,
		sha512.New))
}

func (dbb *DBBDevice) seed(devicePassword, backupPassword, source, filename string) error {
	if source != "create" && source != "backup" {
		panic(`source must be "create" or "backup"`)
	}
	key := stretchKey(backupPassword)
	reply, err := dbb.send(
		map[string]interface{}{
			"seed": map[string]string{
				"source":   source,
				"key":      key,
				"filename": filename,
			},
		},
		devicePassword)
	if err != nil {
		return err
	}
	if reply["seed"] != "success" {
		return errp.New("unexpected result")
	}
	return nil
}

func backupFilename(backupName string) string {
	return fmt.Sprintf("%s-%s.pdf", backupName, time.Now().Format("2006-01-02-15-04-05"))
}

// CreateWallet creates a new wallet and stores a backup containing `walletName` in the
// filename. The password used for the backup is the same as the one for the device.
func (dbb *DBBDevice) CreateWallet(walletName string) error {
	if !regexp.MustCompile(`^[0-9a-zA-Z-_ ]{1,64}$`).MatchString(walletName) {
		return errp.New("invalid wallet name")
	}
	if err := dbb.seed(
		dbb.password,
		dbb.password,
		"create",
		backupFilename(walletName),
	); err != nil {
		return err
	}
	dbb.seeded = true
	dbb.onStatusChanged()
	return nil
}

// IsErrorAbort returns whether the user aborted the operation.
func IsErrorAbort(err error) bool {
	dbbErr, ok := err.(*communication.DBBErr)
	return ok && (dbbErr.Code == errTouchAbort || dbbErr.Code == errTouchTimeout)
}

// IsErrorSDCard returns whether the SD card was not inserted during an operation that requires it.
func IsErrorSDCard(err error) bool {
	dbbErr, ok := err.(*communication.DBBErr)
	return ok && dbbErr.Code == errSDCard
}

// RestoreBackup restores a backup from the SD card. Returns true if restored and false if aborted
// by the user.
func (dbb *DBBDevice) RestoreBackup(backupPassword, filename string) (bool, error) {
	err := dbb.seed(dbb.password, backupPassword, "backup", filename)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	dbb.seeded = true
	dbb.onStatusChanged()
	return true, nil
}

// CreateBackup creates a new backup of the current device seed on the SD card.
func (dbb *DBBDevice) CreateBackup(backupName string) error {
	reply, err := dbb.send(
		map[string]interface{}{
			"backup": map[string]string{
				"key":      stretchKey(dbb.password),
				"filename": backupFilename(backupName),
			},
		},
		dbb.password)
	if err != nil {
		return err
	}
	if reply["backup"] != "success" {
		return errp.New("unexpected result")
	}
	return nil
}

// Blink flashes the LED.
func (dbb *DBBDevice) Blink(password string) error {
	_, err := dbb.sendKV("led", "abort", password)
	return err
}

// Reset resets the device. Returns true if erased and false if aborted by the user.
func (dbb *DBBDevice) Reset() (bool, error) {
	reply, err := dbb.sendKV("reset", "__ERASE__", dbb.password)
	if IsErrorAbort(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if reply["reset"] != "success" {
		return false, errp.New("unexpected reply")
	}
	dbb.password = ""
	dbb.seeded = false
	dbb.initialized = false
	dbb.onStatusChanged()
	return true, nil
}

// XPub returns the extended publickey at the path.
func (dbb *DBBDevice) XPub(path string) (*hdkeychain.ExtendedKey, error) {
	reply, err := dbb.sendKV("xpub", path, dbb.password)
	if err != nil {
		return nil, err
	}
	xpubStr, ok := reply["xpub"].(string)
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	return hdkeychain.NewKeyFromString(xpubStr)
}

// Random generates a 16 byte random number, hex encoded.. typ can be either "true" or "pseudo".
func (dbb *DBBDevice) Random(typ string) (string, error) {
	if typ != "true" && typ != "pseudo" {
		panic("needs to be true or pseudo")
	}
	reply, err := dbb.sendKV("random", typ, dbb.password)
	if err != nil {
		return "", err
	}
	rand, ok := reply["random"].(string)
	if !ok {
		return "", errp.New("unexpected reply")
	}
	if len(rand) != 32 {
		return "", fmt.Errorf("unexpected length, expected 32, got %d", len(rand))
	}
	return rand, nil
}

// BackupList returns a list of backup filenames.
func (dbb *DBBDevice) BackupList() ([]string, error) {
	reply, err := dbb.sendKV("backup", "list", dbb.password)
	if err != nil {
		return nil, err
	}
	filenames, ok := reply["backup"].([]interface{})
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	filenameStrings := []string{}
	for _, filename := range filenames {
		filenameString, ok := filename.(string)
		if !ok {
			return nil, errp.New("unexpected reply")
		}
		filenameStrings = append(filenameStrings, filenameString)
	}
	return filenameStrings, nil
}

// EraseBackup deletes a backup.
func (dbb *DBBDevice) EraseBackup(filename string) error {
	reply, err := dbb.send(
		map[string]interface{}{
			"backup": map[string]string{
				"erase": filename,
			},
		},
		dbb.password)
	if err != nil {
		return err
	}
	if reply["backup"] != "success" {
		return errp.New("unexpected result")
	}
	return nil
}

// LockBootloader locks the bootloader.
func (dbb *DBBDevice) LockBootloader() error {
	reply, err := dbb.sendKV("bootloader", "lock", dbb.password)
	if err != nil {
		return err
	}
	if val, ok := reply["bootloader"].(string); !ok || val != "lock" {
		return errp.New("unexpected reply")
	}
	return nil
}

// Sign returns signatures for the provided hashes. The private keys used to sign them are derived
// using the provided keyPaths.
func (dbb *DBBDevice) Sign(signatureHashes [][]byte, keyPaths []string) ([]btcec.Signature, error) {
	if len(signatureHashes) != len(keyPaths) {
		panic("len of keyPaths must match len of signatureHashes")
	}
	data := []map[string]string{}
	for i, signatureHash := range signatureHashes {
		data = append(data, map[string]string{
			"hash":    hex.EncodeToString(signatureHash),
			"keypath": keyPaths[i],
		})
	}
	cmd := map[string]interface{}{
		"sign": map[string]interface{}{
			"data": data,
		},
	}
	// First call returns the echo.
	_, err := dbb.send(cmd, dbb.password)
	if err != nil {
		return nil, err
	}
	// Second call returns the signatures.
	reply, err := dbb.send(cmd, dbb.password)
	if err != nil {
		return nil, err
	}
	sigs, ok := reply["sign"].([]interface{})
	if !ok {
		return nil, errp.New("unexpected response")
	}
	signatures := []btcec.Signature{}
	for _, sig := range sigs {
		sigMap, ok := sig.(map[string]interface{})
		if !ok {
			return nil, errp.New("unexpected response")
		}
		hexSig, ok := sigMap["sig"].(string)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		if len(hexSig) != 128 {
			return nil, errp.New("unexpected response")
		}
		sigR, ok := big.NewInt(0).SetString(hexSig[:64], 16)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		sigS, ok := big.NewInt(0).SetString(hexSig[64:], 16)
		if !ok {
			return nil, errp.New("unexpected response")
		}
		signatures = append(signatures, btcec.Signature{R: sigR, S: sigS})
	}
	return signatures, nil
}
