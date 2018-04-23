package signing

import (
	"bytes"
	"encoding/base64"
	"encoding/gob"
	"encoding/json"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/util/errp"
)

type Configuration struct {
	absoluteKeypath    AbsoluteKeypath
	extendedPublicKeys []*hdkeychain.ExtendedKey
	signingThreshold   int
	onChainSignature   bool
}

func NewConfiguration(
	absoluteKeypath AbsoluteKeypath,
	extendedPublicKeys []*hdkeychain.ExtendedKey,
	signingThreshold int,
	onChainSignature bool,
) *Configuration {
	return &Configuration{
		absoluteKeypath:    absoluteKeypath,
		extendedPublicKeys: extendedPublicKeys,
		signingThreshold:   signingThreshold,
		onChainSignature:   onChainSignature,
	}
}

func (configuration *Configuration) AbsoluteKeypath() AbsoluteKeypath {
	return configuration.absoluteKeypath
}

func (configuration *Configuration) ExtendedPublicKeys() []*hdkeychain.ExtendedKey {
	return configuration.extendedPublicKeys
}

func (configuration *Configuration) SigningThreshold() int {
	return configuration.signingThreshold
}

func (configuration *Configuration) OnChainSignature() bool {
	return configuration.onChainSignature
}

func (configuration *Configuration) NumberOfSigners() int {
	return len(configuration.extendedPublicKeys)
}

func (configuration *Configuration) IsSingleSignature() bool {
	return configuration.NumberOfSigners() == 1
}

func (configuration *Configuration) IsMultiSignature() bool {
	return configuration.NumberOfSigners() > 1
}

func (configuration *Configuration) Derive(relativeKeypath RelativeKeypath) (*Configuration, error) {
	if !relativeKeypath.NonHardened() {
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
		absoluteKeypath:    configuration.absoluteKeypath.Append(relativeKeypath),
		extendedPublicKeys: derivedPublicKeys,
		signingThreshold:   configuration.signingThreshold,
		onChainSignature:   configuration.onChainSignature,
	}, nil
}

func (configuration *Configuration) Hash() string {
	buffer := &bytes.Buffer{}
	encoder := gob.NewEncoder(buffer)
	if err := encoder.Encode(configuration); err != nil {
		panic(err)
	}
	return base64.StdEncoding.EncodeToString(buffer.Bytes())
}

type encoding struct {
	Keypath   AbsoluteKeypath `json:"keypath"`
	Threshold int             `json:"threshold"`
	Chain     bool            `json:"chain"`
	Xpubs     []string        `json:"xpubs"`
}

func (configuration Configuration) MarshalJSON() ([]byte, error) {
	length := configuration.NumberOfSigners()
	xpubs := make([]string, length)
	for i := 0; i < length; i++ {
		xpubs[i] = configuration.extendedPublicKeys[i].String()
	}
	return json.Marshal(&encoding{
		Keypath:   configuration.absoluteKeypath,
		Threshold: configuration.signingThreshold,
		Chain:     configuration.onChainSignature,
		Xpubs:     xpubs,
	})
}

func (configuration *Configuration) UnmarshalJSON(bytes []byte) error {
	var encoding encoding
	if err := json.Unmarshal(bytes, &encoding); err != nil {
		return errp.Wrap(err, "Could not unmarshal a signing configuration.")
	}
	configuration.absoluteKeypath = encoding.Keypath
	configuration.signingThreshold = encoding.Threshold
	configuration.onChainSignature = encoding.Chain
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
