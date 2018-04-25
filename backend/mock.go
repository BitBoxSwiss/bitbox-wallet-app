package backend

import (
	"crypto/sha256"
	"strconv"
	"strings"

	"golang.org/x/crypto/pbkdf2"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"

	"github.com/shiftdevices/godbb/backend/coins/btc/maketx"
	"github.com/shiftdevices/godbb/backend/devices/bitbox"
	"github.com/shiftdevices/godbb/backend/devices/bitbox/relay"
	"github.com/shiftdevices/godbb/util/errp"
)

// DeviceID stores the device ID of the software-based key store.
const DeviceID = "SoftwareBasedKeyStore"

// SoftwareBasedKeyStore implements the BitBox interface to test the backend and the wallets.
type SoftwareBasedKeyStore struct {
	// The master key is nil before the login and after the logout.
	master   *hdkeychain.ExtendedKey
	listener func(bitbox.Event)
}

// NewSoftwareBasedKeyStore creates a new software-based key store.
func NewSoftwareBasedKeyStore() *SoftwareBasedKeyStore {
	return &SoftwareBasedKeyStore{nil, nil}
}

// xprv returns the xprv at the given absolute path.
func (ks *SoftwareBasedKeyStore) xprv(path string) (*hdkeychain.ExtendedKey, error) {
	if ks.master == nil {
		return nil, errp.New("The key store has to be seeded first through the login.")
	}

	components := strings.Split(strings.ToLower(path), "/")
	if components[0] != "m" {
		return nil, errp.New("An absolute key path has to start with 'm'.")
	}
	xprv := ks.master
	for _, component := range components[1:] {
		if len(component) == 0 {
			continue
		}
		hardened := strings.HasSuffix(component, "'") || strings.HasSuffix(component, "p")
		if hardened {
			component = component[:len(component)-1]
		}
		number, err := strconv.Atoi(component)
		if err != nil {
			return nil, errp.Wrap(err, "A path component is not a number.")
		}
		offset := uint32(0)
		if hardened {
			offset = hdkeychain.HardenedKeyStart
		}
		xprv, err = xprv.Child(offset + uint32(number))
		if err != nil {
			return nil, err
		}
	}
	return xprv, nil
}

// XPub returns the xpub at the given absolute path.
func (ks *SoftwareBasedKeyStore) XPub(path string) (*hdkeychain.ExtendedKey, error) {
	xprv, err := ks.xprv(path)
	if err != nil {
		return nil, err
	}
	return xprv.Neuter()
}

// Sign signs the given hashes at the given paths.
func (ks *SoftwareBasedKeyStore) Sign(
	txProposal *maketx.TxProposal,
	signatureHashes [][]byte,
	keyPaths []string,
) ([]btcec.Signature, error) {
	if len(signatureHashes) != len(keyPaths) {
		return nil, errp.New("The number of hashes to sign has to be equal to the number of paths.")
	}
	len := len(keyPaths)
	signatures := make([]btcec.Signature, len)
	for i := 0; i < len; i++ {
		xprv, err := ks.xprv(keyPaths[i])
		if err != nil {
			return nil, err
		}
		prv, err := xprv.ECPrivKey()
		if err != nil {
			return nil, err
		}
		signature, err := prv.Sign(signatureHashes[i])
		if err != nil {
			return nil, err
		}
		signatures[i] = *signature
	}
	return signatures, nil
}

// DisplayAddress triggers the display of the address at the given key path, which is not supported
// for software-based key stores as they have no trusted execution environment with another screen.
func (ks *SoftwareBasedKeyStore) DisplayAddress(keyPath string) error { return nil }

// VerifyPass is not supported.
func (ks *SoftwareBasedKeyStore) VerifyPass(string) (interface{}, error) {
	panic("VerifyPass not supported.")
}

// StartPairing is not supported.
func (ks *SoftwareBasedKeyStore) StartPairing() (*relay.Channel, error) {
	panic("StartPairing not supported.")
}

// LockBootloader is not supported.
func (ks *SoftwareBasedKeyStore) LockBootloader() error {
	panic("LockBootloader not supported.")
}

