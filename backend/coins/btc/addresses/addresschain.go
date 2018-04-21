package addresses

import (
	"fmt"

	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
)

// AddressChain manages a chain of addresses derived from an xpub.
type AddressChain struct {
	xpub        *hdkeychain.ExtendedKey
	net         *chaincfg.Params
	gapLimit    int
	chainIndex  uint32
	addressType AddressType
	addresses   []*Address
	log         *logrus.Entry
}

// NewAddressChain creates an address chain starting at m/<chainIndex> from the given xpub. xpub
// must be public (neutered) and the xpub type must match the passed net.
func NewAddressChain(
	xpub *hdkeychain.ExtendedKey,
	net *chaincfg.Params,
	gapLimit int,
	chainIndex uint32,
	addressType AddressType,
	log *logrus.Entry,
) *AddressChain {
	if xpub.IsPrivate() {
		panic("Extended key is private! Only public keys are accepted")
	}
	if !xpub.IsForNet(net) {
		panic(errp.New("xpub does not match provided net"))
	}
	chainXPub, err := xpub.Child(chainIndex)
	if err != nil {
		log.WithField("error", err).WithError(err)
		panic(err)
	}
	return &AddressChain{
		xpub:        chainXPub,
		net:         net,
		gapLimit:    gapLimit,
		chainIndex:  chainIndex,
		addressType: addressType,
		addresses:   []*Address{},
		log: log.WithFields(logrus.Fields{"group": "addresses", "net": net.Name,
			"gap-limit": gapLimit, "address-type": addressType}),
	}
}

// GetUnused returns the first unused address. EnsureAddresses() must be called beforehand.
func (addresses *AddressChain) GetUnused() *Address {
	unusedTailCount := addresses.unusedTailCount()
	if unusedTailCount < addresses.gapLimit {
		addresses.log.Panic("Concurrency error: Addresses not synced correctly")
	}
	return addresses.addresses[len(addresses.addresses)-unusedTailCount]
}

func (addresses *AddressChain) getPubKey(index uint32) *btcec.PublicKey {
	addresses.log.Debug("Get public key")
	xpub, err := addresses.xpub.Child(index)
	if err != nil {
		addresses.log.WithFields(logrus.Fields{"index": index, "error": err}).
			Panic("Failed to get XPub child")
		panic(err)
	}
	publicKey, err := xpub.ECPubKey()
	if err != nil {
		addresses.log.WithField("error", err).Panic("Failed to get EC pubkey")
		panic(err)
	}
	return publicKey
}

// addAddress appends a new address at the end of the chain.
func (addresses *AddressChain) addAddress() *Address {
	addresses.log.Debug("Add new address to chain")
	index := len(addresses.addresses)
	publicKey := addresses.getPubKey(uint32(index))
	addressWithPK := NewAddress(
		publicKey,
		addresses.net,
		fmt.Sprintf("%d/%d", addresses.chainIndex, index),
		addresses.addressType,
		addresses.log,
	)
	addresses.addresses = append(addresses.addresses, addressWithPK)
	return addressWithPK

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
func (addresses *AddressChain) LookupByScriptHashHex(scriptHashHex client.ScriptHashHex) *Address {
	// todo: add map for constant time lookup
	for _, address := range addresses.addresses {
		if address.ScriptHashHex() == scriptHashHex {
			return address
		}
	}
	return nil
}

// EnsureAddresses appends addresses to the address chain until there are `gapLimit` unused unused
// ones, and returns the new addresses.
func (addresses *AddressChain) EnsureAddresses() []*Address {
	addedAddresses := []*Address{}
	unusedAddressCount := addresses.unusedTailCount()
	for i := 0; i < addresses.gapLimit-unusedAddressCount; i++ {
		addedAddresses = append(addedAddresses, addresses.addAddress())
	}
	return addedAddresses
}
