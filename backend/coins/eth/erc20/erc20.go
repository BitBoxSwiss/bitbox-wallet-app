// Copyright 2018 Shift Devices AG
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

package erc20

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/ethereum/go-ethereum/common"
)

// Token holds infos about the erc20 token needed to fetch balances, format amounts, etc.
type Token struct {
	Code            coin.Code
	contractAddress common.Address
	decimals        uint
}

// NewToken creates a new Token instance.
func NewToken(code coin.Code, contractAddress string, decimals uint) *Token {
	if !common.IsHexAddress(contractAddress) {
		panic("invalid erc20 contract address")
	}

	return &Token{
		Code:            code,
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
