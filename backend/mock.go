package backend

import (
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/devices/bitbox"
)

// DeviceID stores the device ID of the software-based key store.
const DeviceID = "SoftwareBasedKeyStore"

// SoftwareBasedKeyStore implements the BitBox interface to test the backend and the wallets.
type SoftwareBasedKeyStore struct {
	seed   []byte
	master *hdkeychain.ExtendedKey
}

// NewSoftwareBasedKeyStore creates a new software-based key store.
func NewSoftwareBasedKeyStore() (*SoftwareBasedKeyStore, error) {
	seed, err := hdkeychain.GenerateSeed(hdkeychain.RecommendedSeedLen)
	if err != nil {
		return nil, err
	}
	master, err := hdkeychain.NewMaster(seed, &chaincfg.TestNet3Params)
	if err != nil {
		return nil, err
	}
	return &SoftwareBasedKeyStore{seed, master}, nil
}

// XPub returns the xpub at the given path.
func (ks *SoftwareBasedKeyStore) XPub(path string) (*hdkeychain.ExtendedKey, error) {
	return ks.master.Neuter()
}

// Sign signs the given hashes at the given paths.
func (ks *SoftwareBasedKeyStore) Sign(signatureHashes [][]byte, keyPaths []string) ([]btcec.Signature, error) {
	panic("Sign is not yet supported.")
}

// DeviceID returns a pseudo device ID.
func (ks *SoftwareBasedKeyStore) DeviceID() string {
	return DeviceID
}

// SetOnEvent does nothing.
func (ks *SoftwareBasedKeyStore) SetOnEvent(onEvent func(bitbox.Event)) {}

// Status always returns that this fake BitBox is seeded.
func (ks *SoftwareBasedKeyStore) Status() bitbox.Status {
	return bitbox.StatusSeeded
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
func (ks *SoftwareBasedKeyStore) CreateWallet(string) error {
	panic("CreateWallet is not supported.")
}

// Login is not supported.
func (ks *SoftwareBasedKeyStore) Login(string) (bool, string, error) {
	panic("Login is not supported.")
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
func (ks *SoftwareBasedKeyStore) CreateBackup(string) error {
	panic("CreateBackup is not supported.")
}

// BackupList is not supported.
func (ks *SoftwareBasedKeyStore) BackupList() ([]string, error) {
	panic("BackupList not supported.")
}
