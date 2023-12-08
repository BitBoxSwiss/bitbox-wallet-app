// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

package signing

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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

// Derive derives a subkeypath from the configuration's base absolute keypath.
func (configuration *Configuration) Derive(relativeKeypath RelativeKeypath) (*Configuration, error) {
	btc := configuration.BitcoinSimple
	if btc != nil {
		if relativeKeypath.Hardened() {
			return nil, errp.New("A configuration can only be derived with a non-hardened relative keypath.")
		}

		derivedPublicKey, err := relativeKeypath.Derive(btc.KeyInfo.ExtendedPublicKey)
		if err != nil {
			return nil, err
		}
		return NewBitcoinConfiguration(
			btc.ScriptType,
			btc.KeyInfo.RootFingerprint,
			btc.KeyInfo.AbsoluteKeypath.Append(relativeKeypath),
			derivedPublicKey,
		), nil
	}

	return nil, errp.New("Can only call this on a bitcoin configuration")
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
