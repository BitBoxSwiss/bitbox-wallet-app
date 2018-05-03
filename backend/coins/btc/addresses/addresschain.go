package addresses

import (
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/sirupsen/logrus"

	"github.com/btcsuite/btcd/chaincfg"
)

// AddressChain manages a chain of addresses derived from a configuration.
type AddressChain struct {
	configuration *signing.Configuration
	net           *chaincfg.Params
	gapLimit      int
	chainIndex    uint32
	addressType   AddressType
	addresses     []*AccountAddress
	log           *logrus.Entry
}

// NewAddressChain creates an address chain starting at m/<chainIndex> from the given configuration.
func NewAddressChain(
	configuration *signing.Configuration,
	net *chaincfg.Params,
	gapLimit int,
	chainIndex uint32,
	addressType AddressType,
	log *logrus.Entry,
) *AddressChain {
	chainConfiguration, err := configuration.Derive(
		signing.NewEmptyRelativeKeypath().Child(chainIndex, signing.NonHardened),
	)
	if err != nil {
		log.WithField("error", err).Panic("Could not derive the chain configuration.")
	}
	return &AddressChain{
		configuration: chainConfiguration,
		net:           net,
		gapLimit:      gapLimit,
		chainIndex:    chainIndex,
		addressType:   addressType,
		addresses:     []*AccountAddress{},
		log: log.WithFields(logrus.Fields{"group": "addresses", "net": net.Name,
			"gap-limit": gapLimit, "address-type": addressType}),
	}
}

// GetUnused returns the first unused address. EnsureAddresses() must be called beforehand.
func (addresses *AddressChain) GetUnused() *AccountAddress {
	unusedTailCount := addresses.unusedTailCount()
	if unusedTailCount < addresses.gapLimit {
		addresses.log.Panic("Concurrency error: Addresses not synced correctly")
	}
	return addresses.addresses[len(addresses.addresses)-unusedTailCount]
}

// addAddress appends a new address at the end of the chain.
func (addresses *AddressChain) addAddress() *AccountAddress {
	addresses.log.Debug("Add new address to chain")
	index := uint32(len(addresses.addresses))
	configuration, err := addresses.configuration.Derive(
		signing.NewEmptyRelativeKeypath().Child(index, signing.NonHardened),
	)
	if err != nil {
		addresses.log.WithField("error", err).Panic("Failed to derive the configuration.")
	}

	address := NewAccountAddress(
		configuration,
		addresses.addressType,
		addresses.net,
		addresses.log,
	)
	addresses.addresses = append(addresses.addresses, address)
	return address
}

// unusedTailCount returns the number of unused addresses at the end of the chain.
func (addresses *AddressChain) unusedTailCount() int {
	count := 0
	for i := len(addresses.addresses) - 1; i >= 0; i-- {
		if addresses.addresses[i].isUsed() {
			break
		}
		count++
	}
	addresses.log.WithField("tail-count", count).Debug("Unused tail count")
	return count
}

// LookupByScriptHashHex returns the address which matches the provided scriptHashHex. Returns nil
// if not found.
func (addresses *AddressChain) LookupByScriptHashHex(hashHex client.ScriptHashHex) *AccountAddress {
	// todo: add map for constant time lookup
	for _, address := range addresses.addresses {
		if address.PubkeyScriptHashHex() == hashHex {
			return address
		}
	}
	return nil
}

// EnsureAddresses appends addresses to the address chain until there are `gapLimit` unused unused
// ones, and returns the new addresses.
func (addresses *AddressChain) EnsureAddresses() []*AccountAddress {
	addedAddresses := []*AccountAddress{}
	unusedAddressCount := addresses.unusedTailCount()
	for i := 0; i < addresses.gapLimit-unusedAddressCount; i++ {
		addedAddresses = append(addedAddresses, addresses.addAddress())
	}
	return addedAddresses
}
