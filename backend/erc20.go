// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

import (
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
)

type erc20Token struct {
	code  coin.Code
	name  string
	unit  string
	token *erc20.Token
}

var erc20Tokens = []erc20Token{
	// Note: if you change the coinCode from eth-erc20- to something else, make sure to check for
	// instances of it in the frontend.
	// The frontend sends them to the backend to store in the config without the prefix
	// in frontend/web/src/routes/settings/settings.tsx.
	{
		code:  "eth-erc20-usdt",
		name:  "Tether USD",
		unit:  "USDT",
		token: erc20.NewToken("0xdac17f958d2ee523a2206206994597c13d831ec7", 6),
	},
	{
		code:  "eth-erc20-usdc",
		name:  "USD Coin",
		unit:  "USDC",
		token: erc20.NewToken("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6),
	},
	{
		code:  "eth-erc20-bat",
		name:  "Basic Attention Token",
		unit:  "BAT",
		token: erc20.NewToken("0x0d8775f648430679a709e98d2b0cb6250d2887ef", 18),
	},
	{
		code:  "eth-erc20-sai0x89d2",
		name:  "Sai",
		unit:  "SAI",
		token: erc20.NewToken("0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359", 18),
	},
	{
		code:  "eth-erc20-dai0x6b17",
		name:  "Dai",
		unit:  "DAI",
		token: erc20.NewToken("0x6b175474e89094c44da98b954eedeac495271d0f", 18),
	},
	{
		code:  "eth-erc20-link",
		name:  "Chainlink",
		unit:  "LINK",
		token: erc20.NewToken("0x514910771af9ca656af840dff83e8264ecf986ca", 18),
	},
	{
		code:  "eth-erc20-mkr",
		name:  "Maker",
		unit:  "MKR",
		token: erc20.NewToken("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", 18),
	},
	{
		code:  "eth-erc20-zrx",
		name:  "0x",
		unit:  "ZRX",
		token: erc20.NewToken("0xe41d2489571d322189246dafa5ebde1f4699f498", 18),
	},
	{
		code:  "eth-erc20-wbtc",
		name:  "Wrapped Bitcoin",
		unit:  "WBTC",
		token: erc20.NewToken("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 8),
	},
	{
		code:  "eth-erc20-paxg",
		name:  "Pax Gold",
		unit:  "PAXG",
		token: erc20.NewToken("0x45804880De22913dAFE09f4980848ECE6EcbAf78", 18),
	},
}

func erc20TokenByCode(code coin.Code) *erc20Token {
	for _, token := range erc20Tokens {
		if code == token.code {
			token := token
			return &token
		}
	}
	return nil
}