// UnlockBootloader is not supported.
func (ks *SoftwareBasedKeyStore) UnlockBootloader() error {
	panic("LockBootloader not supported.")
}

// DeviceID returns a pseudo device ID.
func (ks *SoftwareBasedKeyStore) DeviceID() string {
	return DeviceID
}

// SetOnEvent registers the given function as a listener.
func (ks *SoftwareBasedKeyStore) SetOnEvent(listener func(bitbox.Event)) {
	ks.listener = listener
}

// Status returns whether this key store has been seeded.
func (ks *SoftwareBasedKeyStore) Status() bitbox.Status {
	if ks.master == nil {
		return bitbox.StatusInitialized
	}
	return bitbox.StatusSeeded
}

// BootloaderStatus always returns an error (i.e. only the firmware mode is supported).
func (ks *SoftwareBasedKeyStore) BootloaderStatus() (*bitbox.BootloaderStatus, error) {
	return nil, errp.New("device is not in bootloader mode")
}

// notifyListener notifies the listener if set.
func (ks *SoftwareBasedKeyStore) notifyListener() {
	if ks.listener != nil {
		ks.listener(bitbox.EventStatusChanged)
	}
}

// Login derives the seed of this key store from the given PIN, which can include characters.
func (ks *SoftwareBasedKeyStore) Login(pin string) (bool, string, error) {
	seed := pbkdf2.Key([]byte(pin), []byte("BitBox"), 64, hdkeychain.RecommendedSeedLen, sha256.New)
	master, err := hdkeychain.NewMaster(seed[:], &chaincfg.TestNet3Params)
	if err != nil {
		return false, "", err
	}
	ks.master = master
	ks.notifyListener()
	return false, "", nil
}

// Logout locks this key store again.
func (ks *SoftwareBasedKeyStore) Logout() {
	ks.master = nil
	ks.notifyListener()
}

// DeviceInfo is not supported.
func (ks *SoftwareBasedKeyStore) DeviceInfo() (*bitbox.DeviceInfo, error) {
	return &bitbox.DeviceInfo{
		Version:   "v2.2.3",
		Serial:    "003135534b4c52483033303632303538",
		ID:        "b245eaa55d24258e8528466b59b678760807c248dccfd8da031316d6216bee18",
		TFA:       "gWNWYwqvce1uR+r4w6qYbA+XBOQGfIu9pUOlQmOqeDQg6s9BDQwfZgwYTMgoYBYO",
		Bootlock:  true,
		Name:      "Emulated BitBox",
		SDCard:    false,
		Lock:      false,
		U2F:       true,
		U2FHijack: true,
		Seeded:    true,
	}, nil
}

// SetPassword is not supported.
func (ks *SoftwareBasedKeyStore) SetPassword(string) error {
	panic("SetPassword is not supported.")
}

// CreateWallet is not supported.
func (ks *SoftwareBasedKeyStore) CreateWallet(string, string) error {
	panic("CreateWallet is not supported.")
}

// Reset is not supported.
func (ks *SoftwareBasedKeyStore) Reset() (bool, error) {
	panic("Reset is not supported.")
}

// EraseBackup is not supported.
func (ks *SoftwareBasedKeyStore) EraseBackup(string) error {
	panic("EraseBackup is not supported.")
}

// RestoreBackup is not supported.
func (ks *SoftwareBasedKeyStore) RestoreBackup(string, string) (bool, error) {
	panic("RestoreBackup is not supported.")
}

// CreateBackup is not supported.
func (ks *SoftwareBasedKeyStore) CreateBackup(string, string) error {
	panic("CreateBackup is not supported.")
}

// BackupList is not supported.
func (ks *SoftwareBasedKeyStore) BackupList() ([]string, error) {
	panic("BackupList not supported.")
}

// BootloaderUpgradeFirmware is not supported.
func (ks *SoftwareBasedKeyStore) BootloaderUpgradeFirmware([]byte) error {
	panic("BootloaderUpgradeFirmware not supported.")
}

// SetPasswordPolicy is a noop.
func (ks *SoftwareBasedKeyStore) SetPasswordPolicy(bool) {
}
