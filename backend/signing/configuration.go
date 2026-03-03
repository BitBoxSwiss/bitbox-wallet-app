// SPDX-License-Identifier: Apache-2.0

package signing

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
)

// KeyInfo contains information about the key and where it is coming from.
type KeyInfo struct {
	// The root fingerprint is the first 32 bits of the hash160 of the pubkey at the keypath m/.
	// https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#key-identifiers
	RootFingerprint   []byte
	AbsoluteKeypath   AbsoluteKeypath
	ExtendedPublicKey *hdkeychain.ExtendedKey
}

func (ki KeyInfo) String() string {
	return fmt.Sprintf("keypath=%s", ki.AbsoluteKeypath.Encode())
}

type keyInfoEncoding struct {
	RootFingerprint string          `json:"rootFingerprint"`
	Keypath         AbsoluteKeypath `json:"keypath"`
	Xpub            string          `json:"xpub"`
}

// MarshalJSON implements json.Marshaler.
func (ki KeyInfo) MarshalJSON() ([]byte, error) {
	return json.Marshal(keyInfoEncoding{
		RootFingerprint: hex.EncodeToString(ki.RootFingerprint),
		Keypath:         ki.AbsoluteKeypath,
		Xpub:            ki.ExtendedPublicKey.String(),
	})
}

// UnmarshalJSON implements json.Unmarshaler.
func (ki *KeyInfo) UnmarshalJSON(bytes []byte) error {
	var encoding keyInfoEncoding
	if err := json.Unmarshal(bytes, &encoding); err != nil {
		return errp.Wrap(err, "Could not unmarshal KeyInfo")
	}
	rootFingerprint, err := hex.DecodeString(encoding.RootFingerprint)
	if err != nil {
		return errp.WithStack(err)
	}
	ki.RootFingerprint = rootFingerprint
	ki.AbsoluteKeypath = encoding.Keypath
	extendedPublicKey, err := hdkeychain.NewKeyFromString(encoding.Xpub)
	if err != nil {
		return errp.Wrap(err, "Could not read an extended public key.")
	}
	ki.ExtendedPublicKey = extendedPublicKey
	return nil
}

// BitcoinSimple represents a simple (single-signature) Bitcoin/Litecoin signing configuration.
type BitcoinSimple struct {
	KeyInfo    KeyInfo    `json:"keyInfo"`
	ScriptType ScriptType `json:"scriptType"`
}

const (
	// Ported from Bitcoin Core DescriptorChecksum() input/checksum charsets:
	// https://github.com/bitcoin/bitcoin/blob/v30.2/src/script/descriptor.cpp#L118-L127
	descriptorInputCharset = "0123456789()[],'/*abcdefgh@:$%{}" +
		"IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~" +
		"ijklmnopqrstuvwxyzABCDEFGH`#\"\\ "
	descriptorChecksumCharset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
)

// Descriptor returns a descriptor for this configuration in the form
// SCRIPT([fingerprint/path]xpub-or-tpub/<0;1>/*)#checksum.
func (configuration *BitcoinSimple) Descriptor(net *chaincfg.Params) (string, error) {
	if configuration == nil {
		return "", errp.New("bitcoin configuration is nil")
	}
	if net == nil {
		return "", errp.New("network is nil")
	}
	if configuration.KeyInfo.ExtendedPublicKey == nil {
		return "", errp.New("extended public key is nil")
	}
	if configuration.KeyInfo.ExtendedPublicKey.IsPrivate() {
		return "", errp.New("extended key must be public")
	}
	if len(configuration.KeyInfo.RootFingerprint) != 4 {
		return "", errp.Newf(
			"root fingerprint must be 4 bytes, got %d",
			len(configuration.KeyInfo.RootFingerprint),
		)
	}

	xpub, err := hdkeychain.NewKeyFromString(configuration.KeyInfo.ExtendedPublicKey.String())
	if err != nil {
		return "", errp.Wrap(err, "could not clone extended public key")
	}
	xpub.SetNet(net)

	originPath := strings.TrimPrefix(configuration.KeyInfo.AbsoluteKeypath.Encode(), "m/")
	keyOrigin := hex.EncodeToString(configuration.KeyInfo.RootFingerprint)
	if originPath != "" {
		keyOrigin += "/" + originPath
	}
	keyExpression := fmt.Sprintf("[%s]%s/<0;1>/*", keyOrigin, xpub.String())

	var descriptor string
	switch configuration.ScriptType {
	case ScriptTypeP2PKH:
		descriptor = fmt.Sprintf("pkh(%s)", keyExpression)
	case ScriptTypeP2WPKHP2SH:
		descriptor = fmt.Sprintf("sh(wpkh(%s))", keyExpression)
	case ScriptTypeP2WPKH:
		descriptor = fmt.Sprintf("wpkh(%s)", keyExpression)
	case ScriptTypeP2TR:
		descriptor = fmt.Sprintf("tr(%s)", keyExpression)
	default:
		return "", errp.Newf("unsupported script type: %s", configuration.ScriptType)
	}
	return addDescriptorChecksum(descriptor)
}

