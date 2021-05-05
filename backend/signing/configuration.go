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

// Configuration models a signing configuration.
type Configuration struct {
	scriptType        ScriptType // Only used in btc and ltc, dummy for eth
	absoluteKeypath   AbsoluteKeypath
	extendedPublicKey *hdkeychain.ExtendedKey
}

// NewConfiguration creates a new configuration.
func NewConfiguration(
	scriptType ScriptType,
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKey *hdkeychain.ExtendedKey,
) *Configuration {
	if extendedPublicKey.IsPrivate() {
		panic("An extended key is private! Only extended public keys are accepted.")
	}
	return &Configuration{
		scriptType:        scriptType,
		absoluteKeypath:   absoluteKeypath,
		extendedPublicKey: extendedPublicKey,
	}
}

// ScriptType returns the configuration's keypath.
func (configuration *Configuration) ScriptType() ScriptType {
	return configuration.scriptType
}

// AbsoluteKeypath returns the configuration's keypath.
func (configuration *Configuration) AbsoluteKeypath() AbsoluteKeypath {
	return configuration.absoluteKeypath
}

// ExtendedPublicKey returns the configuration's extended public key.
func (configuration *Configuration) ExtendedPublicKey() *hdkeychain.ExtendedKey {
	return configuration.extendedPublicKey
}

// PublicKey returns the configuration's public key.
func (configuration *Configuration) PublicKey() *btcec.PublicKey {
	publicKey, err := configuration.extendedPublicKey.ECPubKey()
	if err != nil {
		panic("Failed to convert an extended public key to a normal public key.")
	}
	return publicKey
}

// Derive derives a subkeypath from the configuration's base absolute keypath.
func (configuration *Configuration) Derive(relativeKeypath RelativeKeypath) (*Configuration, error) {
	if relativeKeypath.Hardened() {
		return nil, errp.New("A configuration can only be derived with a non-hardened relative keypath.")
	}

	derivedPublicKey, err := relativeKeypath.Derive(configuration.extendedPublicKey)
	if err != nil {
		return nil, err
	}
	return &Configuration{
		scriptType:        configuration.scriptType,
		absoluteKeypath:   configuration.absoluteKeypath.Append(relativeKeypath),
		extendedPublicKey: derivedPublicKey,
	}, nil
}

type configurationEncoding struct {
	ScriptType string          `json:"scriptType"`
	Keypath    AbsoluteKeypath `json:"keypath"`
	Xpub       string          `json:"xpub"`
}

// MarshalJSON implements json.Marshaler.
func (configuration Configuration) MarshalJSON() ([]byte, error) {
	return json.Marshal(&configurationEncoding{
		ScriptType: string(configuration.scriptType),
		Keypath:    configuration.absoluteKeypath,
		Xpub:       configuration.extendedPublicKey.String(),
	})
}

// UnmarshalJSON implements json.Unmarshaler.
func (configuration *Configuration) UnmarshalJSON(bytes []byte) error {
	var encoding configurationEncoding
	if err := json.Unmarshal(bytes, &encoding); err != nil {
		return errp.Wrap(err, "Could not unmarshal a signing configuration.")
	}
	configuration.scriptType = ScriptType(encoding.ScriptType)
	configuration.absoluteKeypath = encoding.Keypath
	extendedPublicKey, err := hdkeychain.NewKeyFromString(encoding.Xpub)
	if err != nil {
		return errp.Wrap(err, "Could not read an extended public key.")
	}
	configuration.extendedPublicKey = extendedPublicKey
	return nil
}

// Hash returns a hash of the configuration in hex format.
func (configuration *Configuration) Hash() string {
	hash := sha256.Sum256(jsonp.MustMarshal(configuration))
	return hex.EncodeToString(hash[:])
}

// String returns a short summary of the configuration to be used in logs, etc.
func (configuration *Configuration) String() string {
	return fmt.Sprintf("single sig, scriptType: %s", configuration.scriptType)
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
