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
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonp"
)

// ScriptType indicates which type of output should be produced in case of singlesig.
type ScriptType string

const (
	// ScriptTypeP2PKH is a PayToPubKeyHash output.
	ScriptTypeP2PKH ScriptType = "p2pkh"

	// ScriptTypeP2WPKHP2SH is a segwit PayToPubKeyHash output wrapped in p2sh.
	ScriptTypeP2WPKHP2SH ScriptType = "p2wpkh-p2sh"

	// ScriptTypeP2WPKH is a segwit PayToPubKeyHash output.
	ScriptTypeP2WPKH ScriptType = "p2wpkh"
)

// Configuration models a signing configuration, which can be singlesig or multisig.
type Configuration struct {
	scriptType         ScriptType
	absoluteKeypath    AbsoluteKeypath
	extendedPublicKeys []*hdkeychain.ExtendedKey
	signingThreshold   int
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
		panic("A configuration has to contain at least one extended public key.")
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

// Hash returns a hash of the configuration.
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
