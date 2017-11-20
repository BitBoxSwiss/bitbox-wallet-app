package addresses

import (
	"fmt"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"
)

// AddressChain manages a chain of addresses derived from an xpub.
type AddressChain struct {
	addresses  []*Address
	xpub       *hdkeychain.ExtendedKey
	gapLimit   int
	chainIndex uint32
}

// NewAddressChain creates an address chain starting at m/<chainIndex> from the given xpub.
func NewAddressChain(xpub *hdkeychain.ExtendedKey, gapLimit int, chainIndex uint32) *AddressChain {
	chainXPub, err := xpub.Child(chainIndex)
	if err != nil {
		panic(err)
	}
	return &AddressChain{
		addresses:  []*Address{},
		xpub:       chainXPub,
		gapLimit:   gapLimit,
		chainIndex: chainIndex,
	}
}

// GetUnused returns the first unused address.
func (addresses AddressChain) GetUnused() *Address {
	if addresses.UnusedTailCount() != addresses.gapLimit {
		panic("concurrency error; addresses not synced correctly")
	}
	return addresses.addresses[len(addresses.addresses)-addresses.gapLimit]
}

func (addresses AddressChain) childXPub(index uint32) *hdkeychain.ExtendedKey {
	xpub, err := addresses.xpub.Child(index)
	if err != nil {
		panic(err)
	}
	return xpub
}

// AddAddress appends a new address at the end of the chain.
func (addresses *AddressChain) AddAddress(net *chaincfg.Params) *Address {
	index := len(addresses.addresses)
	childXPub := addresses.childXPub(uint32(index))
	address, err := childXPub.Address(net)
	if err != nil {
		panic(err)
	}
	publicKey, err := childXPub.ECPubKey()
	if err != nil {
		panic(err)
	}
	addressWithPK := NewAddress(address, publicKey, fmt.Sprintf("%d/%d", addresses.chainIndex, index))
	addresses.addresses = append(addresses.addresses, addressWithPK)
	return addressWithPK

}

// UnusedTailCount returns the number of unused addresses at the end of the chain.
func (addresses AddressChain) UnusedTailCount() int {
	count := 0
	for i := len(addresses.addresses) - 1; i >= 0; i-- {
		if addresses.addresses[i].isUsed() {
			break
		}
		count++
	}
	return count
}

func (addresses *AddressChain) Contains(checkAddress btcutil.Address) bool {
	// todo: add map for constant time lookup
	for _, address := range addresses.addresses {
		if checkAddress.String() == address.String() {
			return true
		}
	}
	return false
}