// Ported from Bitcoin Core PolyMod():
// https://github.com/bitcoin/bitcoin/blob/v30.2/src/script/descriptor.cpp#L94-L104
func descriptorPolyMod(checksum uint64, value int) uint64 {
	c0 := checksum >> 35
	checksum = ((checksum & 0x7ffffffff) << 5) ^ uint64(value)
	if c0&1 != 0 {
		checksum ^= 0xf5dee51989
	}
	if c0&2 != 0 {
		checksum ^= 0xa9fdca3312
	}
	if c0&4 != 0 {
		checksum ^= 0x1bab10e32d
	}
	if c0&8 != 0 {
		checksum ^= 0x3706b1677a
	}
	if c0&16 != 0 {
		checksum ^= 0x644d626ffd
	}
	return checksum
}

// Ported from Bitcoin Core DescriptorChecksum():
// https://github.com/bitcoin/bitcoin/blob/v30.2/src/script/descriptor.cpp#L106-L151
func descriptorChecksum(descriptor string) (string, error) {
	checksum := uint64(1)
	class := 0
	classCount := 0
	for i := 0; i < len(descriptor); i++ {
		position := strings.IndexByte(descriptorInputCharset, descriptor[i])
		if position == -1 {
			return "", errp.New("invalid character in descriptor")
		}
		checksum = descriptorPolyMod(checksum, position&31)
		class = class*3 + (position >> 5)
		classCount++
		if classCount == 3 {
			checksum = descriptorPolyMod(checksum, class)
			class = 0
			classCount = 0
		}
	}
	if classCount > 0 {
		checksum = descriptorPolyMod(checksum, class)
	}
	for i := 0; i < 8; i++ {
		checksum = descriptorPolyMod(checksum, 0)
	}
	checksum ^= 1

	result := make([]byte, 8)
	for i := 0; i < 8; i++ {
		index := (checksum >> uint(5*(7-i))) & 31
		result[i] = descriptorChecksumCharset[int(index)]
	}
	return string(result), nil
}

// Ported from Bitcoin Core AddChecksum():
// https://github.com/bitcoin/bitcoin/blob/v30.2/src/script/descriptor.cpp#L153
func addDescriptorChecksum(descriptor string) (string, error) {
	checksum, err := descriptorChecksum(descriptor)
	if err != nil {
		return "", err
	}
	return descriptor + "#" + checksum, nil
}

// EthereumSimple represents a simple (standard single-sig, no exotic signing methods) Ethereum
// signing configuration.
type EthereumSimple struct {
	KeyInfo KeyInfo `json:"keyInfo"`
}

// Configuration models a signing configuration.
type Configuration struct {
	// Poor man's union type: only one of the below can be non-nil.

	BitcoinSimple  *BitcoinSimple  `json:"bitcoinSimple,omitempty"`
	EthereumSimple *EthereumSimple `json:"ethereumSimple,omitempty"`
}

// NewBitcoinConfiguration creates a new configuration.
func NewBitcoinConfiguration(
	scriptType ScriptType,
	rootFingerprint []byte,
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKey *hdkeychain.ExtendedKey,
) *Configuration {
	if extendedPublicKey.IsPrivate() {
		panic("An extended key is private! Only extended public keys are accepted.")
	}
	return &Configuration{
		BitcoinSimple: &BitcoinSimple{
			ScriptType: scriptType,
			KeyInfo: KeyInfo{
				RootFingerprint:   rootFingerprint,
				AbsoluteKeypath:   absoluteKeypath,
				ExtendedPublicKey: extendedPublicKey,
			},
		},
	}
}

// NewEthereumConfiguration creates a new configuration.
func NewEthereumConfiguration(
	rootFingerprint []byte,
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKey *hdkeychain.ExtendedKey,
) *Configuration {
	if extendedPublicKey.IsPrivate() {
		panic("An extended key is private! Only extended public keys are accepted.")
	}
	return &Configuration{
		EthereumSimple: &EthereumSimple{
			KeyInfo{
				RootFingerprint:   rootFingerprint,
				AbsoluteKeypath:   absoluteKeypath,
				ExtendedPublicKey: extendedPublicKey,
			},
		},
	}
}

// ScriptType returns the configuration's keypath.
func (configuration *Configuration) ScriptType() ScriptType {
	return configuration.BitcoinSimple.ScriptType
}

