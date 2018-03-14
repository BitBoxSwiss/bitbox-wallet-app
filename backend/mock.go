package backend

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
)

// DeviceID stores the device ID of the software-based key store.
const DeviceID = "SoftwareBasedKeyStore"

const hardcodedMasterKey = "tprv8ZgxMBicQKsPeHoKvC2LcH1M8i11H75m675xizMT" +
	"biRGQ44W7Q153pRffSrBAbbUAvgCjo4RjPxn2AUuJnG4eDzBWx7TDqXoGzyac6VD9EE"

// SoftwareBasedKeyStore implements the BitBox interface to test the backend and the wallets.
type SoftwareBasedKeyStore struct {
	master   *hdkeychain.ExtendedKey
	status   bitbox.Status
	listener func(bitbox.Event)
}

// NewSoftwareBasedKeyStore creates a new software-based key store.
// newSeed determines whether a new seed is generated or the hardcoded one is used.
func NewSoftwareBasedKeyStore(newSeed bool) (*SoftwareBasedKeyStore, error) {
	var master *hdkeychain.ExtendedKey
	if newSeed {
		var err error
		seed, err := hdkeychain.GenerateSeed(hdkeychain.RecommendedSeedLen)
		if err != nil {
			return nil, err
		}
		master, err = hdkeychain.NewMaster(seed, &chaincfg.TestNet3Params)
		if err != nil {
			return nil, err
		}
		fmt.Println("Master of software-based key store: " + master.String())
	} else {
		var err error
		master, err = hdkeychain.NewKeyFromString(hardcodedMasterKey)
		if err != nil {
			return nil, err
		}
	}
	return &SoftwareBasedKeyStore{master, bitbox.StatusInitialized, nil}, nil
}

// xprv returns the xprv at the given absolute path.
func (ks *SoftwareBasedKeyStore) xprv(path string) (*hdkeychain.ExtendedKey, error) {
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
func (ks *SoftwareBasedKeyStore) Sign(signatureHashes [][]byte, keyPaths []string) ([]btcec.Signature, error) {
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

// DeviceID returns a pseudo device ID.
func (ks *SoftwareBasedKeyStore) DeviceID() string {
	return DeviceID
}

// SetOnEvent registers the given function as a listener.
func (ks *SoftwareBasedKeyStore) SetOnEvent(listener func(bitbox.Event)) {
	ks.listener = listener
}

// Status always returns that this fake BitBox is seeded.
func (ks *SoftwareBasedKeyStore) Status() bitbox.Status {
	return ks.status
}

// Sets the status of the key store and notifies the listener if set.
func (ks *SoftwareBasedKeyStore) setStatus(status bitbox.Status) {
	ks.status = status
	if ks.listener != nil {
		ks.listener(bitbox.EventStatusChanged)
	}
}

// Login accepts any password and unlocks this key store.
func (ks *SoftwareBasedKeyStore) Login(password string) (bool, string, error) {
	fmt.Println("Unlocking the software-based key store.")
	ks.setStatus(bitbox.StatusSeeded)
	return false, "", nil
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
