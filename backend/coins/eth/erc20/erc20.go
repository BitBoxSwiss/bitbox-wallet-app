// SPDX-License-Identifier: Apache-2.0

package erc20

import "github.com/ethereum/go-ethereum/common"

// Token holds infos about the erc20 token needed to fetch balances, format amounts, etc.
type Token struct {
	contractAddress common.Address
	decimals        uint
}

// NewToken creates a new Token instance.
func NewToken(contractAddress string, decimals uint) *Token {
	if !common.IsHexAddress(contractAddress) {
		panic("invalid erc20 contract address")
	}

	return &Token{
		contractAddress: common.HexToAddress(contractAddress),
		decimals:        decimals,
	}
}

// ContractAddress returns the address where the erc20 token is deployed.
func (token *Token) ContractAddress() common.Address {
	return token.contractAddress
}

// Decimals returns the number of decimals needed to convert between the smallest unit and the
// standard unit.
func (token *Token) Decimals() uint {
	return token.decimals
}
