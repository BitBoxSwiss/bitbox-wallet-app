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

package bitbox02

import (
	"github.com/btcsuite/btcd/txscript"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
)

// conversions from types used by the wallet to types defined in the protobuf messages.

var btcMsgCoinMap = map[coin.Code]messages.BTCCoin{
	coin.CodeBTC:  messages.BTCCoin_BTC,
	coin.CodeTBTC: messages.BTCCoin_TBTC,
	coin.CodeLTC:  messages.BTCCoin_LTC,
	coin.CodeTLTC: messages.BTCCoin_TLTC,
}

var btcMsgScriptTypeMap = map[signing.ScriptType]messages.BTCScriptConfig_SimpleType{
	signing.ScriptTypeP2WPKHP2SH: messages.BTCScriptConfig_P2WPKH_P2SH,
	signing.ScriptTypeP2WPKH:     messages.BTCScriptConfig_P2WPKH,
}

var btcMsgOutputTypeMap = map[txscript.ScriptClass]messages.BTCOutputType{
	txscript.PubKeyHashTy:          messages.BTCOutputType_P2PKH,
	txscript.ScriptHashTy:          messages.BTCOutputType_P2SH,
	txscript.WitnessV0PubKeyHashTy: messages.BTCOutputType_P2WPKH,
	txscript.WitnessV0ScriptHashTy: messages.BTCOutputType_P2WSH,
}

var ethMsgCoinMap = map[coin.Code]messages.ETHCoin{
	coin.CodeETH:          messages.ETHCoin_ETH,
	"eth-erc20-usdt":      messages.ETHCoin_ETH,
	"eth-erc20-usdc":      messages.ETHCoin_ETH,
	"eth-erc20-link":      messages.ETHCoin_ETH,
	"eth-erc20-bat":       messages.ETHCoin_ETH,
	"eth-erc20-mkr":       messages.ETHCoin_ETH,
	"eth-erc20-zrx":       messages.ETHCoin_ETH,
	"eth-erc20-wbtc":      messages.ETHCoin_ETH,
	"eth-erc20-paxg":      messages.ETHCoin_ETH,
	"eth-erc20-sai0x89d2": messages.ETHCoin_ETH,
	"eth-erc20-dai0x6b17": messages.ETHCoin_ETH,
	coin.CodeTETH:         messages.ETHCoin_RopstenETH,
	coin.CodeRETH:         messages.ETHCoin_RinkebyETH,
	coin.CodeERC20TEST:    messages.ETHCoin_RopstenETH,
}
