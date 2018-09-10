package eth

import "github.com/ethereum/go-ethereum/common"

// Address holds an Ethereum address and implements coin.Address.
type Address struct {
	common.Address
}

// ID implements coin.Address.
func (address Address) ID() string {
	return address.Address.Hex()
}

// EncodeForHumans implements coin.Address.
func (address Address) EncodeForHumans() string {
	return address.Address.Hex()
}
