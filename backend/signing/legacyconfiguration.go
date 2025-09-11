// Copyright 2021 Shift Crypto AG
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
	"sort"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// LegacyConfiguration models a signing configuration as it was done up to v4.27.0. From v4.28.0,
// the configuration format was changed (see `Configuration`). This code remains so that we can
// still create the `Hash()` over the configurations for migration purposes: the hash was used in
// account identifiers (changed in v4.28.0), which was used as a key to store transaction
// notes. This is used to be able to access transaction notes under the old account identifiers.
type LegacyConfiguration struct {
	scriptType         ScriptType // Only used in btc and ltc, dummy for eth
	absoluteKeypath    AbsoluteKeypath
	extendedPublicKeys []*hdkeychain.ExtendedKey // Should be empty for address based watch only accounts
	signingThreshold   int                       // TODO Multisig Only
	address            string                    // For address based accounts only
}

type legacyConfigurationEncoding struct {
	ScriptType string          `json:"scriptType"`
	Keypath    AbsoluteKeypath `json:"keypath"`
	Threshold  int             `json:"threshold"`
	Xpubs      []string        `json:"xpubs"`
	Address    string          `json:"address"`
}

// MarshalJSON implements json.Marshaler.
func (configuration LegacyConfiguration) MarshalJSON() ([]byte, error) {
	length := len(configuration.extendedPublicKeys)
	xpubs := make([]string, length)
	for i := 0; i < length; i++ {
		xpubs[i] = configuration.extendedPublicKeys[i].String()
	}
	return json.Marshal(&legacyConfigurationEncoding{
		ScriptType: string(configuration.scriptType),
		Keypath:    configuration.absoluteKeypath,
		Threshold:  configuration.signingThreshold,
		Xpubs:      xpubs,
		Address:    configuration.address,
	})
}

// Hash returns a hash of the configuration in hex format.
func (configuration *LegacyConfiguration) Hash() string {
	hash := sha256.Sum256(jsonp.MustMarshal(configuration))
	return hex.EncodeToString(hash[:])
}

// LegacyConfigurations is an unordered collection of legacy configurations.
type LegacyConfigurations []*LegacyConfiguration

// Hash returns a hash of all configurations in hex format. It is defined as
// `sha256(<32 bytes hash 1>|<32 bytes hash 2>|...)`, where the hashes are first sorted, so
// changing the order does *not* change the hash.
func (configs LegacyConfigurations) Hash() string {
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

// ConvertToLegacyConfigurations converts the new signing configurations format to the legacy format
// used up to v4.27.0.
func ConvertToLegacyConfigurations(configurations Configurations) LegacyConfigurations {
	var result LegacyConfigurations
	for _, cfg := range configurations {
		scriptType := ScriptTypeP2PKH // Was used as default for Ethereum
		if cfg.BitcoinSimple != nil {
			scriptType = cfg.BitcoinSimple.ScriptType
		}
		result = append(result, &LegacyConfiguration{
			scriptType:         scriptType,
			absoluteKeypath:    *cfg.AbsoluteKeypath(),
			extendedPublicKeys: []*hdkeychain.ExtendedKey{cfg.ExtendedPublicKey()},
			signingThreshold:   1,
		})
	}
	return result
}
