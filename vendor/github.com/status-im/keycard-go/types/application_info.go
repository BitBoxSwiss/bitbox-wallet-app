package types

import (
	"errors"

	"github.com/status-im/keycard-go/apdu"
)

var ErrWrongApplicationInfoTemplate = errors.New("wrong application info template")

type Capability uint8

const (
	TagSelectResponsePreInitialized uint8 = 0x80
	TagApplicationStatusTemplate    uint8 = 0xA3
	TagApplicationInfoTemplate      uint8 = 0xA4
	TagApplicationInfoCapabilities  uint8 = 0x8D
)

const (
	CapabilitySecureChannel Capability = 1 << iota
	CapabilityKeyManagement
	CapabilityCredentialsManagement
	CapabilityNDEF

	CapabilityAll = CapabilitySecureChannel |
		CapabilityKeyManagement |
		CapabilityCredentialsManagement |
		CapabilityNDEF
)

type ApplicationInfo struct {
	Installed              bool
	Initialized            bool
	InstanceUID            []byte
	SecureChannelPublicKey []byte
	Version                []byte
	AvailableSlots         []byte
	// KeyUID is the sha256 of of the master public key on the card.
	// It's empty if the card doesn't contain any key.
	KeyUID       []byte
	Capabilities Capability
}

func (a *ApplicationInfo) HasCapability(c Capability) bool {
	return a.Capabilities&c == c
}

func (a *ApplicationInfo) HasSecureChannelCapability() bool {
	return a.HasCapability(CapabilitySecureChannel)
}

func (a *ApplicationInfo) HasKeyManagementCapability() bool {
	return a.HasCapability(CapabilityKeyManagement)
}

func (a *ApplicationInfo) HasCredentialsManagementCapability() bool {
	return a.HasCapability(CapabilityCredentialsManagement)
}

func (a *ApplicationInfo) HasNDEFCapability() bool {
	return a.HasCapability(CapabilityNDEF)
}

func ParseApplicationInfo(data []byte) (*ApplicationInfo, error) {
	info := &ApplicationInfo{
		Installed: true,
	}

	if data[0] == TagSelectResponsePreInitialized {
		info.SecureChannelPublicKey = data[2:]
		info.Capabilities = CapabilityCredentialsManagement

		if len(info.SecureChannelPublicKey) > 0 {
			info.Capabilities = info.Capabilities | CapabilitySecureChannel
		}

		return info, nil
	}

	info.Initialized = true

	if data[0] != TagApplicationInfoTemplate {
		return nil, ErrWrongApplicationInfoTemplate
	}

	instanceUID, err := apdu.FindTag(data, apdu.Tag{TagApplicationInfoTemplate}, apdu.Tag{0x8F})
	if err != nil {
		return nil, err
	}

	pubKey, err := apdu.FindTag(data, apdu.Tag{TagApplicationInfoTemplate}, apdu.Tag{0x80})
	if err != nil {
		return nil, err
	}

	appVersion, err := apdu.FindTag(data, apdu.Tag{TagApplicationInfoTemplate}, apdu.Tag{0x02})
	if err != nil {
		return nil, err
	}

	availableSlots, err := apdu.FindTagN(data, 1, apdu.Tag{TagApplicationInfoTemplate}, apdu.Tag{0x02})
	if err != nil {
		return nil, err
	}

	keyUID, err := apdu.FindTagN(data, 0, apdu.Tag{TagApplicationInfoTemplate}, apdu.Tag{0x8E})
	if err != nil {
		return nil, err
	}

	capabilities := CapabilityAll
	capabilitiesBytes, err := apdu.FindTag(data, apdu.Tag{TagApplicationInfoCapabilities})
	if err == nil && len(capabilitiesBytes) > 0 {
		capabilities = Capability(capabilitiesBytes[0])
	}

	info.InstanceUID = instanceUID
	info.SecureChannelPublicKey = pubKey
	info.Version = appVersion
	info.AvailableSlots = availableSlots
	info.KeyUID = keyUID
	info.Capabilities = capabilities

	return info, nil
}
