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

// Configuration models a signing configuration, which can be singlesig or multisig based.
type Configuration struct {
	scriptType         ScriptType // Only used in btc and ltc, dummy for eth
	absoluteKeypath    AbsoluteKeypath
	extendedPublicKeys []*hdkeychain.ExtendedKey // Should be empty for address based watch only accounts
	signingThreshold   int                       // TODO Multisig Only
}

// NewConfiguration creates a new configuration. At the moment, multisig is a predefined
// multisig-P2SH script, and is active if there are more than one xpubs. Otherwise, it's single sig
// and `scriptType` defines the type of script.
func NewConfiguration(
	scriptType ScriptType,
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKeys []*hdkeychain.ExtendedKey,
	signingThreshold int,
) *Configuration {
	if len(extendedPublicKeys) == 0 {
		panic("A configuration has to contain at least one extended public key")
	}
	for _, extendedKey := range extendedPublicKeys {
		if extendedKey.IsPrivate() {
			panic("An extended key is private! Only extended public keys are accepted.")
		}
	}
	return &Configuration{
		scriptType:         scriptType,
		absoluteKeypath:    absoluteKeypath,
		extendedPublicKeys: extendedPublicKeys,
		signingThreshold:   signingThreshold,
	}
}

// NewSinglesigConfiguration creates a new singlesig configuration.
func NewSinglesigConfiguration(
	scriptType ScriptType,
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKey *hdkeychain.ExtendedKey,
) *Configuration {
	return NewConfiguration(
		scriptType, absoluteKeypath, []*hdkeychain.ExtendedKey{extendedPublicKey}, 1)
}

// ScriptType returns the configuration's keypath.
func (configuration *Configuration) ScriptType() ScriptType {
	if configuration.Multisig() {
		panic("scriptType is only defined for single sig")
	}
	return configuration.scriptType
}

// AbsoluteKeypath returns the configuration's keypath.
func (configuration *Configuration) AbsoluteKeypath() AbsoluteKeypath {
	return configuration.absoluteKeypath
}

// ExtendedPublicKeys returns the configuration's extended public keys.
func (configuration *Configuration) ExtendedPublicKeys() []*hdkeychain.ExtendedKey {
	return configuration.extendedPublicKeys
}

// PublicKeys returns the configuration's public keys.
func (configuration *Configuration) PublicKeys() []*btcec.PublicKey {
	publicKeys := make([]*btcec.PublicKey, configuration.NumberOfSigners())
	for index, extendedPublicKey := range configuration.ExtendedPublicKeys() {
		var err error
		publicKeys[index], err = extendedPublicKey.ECPubKey()
		if err != nil {
			panic("Failed to convert an extended public key to a normal public key.")
		}
	}
	return publicKeys
}

// SortedPublicKeys returns the configuration's public keys sorted in compressed form.
func (configuration *Configuration) SortedPublicKeys() []*btcec.PublicKey {
	publicKeys := configuration.PublicKeys()
	sort.Slice(publicKeys, func(i, j int) bool {
		return bytes.Compare(
			publicKeys[i].SerializeCompressed(),
			publicKeys[j].SerializeCompressed(),
		) < 0
	})
	return publicKeys
}

// SigningThreshold returns the signing threshold in case of a multisig config.
func (configuration *Configuration) SigningThreshold() int {
	return configuration.signingThreshold
}

// NumberOfSigners returns the number of signers (1 in single sig, N in a M/N multisig).
func (configuration *Configuration) NumberOfSigners() int {
	return len(configuration.extendedPublicKeys)
}

// Singlesig returns whether this is a singlesig configuration.
func (configuration *Configuration) Singlesig() bool {
	return len(configuration.extendedPublicKeys) == 1
}

// Multisig returns whether this is a multisig configuration.
func (configuration *Configuration) Multisig() bool {
	return len(configuration.extendedPublicKeys) > 1
}

// Derive derives a subkeypath from the configuration's base absolute keypath.
func (configuration *Configuration) Derive(relativeKeypath RelativeKeypath) (*Configuration, error) {
	if relativeKeypath.Hardened() {
		return nil, errp.New("A configuration can only be derived with a non-hardened relative keypath.")
	}

	derivedPublicKeys := make([]*hdkeychain.ExtendedKey, configuration.NumberOfSigners())
	for index, extendedPublicKey := range configuration.extendedPublicKeys {
		derivedPublicKey, err := relativeKeypath.Derive(extendedPublicKey)
		if err != nil {
			return nil, err
		}
		derivedPublicKeys[index] = derivedPublicKey
	}
	return &Configuration{
		scriptType:         configuration.scriptType,
		absoluteKeypath:    configuration.absoluteKeypath.Append(relativeKeypath),
		extendedPublicKeys: derivedPublicKeys,
		signingThreshold:   configuration.signingThreshold,
	}, nil
}

type configurationEncoding struct {
	ScriptType string          `json:"scriptType"`
	Keypath    AbsoluteKeypath `json:"keypath"`
	Threshold  int             `json:"threshold"`
	Xpubs      []string        `json:"xpubs"`
}

// MarshalJSON implements json.Marshaler.
func (configuration Configuration) MarshalJSON() ([]byte, error) {
	length := configuration.NumberOfSigners()
	xpubs := make([]string, length)
	for i := 0; i < length; i++ {
		xpubs[i] = configuration.extendedPublicKeys[i].String()
	}
	return json.Marshal(&configurationEncoding{
		ScriptType: string(configuration.scriptType),
		Keypath:    configuration.absoluteKeypath,
		Threshold:  configuration.signingThreshold,
		Xpubs:      xpubs,
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
	configuration.signingThreshold = encoding.Threshold
	length := len(encoding.Xpubs)
	configuration.extendedPublicKeys = make([]*hdkeychain.ExtendedKey, length)
	for i := 0; i < length; i++ {
		var err error
		configuration.extendedPublicKeys[i], err = hdkeychain.NewKeyFromString(encoding.Xpubs[i])
		if err != nil {
			return errp.Wrap(err, "Could not read an extended public key.")
		}
	}
	return nil
}

// Hash returns a hash of the configuration in hex format.
func (configuration *Configuration) Hash() string {
	hash := sha256.Sum256(jsonp.MustMarshal(configuration))
	return hex.EncodeToString(hash[:])
}

// String returns a short summary of the configuration to be used in logs, etc.
func (configuration *Configuration) String() string {
	if configuration.Multisig() {
		return fmt.Sprintf("multisig, %d/%d",
			configuration.SigningThreshold(), configuration.NumberOfSigners())
	}
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
