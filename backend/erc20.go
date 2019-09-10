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

package backend

import "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"

type erc20Token struct {
	code  string
	name  string
	unit  string
	token *erc20.Token
}

var erc20Tokens = []erc20Token{
	{
		code:  "eth-erc20-usdt",
		name:  "Tether USD BETA",
		unit:  "USDT",
		token: erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6),
	},
	{
		code:  "eth-erc20-bat",
		name:  "Basic Attention Token BETA",
		unit:  "BAT",
		token: erc20.NewToken("0x0d8775f648430679a709e98d2b0cb6250d2887ef", 18),
	},
	{
		code:  "eth-erc20-dai",
		name:  "Dai v1.0 BETA",
		unit:  "DAI",
		token: erc20.NewToken("0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359", 18),
	},
	{
		code:  "eth-erc20-link",
		name:  "Chainlink BETA",
		unit:  "LINK",
		token: erc20.NewToken("0x514910771af9ca656af840dff83e8264ecf986ca", 18),
	},
	{
		code:  "eth-erc20-mkr",
		name:  "Maker BETA",
		unit:  "MKR",
		token: erc20.NewToken("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", 18),
	},
	{
		code:  "eth-erc20-zrx",
		name:  "ZRX BETA",
		unit:  "ZRX",
		token: erc20.NewToken("0xe41d2489571d322189246dafa5ebde1f4699f498", 18),
	},
}

func erc20TokenByCode(code string) *erc20Token {
	for _, token := range erc20Tokens {
		if code == token.code {
			return &token
		}
	}
	return nil
}