// AbsoluteKeypath returns the configuration's keypath.
func (configuration *Configuration) AbsoluteKeypath() AbsoluteKeypath {
	if configuration.BitcoinSimple != nil {
		return configuration.BitcoinSimple.KeyInfo.AbsoluteKeypath
	}
	return configuration.EthereumSimple.KeyInfo.AbsoluteKeypath
}

// ExtendedPublicKey returns the configuration's extended public key.
func (configuration *Configuration) ExtendedPublicKey() *hdkeychain.ExtendedKey {
	if configuration.BitcoinSimple != nil {
		return configuration.BitcoinSimple.KeyInfo.ExtendedPublicKey
	}
	return configuration.EthereumSimple.KeyInfo.ExtendedPublicKey
}

// AccountNumber returns the account number as present in the BIP44 keypath.
// The configuration keypath must be a BIP44 keypath:
// m/purpose'/coin'/account' for Bitcoin-based coins.
// m/44'/coin'/0'/0/account for Ethereum.
// For invalid keypaths, zero is returned for the account number, along with an error.
func (configuration *Configuration) AccountNumber() (uint16, error) {
	if configuration.BitcoinSimple != nil {
		keypath := configuration.BitcoinSimple.KeyInfo.AbsoluteKeypath.ToUInt32()
		if len(keypath) != 3 || keypath[2] < hdkeychain.HardenedKeyStart {
			return 0, errp.Newf("unexpected bitcoin keypath: %v", keypath)
		}
		return uint16(keypath[2] - hdkeychain.HardenedKeyStart), nil
	}
	if configuration.EthereumSimple != nil {
		keypath := configuration.EthereumSimple.KeyInfo.AbsoluteKeypath.ToUInt32()
		if len(keypath) != 5 || keypath[4] >= hdkeychain.HardenedKeyStart {
			return 0, errp.Newf("unexpected ethereum keypath: %v", keypath)
		}
		return uint16(keypath[4]), nil
	}
	return 0, errp.New("unknown signing configuration type")
}

// PublicKey returns the configuration's public key.
func (configuration *Configuration) PublicKey() *btcec.PublicKey {
	publicKey, err := configuration.ExtendedPublicKey().ECPubKey()
	if err != nil {
		panic("Failed to convert an extended public key to a normal public key.")
	}
	return publicKey
}

// String returns a short summary of the configuration to be used in logs, etc.
func (configuration *Configuration) String() string {
	if configuration.BitcoinSimple != nil {
		return fmt.Sprintf("bitcoinSimple;scriptType=%s;%s",
			configuration.BitcoinSimple.ScriptType, configuration.BitcoinSimple.KeyInfo)
	}
	return fmt.Sprintf("ethereumSimple;%s", configuration.EthereumSimple.KeyInfo)
}

// Configurations is an unordered collection of configurations. All entries must have the same root
// fingerprint.
type Configurations []*Configuration

// AccountNumber returns the first config's account number. It assumes all configurations have the
// same account number.
func (configs Configurations) AccountNumber() (uint16, error) {
	for _, config := range configs {
		return config.AccountNumber()
	}
	return 0, errp.New("no configs")
}

// RootFingerprint gets the fingerprint of the first config (assuming that all configurations have
// the same rootFingerprint). Returns an error if the list has no entries or does not contain a
// known config.
func (configs Configurations) RootFingerprint() ([]byte, error) {
	for _, config := range configs {
		if config.BitcoinSimple != nil {
			return config.BitcoinSimple.KeyInfo.RootFingerprint, nil
		}
		if config.EthereumSimple != nil {
			return config.EthereumSimple.KeyInfo.RootFingerprint, nil
		}
	}
	return nil, errp.New("Could not retrieve fingerprint from signing configurations")
}

// ContainsRootFingerprint returns true if the rootFingerprint is present in one of the configurations.
func (configs Configurations) ContainsRootFingerprint(rootFingerprint []byte) bool {
	for _, config := range configs {
		if config.BitcoinSimple != nil {
			if bytes.Equal(config.BitcoinSimple.KeyInfo.RootFingerprint, rootFingerprint) {
				return true
			}
		}
		if config.EthereumSimple != nil {
			if bytes.Equal(config.EthereumSimple.KeyInfo.RootFingerprint, rootFingerprint) {
				return true
			}
		}
	}
	return false
}

// FindScriptType returns the index of the first configuration that is a Bitcoin configuration
// and uses the provided script type. Returns -1 if none is found.
func (configs Configurations) FindScriptType(scriptType ScriptType) int {
	for idx, config := range configs {
		if config.BitcoinSimple != nil && config.BitcoinSimple.ScriptType == scriptType {
			return idx
		}
	}
	return -1
}
