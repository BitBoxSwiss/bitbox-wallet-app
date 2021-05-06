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
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
)

// KeyInfo contains information about the key and where it is coming from.
type KeyInfo struct {
	AbsoluteKeypath   AbsoluteKeypath
	ExtendedPublicKey *hdkeychain.ExtendedKey
}

func (ki KeyInfo) String() string {
	return fmt.Sprintf("keypath=%s,xpub=%s", ki.AbsoluteKeypath.Encode(), ki.ExtendedPublicKey)
}

type keyInfoEncoding struct {
	Keypath AbsoluteKeypath `json:"keypath"`
	Xpub    string          `json:"xpub"`
}

// MarshalJSON implements json.Marshaler.
func (ki KeyInfo) MarshalJSON() ([]byte, error) {
	return json.Marshal(keyInfoEncoding{
		Keypath: ki.AbsoluteKeypath,
		Xpub:    ki.ExtendedPublicKey.String(),
	})
}

// UnmarshalJSON implements json.Unmarshaler.
func (ki *KeyInfo) UnmarshalJSON(bytes []byte) error {
	var encoding keyInfoEncoding
	if err := json.Unmarshal(bytes, &encoding); err != nil {
		return errp.Wrap(err, "Could not unmarshal KeyInfo")
	}
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
				AbsoluteKeypath:   absoluteKeypath,
				ExtendedPublicKey: extendedPublicKey,
			},
		},
	}
}

// NewEthereumConfiguration creates a new configuration.
func NewEthereumConfiguration(
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKey *hdkeychain.ExtendedKey,
) *Configuration {
	if extendedPublicKey.IsPrivate() {
		panic("An extended key is private! Only extended public keys are accepted.")
	}
	return &Configuration{
		EthereumSimple: &EthereumSimple{
			KeyInfo{
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
			btc.KeyInfo.AbsoluteKeypath.Append(relativeKeypath),
			derivedPublicKey,
		), nil
	}

	return nil, errp.New("Can only call this on a bitcoin configuration")
}

// Hash returns a hash of the configuration in hex format.
func (configuration *Configuration) Hash() string {
	hash := sha256.Sum256(jsonp.MustMarshal(configuration))
	return hex.EncodeToString(hash[:])
}

// String returns a short summary of the configuration to be used in logs, etc.
func (configuration *Configuration) String() string {
	if configuration.BitcoinSimple != nil {
		return fmt.Sprintf("bitcoinSimple;scriptType=%s;%s",
			configuration.BitcoinSimple.ScriptType, configuration.BitcoinSimple.KeyInfo)
	}
	return fmt.Sprintf("ethereumSimple;%s", configuration.EthereumSimple.KeyInfo)
}

// Configurations is an unordered collection of configurations.
type Configurations []*Configuration

// Hash returns a hash of all configurations in hex format. It is defined as
// `sha256(<32 bytes hash 1>|<32 bytes hash 2>|...)`, where the hashes are first sorted, so
// changing the order does *not* change the hash.
func (configs Configurations) Hash() string {
	hashes := make([][]byte, len(configs))
	for i, cfg := range configs {
		hash, err := hex.DecodeString(cfg.Hash())
		if err != nil {
			panic(errp.WithStack(err))
		}
		hashes[i] = hash
	}
	sort.Slice(hashes, func(i, j int) bool { return bytes.Compare(hashes[i], hashes[j]) < 0 })
	h := sha256.New()
	for _, hash := range hashes {
		if _, err := h.Write(hash); err != nil {
			panic(errp.WithStack(err))
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}
